import { useEffect, useMemo, useState } from 'react'
import { createElevationProfile } from '../../elevation/createElevationProfile'
import { elevationConfig } from '../../elevation/elevationConfig'
import { sampleRouteGeometry } from '../../elevation/sampleRouteGeometry'
import type {
  ElevationProfile,
  ElevationRouteSegment,
  ElevationService,
} from '../../elevation/elevationTypes'
import { estimateWalkingTimeMinutes } from '../../elevation/walkingTime'
import { kartverketElevationService } from '../../services/kartverketElevation'

export type RouteElevationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'ready'
      profile: ElevationProfile
      estimatedWalkingTimeMinutes: number
    }
  | { status: 'error' }

type SettledElevationState = {
  routeKey: string
  state: Exclude<RouteElevationState, { status: 'idle' | 'loading' }>
}

export function useRouteElevation(
  routeSegments: readonly ElevationRouteSegment[],
  virtualDistanceMeters: number,
  service: ElevationService = kartverketElevationService,
): RouteElevationState {
  const [settledState, setSettledState] =
    useState<SettledElevationState>()
  const routeKey = useMemo(
    () => createRouteKey(routeSegments),
    [routeSegments],
  )
  const sampleLocations = useMemo(
    () =>
      sampleRouteGeometry(
        routeSegments,
        elevationConfig.sampleIntervalMeters,
      ),
    [routeSegments],
  )

  useEffect(() => {
    if (!routeKey || sampleLocations.length === 0) {
      return
    }

    if (import.meta.env.DEV) {
      console.debug('[RuteApp][Elevation] route received', {
        segmentCount: routeSegments.length,
        routeDistanceMeters:
          sampleLocations[sampleLocations.length - 1].distanceFromStartMeters,
      })
      console.debug('[RuteApp][Elevation] samples', {
        count: sampleLocations.length,
      })
    }

    const abortController = new AbortController()
    const timeoutId = window.setTimeout(() => {
      const requestStartedAt = performance.now()

      service
        .getElevations(sampleLocations, abortController.signal)
        .then((elevationsMeters) => {
          abortController.signal.throwIfAborted()
          const profile = createElevationProfile(
            sampleLocations,
            elevationsMeters,
            elevationConfig.ascentNoiseThresholdMeters,
          )
          const estimatedWalkingTimeMinutes = estimateWalkingTimeMinutes(
            {
              distanceMeters: profile.totalDistanceMeters,
              totalAscentMeters: profile.totalAscentMeters,
              virtualDistanceMeters,
            },
            elevationConfig.walkingTime,
          )

          if (import.meta.env.DEV) {
            console.debug('[RuteApp][Elevation] profile ready', {
              requestDurationMilliseconds: Math.round(
                performance.now() - requestStartedAt,
              ),
              sampleCount: profile.samples.length,
              totalDistanceMeters: profile.totalDistanceMeters,
              totalAscentMeters: profile.totalAscentMeters,
              totalDescentMeters: profile.totalDescentMeters,
              minElevationMeters: profile.minElevationMeters,
              maxElevationMeters: profile.maxElevationMeters,
              estimatedWalkingTimeMinutes,
            })
          }

          setSettledState({
            routeKey,
            state: {
              status: 'ready',
              profile,
              estimatedWalkingTimeMinutes,
            },
          })
        })
        .catch((error: unknown) => {
          if (abortController.signal.aborted) {
            return
          }

          if (import.meta.env.DEV) {
            console.error('[RuteApp][Elevation] ERROR',
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                  }
                : error,
            )
          }

          setSettledState({ routeKey, state: { status: 'error' } })
        })
    }, elevationConfig.requestDebounceMilliseconds)

    return () => {
      window.clearTimeout(timeoutId)
      abortController.abort()
    }
  }, [
    routeKey,
    routeSegments.length,
    sampleLocations,
    service,
    virtualDistanceMeters,
  ])

  if (!routeKey || sampleLocations.length === 0) {
    return { status: 'idle' }
  }

  return settledState?.routeKey === routeKey
    ? settledState.state
    : { status: 'loading' }
}

function createRouteKey(segments: readonly ElevationRouteSegment[]) {
  return segments
    .map(
      ({ from, to, distanceMeters, edgeType }) =>
        `${from.longitude},${from.latitude}:${to.longitude},${to.latitude}:${distanceMeters}:${edgeType}`,
    )
    .join('|')
}
