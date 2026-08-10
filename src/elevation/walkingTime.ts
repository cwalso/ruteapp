export type WalkingTimeConfig = {
  flatSpeedKilometersPerHour: number
  ascentMetersPerHour: number
  virtualDistanceMultiplier: number
}

export type WalkingTimeInput = {
  distanceMeters: number
  totalAscentMeters: number
  virtualDistanceMeters?: number
}

export function estimateWalkingTimeMinutes(
  {
    distanceMeters,
    totalAscentMeters,
    virtualDistanceMeters = 0,
  }: WalkingTimeInput,
  config: WalkingTimeConfig,
) {
  validateNonNegativeFinite(distanceMeters, 'distance')
  validateNonNegativeFinite(totalAscentMeters, 'ascent')
  validateNonNegativeFinite(virtualDistanceMeters, 'virtual distance')

  if (virtualDistanceMeters > distanceMeters) {
    throw new Error('Virtual distance cannot exceed total distance')
  }

  if (
    !Number.isFinite(config.flatSpeedKilometersPerHour) ||
    config.flatSpeedKilometersPerHour <= 0 ||
    !Number.isFinite(config.ascentMetersPerHour) ||
    config.ascentMetersPerHour <= 0 ||
    !Number.isFinite(config.virtualDistanceMultiplier) ||
    config.virtualDistanceMultiplier <= 0
  ) {
    throw new Error('Walking time configuration must be positive')
  }

  const ordinaryDistanceMeters = distanceMeters - virtualDistanceMeters
  const adjustedDistanceKilometers =
    (ordinaryDistanceMeters +
      virtualDistanceMeters * config.virtualDistanceMultiplier) /
    1_000
  const distanceHours =
    adjustedDistanceKilometers / config.flatSpeedKilometersPerHour
  const ascentHours = totalAscentMeters / config.ascentMetersPerHour

  return (distanceHours + ascentHours) * 60
}

function validateNonNegativeFinite(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Walking time ${name} must not be negative`)
  }
}
