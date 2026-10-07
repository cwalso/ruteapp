import { describe, expect, it } from 'vitest'
import {
  analyzeHighwayCoverage,
  type OverpassResponse,
} from '../../scripts/routing/osmHighwayCoverage'
import {
  AUDIT_EXPANDED_HIGHWAY_EDGE_TYPES,
  CURRENT_HIGHWAY_EDGE_TYPES,
  classifyFootAccess,
  isWalkable,
} from '../../scripts/routing/osmWalkingPolicy'
import type { RoutingArea } from '../../scripts/routing/routingAreas'

const area: RoutingArea = {
  id: 'fixture',
  name: 'Fixture',
  bounds: {
    south: 62.77,
    west: 9.59,
    north: 62.8,
    east: 9.66,
  },
}

const rawData: OverpassResponse = {
  osm3s: {
    timestamp_osm_base: '2026-10-07T09:00:00Z',
  },
  elements: [
    node(1, 9.6),
    node(2, 9.61),
    node(3, 9.62),
    node(4, 9.63),
    node(5, 9.64),
    node(6, 9.65),
    way(100, [1, 2], { highway: 'path' }),
    way(101, [3, 4], { highway: 'path' }),
    way(102, [2, 3], { highway: 'tertiary' }),
    way(103, [4, 5], { highway: 'cycleway', foot: 'no' }),
    way(104, [5, 6], { highway: 'motorway' }),
  ],
}

describe('OSM highway coverage audit', () => {
  it('compares current and expanded policies against the same snapshot', () => {
    const report = analyzeHighwayCoverage(rawData, area)

    expect(report.snapshotTimestamp).toBe('2026-10-07T09:00:00Z')
    expect(report.currentPolicy.ways).toBe(2)
    expect(report.currentPolicy.components).toBe(2)
    expect(report.expandedAuditPolicy.ways).toBe(3)
    expect(report.expandedAuditPolicy.components).toBe(1)
    expect(report.delta.addedWays).toBe(1)
    expect(report.delta.baselineComponentMergeReduction).toBe(1)
    expect(report.delta.baselineComponentsParticipatingInMerges).toBe(2)
    expect(report.delta.expandedComponentsJoiningBaseline).toBe(1)
    expect(report.auditAdditionWays).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 102,
          highway: 'tertiary',
          passingCurrentAccessFilter: true,
          baselineComponentsTouched: 2,
        }),
        expect.objectContaining({
          id: 103,
          highway: 'cycleway',
          passingCurrentAccessFilter: false,
          footAccessClassification: 'explicit-restricted',
        }),
      ]),
    )

    const tertiary = report.observedHighways.find(
      ({ highway }) => highway === 'tertiary',
    )
    const cycleway = report.observedHighways.find(
      ({ highway }) => highway === 'cycleway',
    )
    const motorway = report.observedHighways.find(
      ({ highway }) => highway === 'motorway',
    )

    expect(tertiary).toMatchObject({
      policyRole: 'audit-addition',
      ways: 1,
      implicitOrUnknown: 1,
    })
    expect(cycleway).toMatchObject({
      policyRole: 'audit-addition',
      explicitFootRestricted: 1,
      passingCurrentAccessFilter: 0,
    })
    expect(motorway).toMatchObject({
      policyRole: 'observed-only',
      ways: 1,
    })
  })

  it('keeps validated runtime classes separate from remaining audit additions', () => {
    expect(CURRENT_HIGHWAY_EDGE_TYPES.secondary).toBe('road')
    expect(CURRENT_HIGHWAY_EDGE_TYPES.tertiary).toBeUndefined()
    expect(CURRENT_HIGHWAY_EDGE_TYPES.cycleway).toBeUndefined()
    expect(AUDIT_EXPANDED_HIGHWAY_EDGE_TYPES.secondary).toBe('road')
    expect(AUDIT_EXPANDED_HIGHWAY_EDGE_TYPES.tertiary).toBe('road')
    expect(AUDIT_EXPANDED_HIGHWAY_EDGE_TYPES.cycleway).toBe('path')
    expect(AUDIT_EXPANDED_HIGHWAY_EDGE_TYPES.motorway).toBeUndefined()
  })

  it('reports explicit and inherited access separately', () => {
    expect(isWalkable({ foot: 'no' })).toBe(false)
    expect(classifyFootAccess({ foot: 'no' })).toBe('explicit-restricted')
    expect(isWalkable({ access: 'private', foot: 'yes' })).toBe(true)
    expect(classifyFootAccess({ access: 'private', foot: 'yes' })).toBe(
      'explicit-allowed',
    )
    expect(isWalkable({ access: 'private' })).toBe(false)
    expect(classifyFootAccess({ access: 'private' })).toBe(
      'general-restricted',
    )
  })
})

function node(id: number, lon: number) {
  return {
    type: 'node' as const,
    id,
    lat: 62.78,
    lon,
  }
}

function way(
  id: number,
  nodes: number[],
  tags: Record<string, string>,
) {
  return {
    type: 'way' as const,
    id,
    nodes,
    tags,
  }
}
