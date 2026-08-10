import { describe, expect, it } from 'vitest'
import { sampleRouteGeometry } from './sampleRouteGeometry'
import type { ElevationRouteSegment } from './elevationTypes'

describe('sampleRouteGeometry', () => {
  it('keeps both endpoints for a route shorter than the sample interval', () => {
    const samples = sampleRouteGeometry([segment(0, 1, 10)], 25)

    expect(samples).toEqual([
      { longitude: 0, latitude: 62, distanceFromStartMeters: 0 },
      { longitude: 1, latitude: 62, distanceFromStartMeters: 10 },
    ])
  })

  it('samples a long segment at a deterministic interval', () => {
    const samples = sampleRouteGeometry([segment(0, 1, 100)], 25)

    expect(samples.map(({ distanceFromStartMeters }) => distanceFromStartMeters))
      .toEqual([0, 25, 50, 75, 100])
    expect(samples[2].longitude).toBeCloseTo(0.5)
  })

  it('keeps a via point as a natural bend in a multi-segment route', () => {
    const samples = sampleRouteGeometry(
      [segment(0, 1, 40), segment(1, 2, 60)],
      25,
    )

    expect(samples).toContainEqual({
      longitude: 1,
      latitude: 62,
      distanceFromStartMeters: 40,
    })
    expect(samples.at(-1)?.distanceFromStartMeters).toBe(100)
  })

  it('samples a virtual segment like the rest of the route geometry', () => {
    const samples = sampleRouteGeometry(
      [segment(0, 1, 30, 'path'), segment(1, 2, 50, 'virtual')],
      25,
    )

    expect(samples.map(({ distanceFromStartMeters }) => distanceFromStartMeters))
      .toEqual([0, 25, 30, 55, 80])
    expect(samples.at(-1)?.longitude).toBe(2)
  })

  it('uses the complete routed distance as the final cumulative distance', () => {
    const samples = sampleRouteGeometry(
      [segment(0, 1, 31), segment(1, 2, 47), segment(2, 3, 19)],
      25,
    )

    expect(samples.at(-1)?.distanceFromStartMeters).toBe(97)
  })
})

function segment(
  fromLongitude: number,
  toLongitude: number,
  distanceMeters: number,
  edgeType: ElevationRouteSegment['edgeType'] = 'path',
): ElevationRouteSegment {
  return {
    from: { longitude: fromLongitude, latitude: 62 },
    to: { longitude: toLongitude, latitude: 62 },
    distanceMeters,
    edgeType,
  }
}
