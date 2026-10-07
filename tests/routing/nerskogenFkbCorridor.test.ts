import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  addFkbOrdinaryRoutingSupplement,
  type FkbOrdinaryRoutingSupplement,
} from '../../src/routing/fkbOrdinaryRoutingSupplement'
import {
  loadRoutingDataset,
  parseRoutingDataset,
} from '../../src/routing/routingDataset'
import { routeWaypoints } from '../../src/routing/routeWaypoints'

const routePoints = [
  { latitude: 62.79126, longitude: 9.59762 },
  { latitude: 62.79442, longitude: 9.61702 },
] as const

const datasetPath = new URL(
  '../../public/data/routing/nerskogen.json',
  import.meta.url,
)
const supplementPath = new URL(
  '../../public/data/routing/nerskogen-fkb-corridor.json',
  import.meta.url,
)
const dataset = parseRoutingDataset(
  JSON.parse(readFileSync(datasetPath, 'utf8')),
)
const supplement = JSON.parse(
  readFileSync(supplementPath, 'utf8'),
) as FkbOrdinaryRoutingSupplement

describe('Nerskogen FKB ordinary routing corridor', () => {
  it('replaces the 837/844 OSM detour with ordinary FKB paths', () => {
    const osmGraph = loadRoutingDataset(dataset)
    const baseline = routeWaypoints(
      routePoints,
      osmGraph,
      dataset.metadata.bounds,
      100,
    )
    const supplementedGraph = addFkbOrdinaryRoutingSupplement(
      osmGraph,
      supplement,
    )
    const supplemented = routeWaypoints(
      routePoints,
      supplementedGraph,
      dataset.metadata.bounds,
      100,
    )

    expect(baseline.status).toBe('routed')
    expect(supplemented.status).toBe('routed')

    if (baseline.status === 'routed' && supplemented.status === 'routed') {
      expect(baseline.route.totalDistanceMeters).toBeGreaterThan(3_000)
      expect(supplemented.route.totalDistanceMeters).toBeLessThan(1_800)
      expect(supplemented.route.totalDistanceMeters).toBeLessThan(
        baseline.route.totalDistanceMeters / 2,
      )
      expect(
        supplemented.route.edges.some(({ id }) => id.startsWith('fkb:')),
      ).toBe(true)
      expect(supplemented.route.virtualEdgeCount).toBe(0)
    }
  })

  it('adds only ordinary path/track edges and verified sub-meter conflations', () => {
    const osmGraph = loadRoutingDataset(dataset)
    const supplementedGraph = addFkbOrdinaryRoutingSupplement(
      osmGraph,
      supplement,
    )
    const addedEdges = supplementedGraph.edges.filter(
      ({ id }) =>
        id.startsWith('fkb:') || id.startsWith('fkb-conflation:'),
    )

    expect(supplement.features).toHaveLength(55)
    expect(addedEdges.length).toBeGreaterThan(0)
    expect(
      addedEdges.every(({ edgeType }) =>
        ['path', 'track'].includes(edgeType),
      ),
    ).toBe(true)
    expect(
      addedEdges.some(({ edgeType }) => edgeType === 'virtual'),
    ).toBe(false)

    const conflationEdges = addedEdges.filter(({ id }) =>
      id.startsWith('fkb-conflation:'),
    )
    expect(conflationEdges).toHaveLength(20)
    expect(
      conflationEdges.every(({ distanceMeters }) => distanceMeters < 1),
    ).toBe(true)
  })
})
