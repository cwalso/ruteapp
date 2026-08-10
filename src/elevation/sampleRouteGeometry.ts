import type {
  ElevationRouteSegment,
  ElevationSampleLocation,
} from './elevationTypes'

export function sampleRouteGeometry(
  segments: readonly ElevationRouteSegment[],
  sampleIntervalMeters: number,
): ElevationSampleLocation[] {
  if (!Number.isFinite(sampleIntervalMeters) || sampleIntervalMeters <= 0) {
    throw new Error('Elevation sample interval must be greater than zero')
  }

  if (segments.length === 0) {
    return []
  }

  const samples: ElevationSampleLocation[] = [
    {
      ...segments[0].from,
      distanceFromStartMeters: 0,
    },
  ]
  let distanceFromStartMeters = 0

  for (const segment of segments) {
    validateSegmentDistance(segment.distanceMeters)

    for (
      let segmentDistanceMeters = sampleIntervalMeters;
      segmentDistanceMeters < segment.distanceMeters;
      segmentDistanceMeters += sampleIntervalMeters
    ) {
      const positionAlongSegment =
        segmentDistanceMeters / segment.distanceMeters

      samples.push({
        longitude:
          segment.from.longitude +
          (segment.to.longitude - segment.from.longitude) *
            positionAlongSegment,
        latitude:
          segment.from.latitude +
          (segment.to.latitude - segment.from.latitude) *
            positionAlongSegment,
        distanceFromStartMeters:
          distanceFromStartMeters + segmentDistanceMeters,
      })
    }

    distanceFromStartMeters += segment.distanceMeters
    samples.push({
      ...segment.to,
      distanceFromStartMeters,
    })
  }

  return samples
}

function validateSegmentDistance(distanceMeters: number) {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    throw new Error('Elevation route segment has an invalid distance')
  }
}
