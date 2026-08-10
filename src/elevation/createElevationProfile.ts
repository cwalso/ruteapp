import type {
  ElevationProfile,
  ElevationSampleLocation,
} from './elevationTypes'

export function createElevationProfile(
  locations: readonly ElevationSampleLocation[],
  elevationsMeters: readonly number[],
  noiseThresholdMeters: number,
): ElevationProfile {
  if (locations.length === 0 || locations.length !== elevationsMeters.length) {
    throw new Error('Elevation response does not match the sampled route')
  }

  if (!Number.isFinite(noiseThresholdMeters) || noiseThresholdMeters < 0) {
    throw new Error('Elevation noise threshold must not be negative')
  }

  if (elevationsMeters.some((elevation) => !Number.isFinite(elevation))) {
    throw new Error('Elevation response contains an invalid height')
  }

  const samples = locations.map((location, index) => ({
    ...location,
    elevationMeters: elevationsMeters[index],
  }))
  let totalAscentMeters = 0
  let totalDescentMeters = 0
  let referenceElevationMeters = samples[0].elevationMeters

  for (const sample of samples.slice(1)) {
    const differenceMeters =
      sample.elevationMeters - referenceElevationMeters

    if (Math.abs(differenceMeters) < noiseThresholdMeters) {
      continue
    }

    if (differenceMeters > 0) {
      totalAscentMeters += differenceMeters
    } else {
      totalDescentMeters += Math.abs(differenceMeters)
    }

    referenceElevationMeters = sample.elevationMeters
  }

  const elevationValues = samples.map(({ elevationMeters }) => elevationMeters)

  return {
    samples,
    totalDistanceMeters: samples[samples.length - 1].distanceFromStartMeters,
    totalAscentMeters,
    totalDescentMeters,
    minElevationMeters: Math.min(...elevationValues),
    maxElevationMeters: Math.max(...elevationValues),
  }
}
