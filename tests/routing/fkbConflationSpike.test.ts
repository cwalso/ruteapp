import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  buildFkbConflationSpikeGraph,
  countRouteEdgesBySource,
  getSpikeEdgeProvenance,
  type FkbSpikeSourceObject,
} from '../../scripts/routing/diagnostics/fkbConflationSpikeGraph'
import {
  loadRoutingDataset,
  parseRoutingDataset,
  type RuteAppRoutingDataset,
} from '../../src/routing/routingDataset'
import { routeWaypoints } from '../../src/routing/routeWaypoints'
import { calculateGeographicDistanceMeters } from '../../src/utils/geographicDistance'

const routePoints = [
  { latitude: 62.76968, longitude: 9.55381 },
  { latitude: 62.76532, longitude: 9.55131 },
] as const
const conflationToleranceMeters = 1
const userSnapDistanceMeters = 100
const datasetPath = new URL(
  '../../public/data/routing/nerskogen.json',
  import.meta.url,
)
const fixturePath = new URL(
  '../../scripts/routing/diagnostics/fixtures/fkbNerskogenGap.fixture.json',
  import.meta.url,
)
const dataset: RuteAppRoutingDataset = parseRoutingDataset(
  JSON.parse(readFileSync(datasetPath, 'utf8')),
)
const sourceObjects = JSON.parse(
  readFileSync(fixturePath, 'utf8'),
) as FkbSpikeSourceObject[]

describe('isolated Nerskogen OSM + FKB conflation spike', () => {
  it('keeps the pure OSM detour and produces a local hybrid route', () => {
    const osmGraph = loadRoutingDataset(dataset)
    const originalNodeCount = osmGraph.nodes.size
    const originalEdgeCount = osmGraph.edges.length
    const pureOsmResult = routeWaypoints(
      routePoints,
      osmGraph,
      dataset.metadata.bounds,
      userSnapDistanceMeters,
    )
    const spike = buildFkbConflationSpikeGraph(
      osmGraph,
      sourceObjects,
      conflationToleranceMeters,
    )
    const hybridResult = routeWaypoints(
      routePoints,
      spike.graph,
      dataset.metadata.bounds,
      userSnapDistanceMeters,
    )

    expect(pureOsmResult.status).toBe('routed')
    expect(hybridResult.status).toBe('routed')
    expect(osmGraph.nodes.size).toBe(originalNodeCount)
    expect(osmGraph.edges.length).toBe(originalEdgeCount)

    if (pureOsmResult.status === 'routed' && hybridResult.status === 'routed') {
      expect(pureOsmResult.route.totalDistanceMeters).toBeCloseTo(
        5049.273725,
        5,
      )
      expect(hybridResult.route.totalDistanceMeters).toBeCloseTo(
        720.253212,
        5,
      )
      expect(hybridResult.route.edges).toHaveLength(204)
      expect(hybridResult.route.totalDistanceMeters).toBeLessThan(
        pureOsmResult.route.totalDistanceMeters / 5,
      )
      expect(
        countRouteEdgesBySource(
          hybridResult.route.edges,
          spike.edgeProvenance,
        ),
      ).toEqual({
        osm: { path: 66, track: 0, road: 11 },
        fkb: { path: 127 },
        virtual: 0,
      })
      expect(hybridResult.route.nodeIds).toContain(
        'fkb-node:9.551408406527,62.768179590504',
      )
      expect(
        new Set(
          hybridResult.route.edges
            .map((edge) =>
              getSpikeEdgeProvenance(edge.id, spike.edgeProvenance),
            )
            .filter((provenance) => provenance?.kind === 'source')
            .map((provenance) => provenance!.sourceId),
        ),
      ).toEqual(
        new Set([
          'traktorveg_sti.1524706',
          'traktorveg_sti.1524755',
        ]),
      )
    }
  })

  it('normalizes only the selected FKB path geometry with tiny ordinary connections', () => {
    const osmGraph = loadRoutingDataset(dataset)
    const spike = buildFkbConflationSpikeGraph(
      osmGraph,
      sourceObjects,
      conflationToleranceMeters,
    )

    expect(spike.importedObjects).toHaveLength(2)
    expect(spike.conflationPoints).toHaveLength(2)
    expect(spike.skippedExactDuplicateSegments).toBe(0)
    expect(spike.graph.edges.some(({ edgeType }) => edgeType === 'virtual')).toBe(
      false,
    )
    expect(
      spike.importedObjects.map((sourceObject) => ({
        sourceId: sourceObject.sourceId,
        coordinateCount: sourceObject.importedGeometry.coordinates.length,
      })),
    ).toEqual([
      {
        sourceId: 'traktorveg_sti.1524706',
        coordinateCount: 86,
      },
      {
        sourceId: 'traktorveg_sti.1524755',
        coordinateCount: 41,
      },
    ])
    expect(
      spike.conflationPoints.map(({ distanceMeters }) => distanceMeters),
    ).toEqual([
      expect.closeTo(0.056922, 5),
      expect.closeTo(0.164548, 5),
    ])

    for (const sourceObject of spike.importedObjects) {
      expect(sourceObject.source).toBe('fkb')
      expect(sourceObject.sourceIdIsStable).toBe(false)
      expect(sourceObject.objectType).toBe('Veglenke')
      expect(sourceObject.typeVeg).toBe('sti')
      expect(sourceObject.importedGeometry.coordinates.length).toBeLessThanOrEqual(
        sourceObject.geometry.coordinates.length,
      )
    }

    for (const point of spike.conflationPoints) {
      expect(point.distanceMeters).toBeGreaterThan(0)
      expect(point.distanceMeters).toBeLessThanOrEqual(
        conflationToleranceMeters,
      )
    }

    for (const edge of spike.graph.edges) {
      const provenance = getSpikeEdgeProvenance(
        edge.id,
        spike.edgeProvenance,
      )

      if (!provenance) {
        continue
      }

      const fromNode = spike.graph.nodes.get(edge.fromNodeId)
      const toNode = spike.graph.nodes.get(edge.toNodeId)

      expect(edge.edgeType).toBe('path')
      expect(fromNode).toBeDefined()
      expect(toNode).toBeDefined()
      expect(edge.cost).toBe(edge.distanceMeters)
      expect(edge.distanceMeters + 1e-9).toBeGreaterThanOrEqual(
        calculateGeographicDistanceMeters(fromNode!, toNode!),
      )
    }
  })

  it('rejects a conflation tolerance below the observed source offset', () => {
    expect(() =>
      buildFkbConflationSpikeGraph(
        loadRoutingDataset(dataset),
        sourceObjects,
        0.01,
      ),
    ).toThrow('has no OSM connection within 0.01 m')
  })
})
