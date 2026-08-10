import type { EdgeType } from '../routing/routingTypes'
import type { GeographicCoordinate } from '../utils/geographicDistance'

export type ElevationRouteSegment = {
  from: GeographicCoordinate
  to: GeographicCoordinate
  distanceMeters: number
  edgeType: EdgeType
}

export type ElevationSampleLocation = GeographicCoordinate & {
  distanceFromStartMeters: number
}

export type ElevationSample = ElevationSampleLocation & {
  elevationMeters: number
}

export type ElevationProfile = {
  samples: readonly ElevationSample[]
  totalDistanceMeters: number
  totalAscentMeters: number
  totalDescentMeters: number
  minElevationMeters: number
  maxElevationMeters: number
}

export type ElevationService = {
  getElevations(
    locations: readonly ElevationSampleLocation[],
    signal: AbortSignal,
  ): Promise<readonly number[]>
}
