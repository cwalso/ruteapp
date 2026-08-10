import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import { createElevationProfile } from '../../src/elevation/createElevationProfile'
import { elevationConfig } from '../../src/elevation/elevationConfig'
import { sampleRouteGeometry } from '../../src/elevation/sampleRouteGeometry'
import { estimateWalkingTimeMinutes } from '../../src/elevation/walkingTime'
import { createSameComponentShortcutDisplayId } from '../../src/map/sameComponentShortcutDebugData'
import { findRoute } from '../../src/routing/aStar'
import { isSameComponentShortcutDevAllowed } from '../../src/routing/sameComponentShortcutDevAllowlist'
import { sameComponentShortcutDevCandidates } from '../../src/routing/sameComponentShortcutDevCandidates'
import { createGraphWithApprovedSameComponentShortcuts } from '../../src/routing/sameComponentShortcutMaterialization'
import {
  loadRoutingDataset,
  parseRoutingDataset,
} from '../../src/routing/routingDataset'
import {
  routeWaypoints,
  type WaypointRoutingResult,
} from '../../src/routing/routeWaypoints'
import type { RoutingGraph } from '../../src/routing/routingTypes'
import { virtualConnectionConfig } from '../../src/routing/virtualConnectionConfig'
import { createGraphWithVirtualConnections } from '../../src/routing/virtualConnections'

const datasetPath = new URL(
  '../../public/data/routing/nerskogen.json',
  import.meta.url,
)
const dataset = parseRoutingDataset(
  JSON.parse(readFileSync(datasetPath, 'utf8')),
)
const ordinaryGraph = loadRoutingDataset(dataset)
const derivedGraphStartedAt = performance.now()
const baseline = createGraphWithVirtualConnections(
  ordinaryGraph,
  virtualConnectionConfig,
)
const derivedGraphBuildMilliseconds = performance.now() - derivedGraphStartedAt
const materializationStartedAt = performance.now()
const withShortcuts = createGraphWithApprovedSameComponentShortcuts(
  ordinaryGraph,
  baseline.graph,
  baseline.snapGraph,
  sameComponentShortcutDevCandidates,
  virtualConnectionConfig.virtualCostMultiplier,
)
const shortcutMaterializationMilliseconds =
  performance.now() - materializationStartedAt

const rejectedCandidateId =
  'same-component-shortcut:1544362855:10:f:0.838924:299251020:50:f:0.000000'
const ordinaryPathCrossingCandidateId =
  'same-component-shortcut:80885919:1:f:1.000000:1092432962:1:f:1.000000'

describe('approved same-component shortcut development experiment', () => {
  it('materializes exactly the four full-ID allowlisted candidates as virtual edges', () => {
    expect(withShortcuts.candidates).toHaveLength(4)
    expect(withShortcuts.candidates.map(({ candidateId }) => candidateId)).toEqual(
      sameComponentShortcutDevCandidates.map(({ candidateId }) => candidateId),
    )
    expect(
      withShortcuts.candidates.map(({ candidateId }) =>
        createSameComponentShortcutDisplayId(candidateId),
      ),
    ).toEqual([
      'SC-C4239590',
      'SC-9F0B4DCE',
      'SC-D959F701',
      'SC-CF2E56FE',
    ])

    for (const candidate of withShortcuts.candidates) {
      expect(isSameComponentShortcutDevAllowed(candidate.candidateId)).toBe(true)
      expect(candidate.virtualOrigin).toBe('same-component-shortcut')
      expect(candidate.cost).toBeCloseTo(
        candidate.directDistanceMeters *
          virtualConnectionConfig.virtualCostMultiplier,
        8,
      )

      for (const edgeId of candidate.virtualEdgeIds) {
        expect(
          withShortcuts.graph.edges.find(({ id }) => id === edgeId),
        ).toMatchObject({
          edgeType: 'virtual',
          distanceMeters: candidate.directDistanceMeters,
          cost: candidate.cost,
        })
      }
    }
  })

  it('does not materialize SC-E6B34D30 or SC-F7D90B7B', () => {
    const unapprovedCandidates = [
      rejectedCandidateId,
      ordinaryPathCrossingCandidateId,
    ].map((candidateId) => ({
      ...sameComponentShortcutDevCandidates[0],
      candidateId,
    }))
    const result = createGraphWithApprovedSameComponentShortcuts(
      ordinaryGraph,
      baseline.graph,
      baseline.snapGraph,
      [...sameComponentShortcutDevCandidates, ...unapprovedCandidates],
      virtualConnectionConfig.virtualCostMultiplier,
    )

    expect(isSameComponentShortcutDevAllowed(rejectedCandidateId)).toBe(false)
    expect(
      isSameComponentShortcutDevAllowed(ordinaryPathCrossingCandidateId),
    ).toBe(false)
    expect(result.candidates).toHaveLength(4)
    expect(
      result.graph.edges.some(
        ({ id }) =>
          id.includes(rejectedCandidateId) ||
          id.includes(ordinaryPathCrossingCandidateId),
      ),
    ).toBe(false)
  })

  it('does not mutate the ordinary or baseline derived graphs', () => {
    expect(ordinaryGraph.nodes.size).toBe(13_341)
    expect(ordinaryGraph.edges).toHaveLength(26_806)
    expect(ordinaryGraph.edges.some(({ edgeType }) => edgeType === 'virtual')).toBe(
      false,
    )
    expect(
      baseline.graph.edges.some(({ id }) => id.startsWith('dev-virtual:')),
    ).toBe(false)
    expect(
      baseline.snapGraph.edges.some(({ edgeType }) => edgeType === 'virtual'),
    ).toBe(false)
  })

  it('splits the approved edge-interior endpoint proportionally in both directions', () => {
    const candidate = getCandidate('SC-9F0B4DCE')
    const originalEdge = getEdge(ordinaryGraph, candidate.fromEdgeId)
    const splitForwardEdges = withShortcuts.snapGraph.edges.filter(
      ({ id }) => id.startsWith(`${candidate.fromEdgeId}:route-split:`),
    )
    const reverseEdge = ordinaryGraph.edges.find(
      (edge) =>
        edge.fromNodeId === originalEdge.toNodeId &&
        edge.toNodeId === originalEdge.fromNodeId &&
        edge.edgeType === originalEdge.edgeType,
    )

    expect(candidate.fromPositionAlongEdge).toBeGreaterThan(0)
    expect(candidate.fromPositionAlongEdge).toBeLessThan(1)
    expect(splitForwardEdges).toHaveLength(2)
    expect(
      splitForwardEdges.reduce((sum, edge) => sum + edge.distanceMeters, 0),
    ).toBeCloseTo(originalEdge.distanceMeters, 8)
    expect(
      splitForwardEdges.reduce((sum, edge) => sum + edge.cost, 0),
    ).toBeCloseTo(originalEdge.cost, 8)
    expect(splitForwardEdges.every(({ edgeType }) => edgeType === 'path')).toBe(
      true,
    )
    expect(reverseEdge).toBeDefined()
    expect(
      withShortcuts.snapGraph.edges.filter(({ id }) =>
        id.startsWith(`${reverseEdge!.id}:route-split:`),
      ),
    ).toHaveLength(2)
  })

  for (const fixtureCandidate of sameComponentShortcutDevCandidates) {
    const shortcutId = createSameComponentShortcutDisplayId(
      fixtureCandidate.candidateId,
    )

    it(`${shortcutId} is unavailable OFF and selected by A* ON`, () => {
      const candidate = getCandidate(shortcutId)
      const off = routeCandidateEndpoints(
        candidate,
        baseline.graph,
        baseline.snapGraph,
      )
      const aStarStartedAt = performance.now()
      const on = routeCandidateEndpoints(
        candidate,
        withShortcuts.graph,
        withShortcuts.snapGraph,
      )
      const aStarMilliseconds = performance.now() - aStarStartedAt

      expect(off.route.edges.some(({ id }) => id.startsWith('dev-virtual:'))).toBe(
        false,
      )
      expect(
        on.route.edges.some(({ id }) => candidate.virtualEdgeIds.includes(id)),
      ).toBe(true)
      expect(on.route.virtualDistanceMeters).toBeGreaterThanOrEqual(
        candidate.directDistanceMeters,
      )
      expect(on.route.totalDistanceMeters).toBeLessThan(
        off.route.totalDistanceMeters,
      )

      console.info(
        `${shortcutId}: OFF ${formatRoute(off)}, ON ${formatRoute(on)}, ` +
          `shortcut ${candidate.directDistanceMeters.toFixed(1)} m, ` +
          `reduksjon ${percentageReduction(off, on).toFixed(1)} %, ` +
          `waypoint A* ${aStarMilliseconds.toFixed(2)} ms`,
      )
    })
  }

  it('merges A → via → B with one approved shortcut and consistent elevation/time inputs', () => {
    const candidate = getCandidate('SC-C4239590')
    const toEdge = getEdge(ordinaryGraph, candidate.toEdgeId)
    const finalNode = ordinaryGraph.nodes.get(toEdge.fromNodeId)

    expect(finalNode).toBeDefined()

    const result = requireRouted(
      routeWaypoints(
        [candidate.fromCoordinate, candidate.toCoordinate, finalNode!],
        withShortcuts.graph,
        dataset.metadata.bounds,
        100,
        withShortcuts.snapGraph,
      ),
    )
    const viaNodeId = result.snappedPoints[1].node.id
    const segments = result.route.edges.map((edge, edgeIndex) => ({
      from: result.routeNodes[edgeIndex],
      to: result.routeNodes[edgeIndex + 1],
      distanceMeters: edge.distanceMeters,
      edgeType: edge.edgeType,
    }))
    const samples = sampleRouteGeometry(
      segments,
      elevationConfig.sampleIntervalMeters,
    )
    const profile = createElevationProfile(
      samples,
      samples.map((_, index) => 700 + index * 2),
      elevationConfig.ascentNoiseThresholdMeters,
    )
    const walkingTimeMinutes = estimateWalkingTimeMinutes(
      {
        distanceMeters: profile.totalDistanceMeters,
        totalAscentMeters: profile.totalAscentMeters,
        virtualDistanceMeters: result.route.virtualDistanceMeters,
      },
      elevationConfig.walkingTime,
    )
    const virtualEdgeIndex = result.route.edges.findIndex(({ id }) =>
      candidate.virtualEdgeIds.includes(id),
    )
    const virtualEnd = result.routeNodes[virtualEdgeIndex + 1]

    expect(result.route.nodeIds.filter((nodeId) => nodeId === viaNodeId)).toHaveLength(
      1,
    )
    expect(result.route.virtualEdgeCount).toBe(1)
    expect(result.route.virtualDistanceMeters).toBeCloseTo(
      candidate.directDistanceMeters,
      8,
    )
    expect(profile.totalDistanceMeters).toBeCloseTo(
      result.route.totalDistanceMeters,
      8,
    )
    expect(
      samples.some(
        ({ longitude, latitude }) =>
          longitude === virtualEnd.longitude && latitude === virtualEnd.latitude,
      ),
    ).toBe(true)
    expect(walkingTimeMinutes).toBeGreaterThan(0)

    console.info(
      `Via SC-C4239590: ${formatRoute(result)}, ${samples.length} høydepunkt, ` +
        `${profile.totalAscentMeters.toFixed(1)} m stigning, ` +
        `${walkingTimeMinutes.toFixed(1)} min gangtid`,
    )
  })

  it('reports controlled graph-build, materialization and direct A* timings', () => {
    const candidate = getCandidate('SC-C4239590')
    const aStarStartedAt = performance.now()
    const route = findRoute(
      withShortcuts.graph,
      candidate.fromNodeId,
      candidate.toNodeId,
    )
    const aStarMilliseconds = performance.now() - aStarStartedAt

    expect(route).not.toBeNull()
    expect(route?.edges.some(({ id }) => candidate.virtualEdgeIds.includes(id))).toBe(
      true,
    )

    console.info(
      `Ytelse: derived graph ${derivedGraphBuildMilliseconds.toFixed(1)} ms, ` +
        `fire shortcuts ${shortcutMaterializationMilliseconds.toFixed(1)} ms, ` +
        `direkte A* ${aStarMilliseconds.toFixed(2)} ms`,
    )
  })
})

function routeCandidateEndpoints(
  candidate: ReturnType<typeof getCandidate>,
  graph: RoutingGraph,
  snapGraph: RoutingGraph,
) {
  return requireRouted(
    routeWaypoints(
      [candidate.fromCoordinate, candidate.toCoordinate],
      graph,
      dataset.metadata.bounds,
      100,
      snapGraph,
    ),
  )
}

function getCandidate(shortcutId: string) {
  const candidate = withShortcuts.candidates.find(
    ({ candidateId }) =>
      createSameComponentShortcutDisplayId(candidateId) === shortcutId,
  )

  if (!candidate) {
    throw new Error(`Missing materialized candidate: ${shortcutId}`)
  }

  return candidate
}

function requireRouted(result: WaypointRoutingResult) {
  if (result.status !== 'routed') {
    throw new Error(`Expected routed result, received ${result.status}`)
  }

  return result
}

function getEdge(graph: RoutingGraph, edgeId: string) {
  const edge = graph.edges.find(({ id }) => id === edgeId)

  if (!edge) {
    throw new Error(`Missing routing edge: ${edgeId}`)
  }

  return edge
}

function formatRoute(result: ReturnType<typeof requireRouted>) {
  return `${result.route.totalDistanceMeters.toFixed(1)} m, ` +
    `${result.route.virtualEdgeCount} virtual, ` +
    `${result.route.virtualDistanceMeters.toFixed(1)} m virtual`
}

function percentageReduction(
  off: ReturnType<typeof requireRouted>,
  on: ReturnType<typeof requireRouted>,
) {
  return (
    ((off.route.totalDistanceMeters - on.route.totalDistanceMeters) /
      off.route.totalDistanceMeters) *
    100
  )
}
