export const elevationConfig = {
  sampleIntervalMeters: 25,
  ascentNoiseThresholdMeters: 1,
  requestDebounceMilliseconds: 300,
  walkingTime: {
    flatSpeedKilometersPerHour: 5,
    ascentMetersPerHour: 600,
    virtualDistanceMultiplier: 1,
  },
} as const
