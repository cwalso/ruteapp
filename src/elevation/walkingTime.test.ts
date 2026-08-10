import { describe, expect, it } from 'vitest'
import { elevationConfig } from './elevationConfig'
import { estimateWalkingTimeMinutes } from './walkingTime'

describe('estimateWalkingTimeMinutes', () => {
  it('uses the configured flat walking speed', () => {
    expect(
      estimateWalkingTimeMinutes(
        { distanceMeters: 10_000, totalAscentMeters: 0 },
        elevationConfig.walkingTime,
      ),
    ).toBe(120)
  })

  it('adds Naismith ascent time to the distance estimate', () => {
    expect(
      estimateWalkingTimeMinutes(
        { distanceMeters: 5_000, totalAscentMeters: 600 },
        elevationConfig.walkingTime,
      ),
    ).toBe(120)
  })

  it('keeps a separate virtual-distance multiplier for future use', () => {
    expect(
      estimateWalkingTimeMinutes(
        {
          distanceMeters: 1_000,
          totalAscentMeters: 0,
          virtualDistanceMeters: 500,
        },
        {
          ...elevationConfig.walkingTime,
          virtualDistanceMultiplier: 2,
        },
      ),
    ).toBe(18)
  })
})
