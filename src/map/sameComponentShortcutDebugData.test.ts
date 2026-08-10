import { describe, expect, it } from 'vitest'
import {
  createSameComponentShortcutDisplayId,
  findSameComponentShortcutById,
  includeSelectedSameComponentShortcut,
  parseSameComponentShortcutDebugData,
  selectSameComponentShortcutDebugData,
  type SameComponentShortcutDebugData,
} from './sameComponentShortcutDebugData'

describe('same-component shortcut debug data', () => {
  it('sorts by detour ratio and limits to top N', () => {
    const selected = selectSameComponentShortcutDebugData(data(), {
      limit: 2,
      minimumDetourRatio: 0,
      maximumDirectDistanceMeters: 200,
    })

    expect(selected.features.map(({ properties }) => properties.candidateId)).toEqual([
      'candidate-high',
      'candidate-medium',
    ])
  })

  it('uses the requested top-20 boundary', () => {
    const features = Array.from({ length: 25 }, (_, index) =>
      rawFeature(
        `candidate-${index}`,
        25,
        (index + 1) * 100,
        index + 1,
      ),
    )
    const selected = selectSameComponentShortcutDebugData(
      parseSameComponentShortcutDebugData({
        type: 'FeatureCollection',
        features,
      }),
      {
        limit: 20,
        minimumDetourRatio: 0,
        maximumDirectDistanceMeters: 200,
      },
    )

    expect(selected.features).toHaveLength(20)
    expect(selected.features[0].properties.detourRatio).toBe(25)
    expect(selected.features[19].properties.detourRatio).toBe(6)
  })

  it('filters by minimum ratio', () => {
    const selected = selectSameComponentShortcutDebugData(data(), {
      limit: 'all',
      minimumDetourRatio: 20,
      maximumDirectDistanceMeters: 200,
    })

    expect(selected.features).toHaveLength(1)
    expect(selected.features[0].properties.candidateId).toBe('candidate-high')
  })

  it('filters by maximum direct distance', () => {
    const selected = selectSameComponentShortcutDebugData(data(), {
      limit: 'all',
      minimumDetourRatio: 0,
      maximumDirectDistanceMeters: 50,
    })

    expect(selected.features.map(({ properties }) => properties.candidateId)).toEqual([
      'candidate-high',
      'candidate-low',
    ])
  })

  it('preserves deterministic candidateId and derives a stable display ID', () => {
    const candidateId = 'same-component-shortcut:edge-a:0.5:edge-b:1.0'
    const raw = rawFeature(candidateId, 50, 1_000, 20)
    const first = parseSameComponentShortcutDebugData({
      type: 'FeatureCollection',
      features: [raw],
    })
    const second = parseSameComponentShortcutDebugData({
      type: 'FeatureCollection',
      features: [raw],
    })

    expect(first.features[0].properties.candidateId).toBe(candidateId)
    expect(first.features[0].properties.shortcutId).toBe(
      createSameComponentShortcutDisplayId(candidateId),
    )
    expect(first).toEqual(second)
  })

  it('finds candidates by case-insensitive short or full ID', () => {
    const candidates = data()
    const candidate = candidates.features[0]

    expect(
      findSameComponentShortcutById(
        candidates,
        `  ${candidate.properties.shortcutId.toLowerCase()}  `,
      ),
    ).toBe(candidate)
    expect(
      findSameComponentShortcutById(
        candidates,
        candidate.properties.candidateId.toUpperCase(),
      ),
    ).toBe(candidate)
    expect(findSameComponentShortcutById(candidates, 'SC-UNKNOWN')).toBeUndefined()
  })

  it('includes a selected candidate that is outside the filtered data', () => {
    const candidates = data()
    const filtered = {
      type: 'FeatureCollection' as const,
      features: [candidates.features[0]],
    }
    const selected = candidates.features[1]

    expect(
      includeSelectedSameComponentShortcut(filtered, selected).features,
    ).toEqual([candidates.features[0], selected])
    expect(
      includeSelectedSameComponentShortcut(candidates, selected),
    ).toBe(candidates)
  })
})

function data(): SameComponentShortcutDebugData {
  return parseSameComponentShortcutDebugData({
    type: 'FeatureCollection',
    features: [
      rawFeature('candidate-low', 40, 240, 6),
      rawFeature('candidate-high', 30, 900, 30),
      rawFeature('candidate-medium', 80, 1_200, 15),
    ],
  })
}

function rawFeature(
  candidateId: string,
  directDistanceMeters: number,
  ordinaryNetworkDistanceMeters: number,
  detourRatio: number,
) {
  return {
    type: 'Feature',
    id: candidateId,
    properties: {
      candidateId,
      directDistanceMeters,
      ordinaryNetworkDistanceMeters,
      detourRatio,
      componentId: 'component-a',
      fromEdgeId: 'edge-a',
      toEdgeId: 'edge-b',
      fromEdgeType: 'path',
      toEdgeType: 'road',
    },
    geometry: {
      type: 'LineString',
      coordinates: [
        [9.55, 62.76],
        [9.56, 62.77],
      ],
    },
  }
}
