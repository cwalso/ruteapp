import { describe, expect, it } from 'vitest'
import { calculateGeographicDistanceMeters } from '../utils/geographicDistance'
import { createRoutingGraph } from './routingGraph'
import type { RoutingEdge, RoutingNode } from './routingTypes'
import {
  findSameComponentShortcutCandidates,
  type SameComponentShortcutConfig,
} from './sameComponentShortcutCandidates'

const config: SameComponentShortcutConfig = {
  minimumDirectDistanceMeters: 10,
  maximumDirectDistanceMeters: 200,
  minimumOrdinaryNetworkDistanceMeters: 500,
  minimumDetourRatio: 5,
  deduplicationRadiusMeters: 30,
}

describe('findSameComponentShortcutCandidates', () => {
  it('finds a short direct gap with a large detour inside one component', () => {
    const result = findSameComponentShortcutCandidates(
      createDetourGraph(),
      config,
    )
    const candidate = findCandidate(result.candidates, 'a:f', 'b:f')

    expect(candidate).toBeDefined()
    expect(candidate?.directDistanceMeters).toBeCloseTo(50, 0)
    expect(candidate?.ordinaryNetworkDistanceMeters).toBeGreaterThan(1_500)
    expect(candidate?.detourRatio).toBeGreaterThan(30)
  })

  it('does not mix in component-gap candidates', () => {
    const nodes = [
      node('a0', 0, 0),
      node('a1', 100, 0),
      node('b0', 0, 50),
      node('b1', 100, 50),
    ]
    const graph = createRoutingGraph(nodes, [
      ...twoWayEdges('a', nodes[0], nodes[1]),
      ...twoWayEdges('b', nodes[2], nodes[3]),
    ])

    expect(
      findSameComponentShortcutCandidates(graph, config).candidates,
    ).toEqual([])
  })

  it('does not compare a physical edge with itself', () => {
    const nodes = [node('a0', 0, 0), node('a1', 100, 0)]
    const graph = createRoutingGraph(
      nodes,
      twoWayEdges('a', nodes[0], nodes[1]),
    )
    const result = findSameComponentShortcutCandidates(graph, config)

    expect(result.physicalSegmentCount).toBe(1)
    expect(result.geographicPairsEvaluated).toBe(0)
    expect(result.candidates).toEqual([])
  })

  it('filters edges that share a node', () => {
    const nodes = [
      node('a', 0, 0),
      node('junction', 100, 0),
      node('b', 100, 50),
    ]
    const graph = createRoutingGraph(nodes, [
      ...twoWayEdges('first', nodes[0], nodes[1]),
      ...twoWayEdges('second', nodes[1], nodes[2]),
    ])
    const result = findSameComponentShortcutCandidates(graph, {
      ...config,
      minimumOrdinaryNetworkDistanceMeters: 0,
      minimumDetourRatio: 1.01,
    })

    expect(result.networkCalculations).toBe(0)
    expect(result.candidates).toEqual([])
  })

  it('filters nearby edges with a short ordinary network route', () => {
    const result = findSameComponentShortcutCandidates(
      createLocallyConnectedGraph(),
      config,
    )

    expect(result.candidates).toEqual([])
  })

  it('filters a network distance below the configured minimum', () => {
    const result = findSameComponentShortcutCandidates(
      createLocallyConnectedGraph(),
      {
        ...config,
        minimumDetourRatio: 1.01,
      },
    )

    expect(result.candidates).toEqual([])
  })

  it('filters a detour ratio below the configured threshold', () => {
    const result = findSameComponentShortcutCandidates(
      createLocallyConnectedGraph(),
      {
        ...config,
        minimumOrdinaryNetworkDistanceMeters: 0,
        minimumDetourRatio: 5,
      },
    )

    expect(result.candidates).toEqual([])
  })

  it('creates deterministic candidate IDs and ordering', () => {
    const graph = createDetourGraph()
    const first = findSameComponentShortcutCandidates(graph, config)
    const second = findSameComponentShortcutCandidates(graph, config)

    expect(first.candidates).toEqual(second.candidates)
    expect(first.candidates[0].candidateId).toMatch(
      /^same-component-shortcut:/,
    )
  })

  it('deduplicates nearby edge pairs that describe the same local gap', () => {
    const result = findSameComponentShortcutCandidates(
      createClusteredDetourGraph(),
      { ...config, deduplicationRadiusMeters: 80 },
    )

    expect(result.candidatesBeforeDeduplication).toBeGreaterThan(
      result.candidates.length,
    )
  })

  it('measures only the ordinary graph when virtual edges are present', () => {
    const ordinaryGraph = createDetourGraph()
    const virtualEdges = twoWayEdges(
      'existing-virtual',
      getNode(ordinaryGraph, 'a0'),
      getNode(ordinaryGraph, 'b0'),
      'virtual',
    )
    const graphWithVirtual = createRoutingGraph(
      [...ordinaryGraph.nodes.values()],
      [...ordinaryGraph.edges, ...virtualEdges],
    )
    const ordinaryResult = findSameComponentShortcutCandidates(
      ordinaryGraph,
      config,
    )
    const virtualResult = findSameComponentShortcutCandidates(
      graphWithVirtual,
      config,
    )

    expect(virtualResult.candidates).toEqual(ordinaryResult.candidates)
  })

  it('uses actual edge-interior connection points', () => {
    const result = findSameComponentShortcutCandidates(
      createDetourGraph(),
      config,
    )
    const candidate = findCandidate(result.candidates, 'a:f', 'b:f')

    expect(candidate).toBeDefined()
    expect(candidate?.fromPositionAlongEdge).toBeCloseTo(0.5, 6)
    expect(candidate?.toPositionAlongEdge).toBeCloseTo(0.5, 6)
    expect(candidate?.fromCoordinate.longitude).toBeCloseTo(
      node('midpoint', 50, 0).longitude,
      8,
    )
  })
})

function createDetourGraph() {
  const nodes = [
    node('a0', 0, 0),
    node('a1', 100, 0),
    node('far0', 1_000, 0),
    node('far1', 1_000, 50),
    node('b1', 100, 50),
    node('b0', 0, 50),
  ]

  return createRoutingGraph(nodes, [
    ...twoWayEdges('a', nodes[0], nodes[1], 'path'),
    ...twoWayEdges('outbound', nodes[1], nodes[2], 'road'),
    ...twoWayEdges('turn', nodes[2], nodes[3], 'road'),
    ...twoWayEdges('inbound', nodes[3], nodes[4], 'road'),
    ...twoWayEdges('b', nodes[4], nodes[5], 'track'),
  ])
}

function createLocallyConnectedGraph() {
  const nodes = [
    node('a0', 0, 0),
    node('a1', 100, 0),
    node('b1', 100, 50),
    node('b0', 0, 50),
  ]

  return createRoutingGraph(nodes, [
    ...twoWayEdges('a', nodes[0], nodes[1]),
    ...twoWayEdges('right', nodes[1], nodes[2]),
    ...twoWayEdges('b', nodes[2], nodes[3]),
    ...twoWayEdges('left', nodes[3], nodes[0]),
  ])
}

function createClusteredDetourGraph() {
  const graph = createDetourGraph()
  const extraNodes = [
    node('a2', 200, 0),
    node('b2', 200, 50),
  ]

  return createRoutingGraph(
    [...graph.nodes.values(), ...extraNodes],
    [
      ...graph.edges,
      ...twoWayEdges('a-extra', getNode(graph, 'a1'), extraNodes[0], 'path'),
      ...twoWayEdges('b-extra', getNode(graph, 'b1'), extraNodes[1], 'track'),
    ],
  )
}

function findCandidate(
  candidates: ReturnType<
    typeof findSameComponentShortcutCandidates
  >['candidates'],
  firstEdgeId: string,
  secondEdgeId: string,
) {
  return candidates.find(
    ({ fromEdgeId, toEdgeId }) =>
      (fromEdgeId === firstEdgeId && toEdgeId === secondEdgeId) ||
      (fromEdgeId === secondEdgeId && toEdgeId === firstEdgeId),
  )
}

function getNode(graph: ReturnType<typeof createRoutingGraph>, nodeId: string) {
  const routingNode = graph.nodes.get(nodeId)

  if (!routingNode) {
    throw new Error(`Missing fixture node: ${nodeId}`)
  }

  return routingNode
}

function node(id: string, xMeters: number, yMeters: number): RoutingNode {
  const metersPerDegree = 111_195.0802335329

  return {
    id,
    longitude: xMeters / metersPerDegree,
    latitude: yMeters / metersPerDegree,
  }
}

function twoWayEdges(
  id: string,
  from: RoutingNode,
  to: RoutingNode,
  edgeType: RoutingEdge['edgeType'] = 'path',
): RoutingEdge[] {
  return [
    edge(`${id}:f`, from, to, edgeType),
    edge(`${id}:r`, to, from, edgeType),
  ]
}

function edge(
  id: string,
  from: RoutingNode,
  to: RoutingNode,
  edgeType: RoutingEdge['edgeType'],
): RoutingEdge {
  const distanceMeters = calculateGeographicDistanceMeters(from, to)

  return {
    id,
    fromNodeId: from.id,
    toNodeId: to.id,
    distanceMeters,
    cost: edgeType === 'virtual' ? distanceMeters * 3 : distanceMeters,
    edgeType,
  }
}
