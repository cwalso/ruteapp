import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { FkbSpikeSourceObject } from '../../scripts/routing/diagnostics/fkbConflationSpikeGraph'
import {
  buildFkbValidationGraph,
  countValidationRouteEdgesBySource,
  getFkbValidationEdgeProvenance,
} from '../../scripts/routing/diagnostics/fkbValidationGraph'
import {
  loadRoutingDataset,
  parseRoutingDataset,
  type RuteAppRoutingDataset,
} from '../../src/routing/routingDataset'
import { routeWaypoints } from '../../src/routing/routeWaypoints'
import { calculateGeographicDistanceMeters } from '../../src/utils/geographicDistance'

type FkbValidationFixtureCase = {
  caseId: string
  expectation: 'positive' | 'overlap-negative'
  sourceObject: FkbSpikeSourceObject
}

const conflationToleranceMeters = 1
const userSnapDistanceMeters = 100
const datasetPath = new URL(
  '../../public/data/routing/nerskogen.json',
  import.meta.url,
)
const fixturePath = new URL(
  '../../scripts/routing/diagnostics/fixtures/fkbNerskogenValidation.fixture.json',
  import.meta.url,
)
const dataset: RuteAppRoutingDataset = parseRoutingDataset(
  JSON.parse(readFileSync(datasetPath, 'utf8')),
)
const fixtureCases = JSON.parse(
  readFileSync(fixturePath, 'utf8'),
) as FkbValidationFixtureCase[]

const expectedRoutes = {
  'east-long-path': {
    osmMeters: 1742.0,
    hybridMeters: 1005.1,
    fkbEdgeType: 'path',
  },
  'southwest-short-link': {
    osmMeters: 753.7,
    hybridMeters: 56.9,
    fkbEdgeType: 'path',
  },
  'northwest-path-loop': {
    osmMeters: 340.8,
    hybridMeters: 102.9,
    fkbEdgeType: 'path',
  },
  'central-road-link': {
    osmMeters: 208.8,
    hybridMeters: 170.2,
    fkbEdgeType: 'path',
  },
  'overlapping-tractor-road': {
    osmMeters: 708.4,
    hybridMeters: 708.4,
    fkbEdgeType: 'track',
  },
} as const

describe('independent Nerskogen FKB validation cases', () => {
  it.each(fixtureCases)(
    'reproduces $caseId without mutating the OSM graph',
    (fixtureCase) => {
      const osmGraph = loadRoutingDataset(dataset)
      const originalNodeCount = osmGraph.nodes.size
      const originalEdgeCount = osmGraph.edges.length
      const spike = buildFkbValidationGraph(
        osmGraph,
        fixtureCase.sourceObject,
        conflationToleranceMeters,
      )
      const routePoints = spike.conflationPoints.map(({ osmPosition }) => ({
        longitude: osmPosition.longitude,
        latitude: osmPosition.latitude,
      }))
      const pureOsmResult = routeWaypoints(
        routePoints,
        osmGraph,
        dataset.metadata.bounds,
        userSnapDistanceMeters,
      )
      const hybridResult = routeWaypoints(
        routePoints,
        spike.graph,
        dataset.metadata.bounds,
        userSnapDistanceMeters,
      )
      const expected =
        expectedRoutes[fixtureCase.caseId as keyof typeof expectedRoutes]

      expect(expected).toBeDefined()
      expect(pureOsmResult.status).toBe('routed')
      expect(hybridResult.status).toBe('routed')
      expect(osmGraph.nodes.size).toBe(originalNodeCount)
      expect(osmGraph.edges.length).toBe(originalEdgeCount)
      expect(spike.conflationPoints).toHaveLength(2)
      expect(
        spike.conflationPoints.every(
          ({ distanceMeters }) =>
            distanceMeters <= conflationToleranceMeters,
        ),
      ).toBe(true)
      expect(spike.graph.edges.some(({ edgeType }) => edgeType === 'virtual')).toBe(
        false,
      )

      if (
        expected &&
        pureOsmResult.status === 'routed' &&
        hybridResult.status === 'routed'
      ) {
        expect(pureOsmResult.route.totalDistanceMeters).toBeCloseTo(
          expected.osmMeters,
          1,
        )
        expect(hybridResult.route.totalDistanceMeters).toBeCloseTo(
          expected.hybridMeters,
          1,
        )
        const sourceCounts = countValidationRouteEdgesBySource(
          hybridResult.route.edges,
          spike.edgeProvenance,
        )

        expect(sourceCounts.virtual).toBe(0)

        if (fixtureCase.expectation === 'positive') {
          expect(hybridResult.route.totalDistanceMeters).toBeLessThan(
            pureOsmResult.route.totalDistanceMeters,
          )
          expect(sourceCounts.fkb[expected.fkbEdgeType]).toBeGreaterThan(0)
        } else {
          expect(hybridResult.route.totalDistanceMeters).toBeCloseTo(
            pureOsmResult.route.totalDistanceMeters,
            1,
          )
          expect(sourceCounts.fkb.track).toBe(0)
        }
      }
    },
  )

  it('maps FKB sti to path and traktorveg to track with physical cost', () => {
    const osmGraph = loadRoutingDataset(dataset)

    for (const fixtureCase of fixtureCases) {
      const spike = buildFkbValidationGraph(
        osmGraph,
        fixtureCase.sourceObject,
        conflationToleranceMeters,
      )
      const expectedEdgeType =
        fixtureCase.sourceObject.typeVeg === 'sti' ? 'path' : 'track'

      for (const edge of spike.graph.edges) {
        const provenance = getFkbValidationEdgeProvenance(
          edge.id,
          spike.edgeProvenance,
        )

        if (!provenance) {
          continue
        }

        const fromNode = spike.graph.nodes.get(edge.fromNodeId)
        const toNode = spike.graph.nodes.get(edge.toNodeId)
        expect(edge.edgeType).toBe(expectedEdgeType)
        expect(edge.cost).toBe(edge.distanceMeters)
        expect(fromNode).toBeDefined()
        expect(toNode).toBeDefined()
        expect(edge.distanceMeters + 1e-9).toBeGreaterThanOrEqual(
          calculateGeographicDistanceMeters(fromNode!, toNode!),
        )
      }
    }
  })

  it('rejects endpoint conflation outside the explicit tolerance', () => {
    const fixtureCase = fixtureCases.find(
      ({ caseId }) => caseId === 'east-long-path',
    )

    expect(fixtureCase).toBeDefined()
    expect(() =>
      buildFkbValidationGraph(
        loadRoutingDataset(dataset),
        fixtureCase!.sourceObject,
        0.05,
      ),
    ).toThrow('has no OSM connection within 0.05 m')
  })
})
