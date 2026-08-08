import type { RoutePoint } from '../../types/routePoint'
import { calculateGeographicDistanceMeters } from '../../utils/geographicDistance'

export type RoutePointRole = {
  kind: 'start' | 'via' | 'end'
  label: string
}

export function getRoutePointRole(
  index: number,
  pointCount: number,
): RoutePointRole {
  if (index === 0) {
    return { kind: 'start', label: 'A' }
  }

  if (index === pointCount - 1) {
    return { kind: 'end', label: 'B' }
  }

  return { kind: 'via', label: String(index) }
}

export function calculateRouteDistanceMeters(
  routePoints: readonly RoutePoint[],
) {
  let totalDistance = 0

  for (let index = 1; index < routePoints.length; index += 1) {
    totalDistance += calculateGeographicDistanceMeters(
      routePoints[index - 1],
      routePoints[index],
    )
  }

  return totalDistance
}

export function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1_000) {
    return `${Math.round(distanceMeters)} m`
  }

  return `${new Intl.NumberFormat('nb-NO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(distanceMeters / 1_000)} km`
}
