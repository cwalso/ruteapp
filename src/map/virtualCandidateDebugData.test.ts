import { describe, expect, it } from 'vitest'
import type { VirtualConnectionCandidate } from '../routing/virtualConnections'
import {
  createVirtualCandidateDebugData,
  createVirtualCandidateDebugId,
} from './virtualCandidateDebugData'

describe('virtual candidate debug data', () => {
  it('uses the actual connection coordinates and exposes inspection metadata', () => {
    const candidate = createCandidate(42, 9.55, 62.76, 9.56, 62.77)
    const data = createVirtualCandidateDebugData([candidate])
    const feature = data.features[0]

    expect(feature.geometry.coordinates).toEqual([
      [9.55, 62.76],
      [9.56, 62.77],
    ])
    expect(feature.properties).toMatchObject({
      candidateId: createVirtualCandidateDebugId(candidate),
      distanceMeters: 42,
      distanceCategory: '0-50',
      componentA: 'component-a',
      componentB: 'component-b',
      edgeA: 'edge-a',
      edgeB: 'edge-b',
      longitudeA: 9.55,
      latitudeA: 62.76,
      longitudeB: 9.56,
      latitudeB: 62.77,
    })
  })

  it.each([
    [49.99, '0-50'],
    [50, '50-100'],
    [100, '100-150'],
    [150, '150-200'],
    [200, '150-200'],
  ] as const)('categorizes %s meters as %s', (distance, category) => {
    const data = createVirtualCandidateDebugData([
      createCandidate(distance, 9.55, 62.76, 9.56, 62.77),
    ])

    expect(data.features[0].properties.distanceCategory).toBe(category)
  })

  it('keeps ids stable when candidate order changes', () => {
    const first = createCandidate(40, 9.55, 62.76, 9.56, 62.77)
    const second = createCandidate(80, 9.57, 62.78, 9.58, 62.79)

    const firstOrder = createVirtualCandidateDebugData([first, second])
    const secondOrder = createVirtualCandidateDebugData([second, first])

    expect(firstOrder.features.map(({ id }) => id).sort()).toEqual(
      secondOrder.features.map(({ id }) => id).sort(),
    )
  })
})

function createCandidate(
  distanceMeters: number,
  longitudeA: number,
  latitudeA: number,
  longitudeB: number,
  latitudeB: number,
): VirtualConnectionCandidate {
  return {
    id: `candidate-${distanceMeters}`,
    componentIds: ['component-a', 'component-b'],
    from: {
      edgeId: 'edge-a',
      nodeId: 'node-a',
      positionAlongEdge: 0.25,
      position: { longitude: longitudeA, latitude: latitudeA },
    },
    to: {
      edgeId: 'edge-b',
      nodeId: 'node-b',
      positionAlongEdge: 0.75,
      position: { longitude: longitudeB, latitude: latitudeB },
    },
    distanceMeters,
    cost: distanceMeters * 3,
  }
}
