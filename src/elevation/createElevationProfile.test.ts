import { describe, expect, it } from 'vitest'
import { createElevationProfile } from './createElevationProfile'
import type { ElevationSampleLocation } from './elevationTypes'

describe('createElevationProfile', () => {
  it('calculates ascent, descent and elevation limits from known values', () => {
    const profile = createElevationProfile(
      locations([0, 20, 40, 60, 80, 100]),
      [100, 100.4, 101.2, 104, 103.6, 101],
      1,
    )

    expect(profile.totalDistanceMeters).toBe(100)
    expect(profile.totalAscentMeters).toBeCloseTo(4)
    expect(profile.totalDescentMeters).toBeCloseTo(3)
    expect(profile.minElevationMeters).toBe(100)
    expect(profile.maxElevationMeters).toBe(104)
  })

  it('ignores small flat-terrain noise until the threshold is crossed', () => {
    const profile = createElevationProfile(
      locations([0, 25, 50, 75]),
      [100, 100.3, 99.8, 100.4],
      1,
    )

    expect(profile.totalAscentMeters).toBe(0)
    expect(profile.totalDescentMeters).toBe(0)
  })

  it('rejects a missing or invalid elevation response', () => {
    expect(() =>
      createElevationProfile(locations([0, 25]), [100], 1),
    ).toThrow('does not match')
    expect(() =>
      createElevationProfile(locations([0, 25]), [100, Number.NaN], 1),
    ).toThrow('invalid height')
  })
})

function locations(
  distances: readonly number[],
): ElevationSampleLocation[] {
  return distances.map((distanceFromStartMeters) => ({
    longitude: 9.6,
    latitude: 62.78,
    distanceFromStartMeters,
  }))
}
