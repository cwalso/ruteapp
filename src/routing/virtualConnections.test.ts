import { describe, expect, it } from 'vitest'
import { findRoute } from './aStar'
import { routeWaypoints } from './routeWaypoints'
import { createRoutingGraph } from './routingGraph'
import type { RoutingEdge, RoutingNode } from './routingTypes'
import { createGraphWithVirtualConnections } from './virtualConnections'
import { calculateGeographicDistanceMeters } from '../utils/geographicDistance'

const config = {
  maxVirtualDistanceMeters: 200,
  virtualCostMultiplier: 3,
}

describe('createGraphWithVirtualConnections', () => {
  it('makes disconnected ordinary components routable through an explicit virtual edge', () => {
    const ordinaryGraph = createParallelComponents(100)

    expect(findRoute(ordinaryGraph, 'a0', 'b0')).toBeNull()

    const result = createGraphWithVirtualConnections(ordinaryGraph, config)
    const route = findRoute(result.graph, 'a0', 'b0')

    expect(result.candidates).toHaveLength(1)
    expect(route?.edges.some(({ edgeType }) => edgeType === 'virtual')).toBe(
      true,
    )
  })

  it('does not create a candidate beyond the configured maximum distance', () => {
    const result = createGraphWithVirtualConnections(
      createParallelComponents(201),
      config,
    )

    expect(result.candidates).toEqual([])
    expect(result.componentCountBefore).toBe(result.componentCountAfter)
  })

  it('snaps an edge-to-edge candidate to interior points and splits two-way edges', () => {
    const ordinaryGraph = createParallelComponents(80)
    const originalNodeIds = [...ordinaryGraph.nodes.keys()]
    const originalEdgeIds = ordinaryGraph.edges.map(({ id }) => id)
    const result = createGraphWithVirtualConnections(ordinaryGraph, config)
    const candidate = result.candidates[0]

    expect(candidate.from.positionAlongEdge).toBeCloseTo(0.5, 6)
    expect(candidate.to.positionAlongEdge).toBeCloseTo(0.5, 6)
    expect(candidate.from.nodeId).toMatch(/^route-snap-/)
    expect(candidate.to.nodeId).toMatch(/^route-snap-/)
    expect(
      result.snapGraph.edges.filter(({ edgeType }) => edgeType !== 'virtual'),
    ).toHaveLength(8)
    expect(result.graph.edges.filter(({ edgeType }) => edgeType === 'virtual')).toHaveLength(2)
    expect(
      result.graph.edges.some(
        (edge) =>
          edge.edgeType === 'virtual' &&
          edge.fromNodeId === candidate.from.nodeId &&
          edge.toNodeId === candidate.to.nodeId,
      ),
    ).toBe(true)
    expect(
      result.graph.edges.some(
        (edge) =>
          edge.edgeType === 'virtual' &&
          edge.fromNodeId === candidate.to.nodeId &&
          edge.toNodeId === candidate.from.nodeId,
      ),
    ).toBe(true)

    expect([...ordinaryGraph.nodes.keys()]).toEqual(originalNodeIds)
    expect(ordinaryGraph.edges.map(({ id }) => id)).toEqual(originalEdgeIds)
  })

  it('preserves one-way direction when an ordinary edge is split', () => {
    const nodes = [
      node('a0', 0, 0),
      node('a1', 100, 0),
      node('b0', 0, 70),
      node('b1', 100, 70),
    ]
    const graph = createRoutingGraph(nodes, [
      directedEdge('a-forward', nodes[0], nodes[1], 'path'),
      directedEdge('b-forward', nodes[2], nodes[3], 'track'),
    ])
    const result = createGraphWithVirtualConnections(graph, config)
    const candidate = result.candidates[0]

    expect(findRoute(result.snapGraph, 'a0', 'a1')).not.toBeNull()
    expect(findRoute(result.snapGraph, 'a1', 'a0')).toBeNull()
    expect(candidate.from.positionAlongEdge).toBeGreaterThan(0)
    expect(candidate.from.positionAlongEdge).toBeLessThan(1)
  })

  it('keeps edge-to-node endpoints as existing nodes', () => {
    const nodes = [
      node('a0', 0, 0),
      node('a1', 100, 0),
      node('b0', 50, 60),
      node('b1', 50, 110),
    ]
    const graph = createRoutingGraph(nodes, [
      ...twoWayEdges('a', nodes[0], nodes[1], 'path'),
      ...twoWayEdges('b', nodes[2], nodes[3], 'track'),
    ])
    const result = createGraphWithVirtualConnections(graph, config)
    const candidate = result.candidates[0]
    const endpointPositions = [
      candidate.from.positionAlongEdge,
      candidate.to.positionAlongEdge,
    ]

    expect(endpointPositions).toContain(0)
    expect(endpointPositions.some((position) => position > 0 && position < 1)).toBe(true)
    expect([candidate.from.nodeId, candidate.to.nodeId]).toContain('b0')
  })

  it('deduplicates directed edge pairs to one candidate per component pair', () => {
    const result = createGraphWithVirtualConnections(
      createParallelComponents(50),
      config,
    )

    expect(result.candidates).toHaveLength(1)
    expect(result.graph.edges.filter(({ edgeType }) => edgeType === 'virtual')).toHaveLength(2)
  })

  it('uses the configured cost multiplier and preserves the graph cost invariant', () => {
    const result = createGraphWithVirtualConnections(
      createParallelComponents(100),
      config,
    )
    const candidate = result.candidates[0]

    expect(candidate.cost).toBeCloseTo(candidate.distanceMeters * 3, 8)
    for (const edge of result.graph.edges) {
      expect(edge.cost).toBeGreaterThanOrEqual(edge.distanceMeters)
    }
  })

  it('creates deterministic candidates between several nearby components', () => {
    const nodes = [
      node('a0', 0, 0),
      node('a1', 100, 0),
      node('b0', 0, 70),
      node('b1', 100, 70),
      node('c0', 0, 140),
      node('c1', 100, 140),
    ]
    const graph = createRoutingGraph(nodes, [
      ...twoWayEdges('a', nodes[0], nodes[1], 'path'),
      ...twoWayEdges('b', nodes[2], nodes[3], 'track'),
      ...twoWayEdges('c', nodes[4], nodes[5], 'road'),
    ])

    const first = createGraphWithVirtualConnections(graph, config)
    const second = createGraphWithVirtualConnections(graph, config)

    expect(first.candidates).toHaveLength(3)
    expect(first.candidates).toEqual(second.candidates)
    expect(first.componentCountBefore).toBe(3)
    expect(first.componentCountAfter).toBe(1)
  })

  it('does not create shortcuts inside one ordinary connected component', () => {
    const nodes = [
      node('a', 0, 0),
      node('detour', 500, 500),
      node('b', 20, 0),
    ]
    const graph = createRoutingGraph(nodes, [
      ...twoWayEdges('a-detour', nodes[0], nodes[1], 'path'),
      ...twoWayEdges('detour-b', nodes[1], nodes[2], 'path'),
    ])

    const result = createGraphWithVirtualConnections(graph, config)

    expect(result.candidates).toEqual([])
  })

  it('reports virtual edge count and distance for waypoint routing', () => {
    const result = createGraphWithVirtualConnections(
      createParallelComponents(75),
      config,
    )
    const routed = routeWaypoints(
      [node('start', 0, 0), node('end', 0, 75)],
      result.graph,
      { west: -1, south: -1, east: 1, north: 1 },
      100,
      result.snapGraph,
    )

    expect(routed.status).toBe('routed')
    if (routed.status !== 'routed') {
      throw new Error('Expected routed result')
    }

    expect(routed.route.virtualEdgeCount).toBe(1)
    expect(routed.route.virtualDistanceMeters).toBeCloseTo(75, 0)
    expect(routed.route.totalCost).toBeGreaterThan(
      routed.route.totalDistanceMeters,
    )
  })

  it('combines ordinary and virtual edges across via-point segments', () => {
    const result = createGraphWithVirtualConnections(
      createParallelComponents(75),
      config,
    )
    const routed = routeWaypoints(
      [node('start', 0, 0), node('via', 100, 0), node('end', 100, 75)],
      result.graph,
      { west: -1, south: -1, east: 1, north: 1 },
      100,
      result.snapGraph,
    )

    expect(routed.status).toBe('routed')
    if (routed.status !== 'routed') {
      throw new Error('Expected routed via result')
    }

    expect(routed.route.edges.some(({ edgeType }) => edgeType === 'path')).toBe(
      true,
    )
    expect(
      routed.route.edges.some(({ edgeType }) => edgeType === 'virtual'),
    ).toBe(true)
    expect(routed.route.virtualEdgeCount).toBe(1)
    expect(routed.route.nodeIds).toHaveLength(routed.route.edges.length + 1)
  })
})

function createParallelComponents(gapMeters: number) {
  const nodes = [
    node('a0', 0, 0),
    node('a1', 100, 0),
    node('b0', 0, gapMeters),
    node('b1', 100, gapMeters),
  ]

  return createRoutingGraph(nodes, [
    ...twoWayEdges('a', nodes[0], nodes[1], 'path'),
    ...twoWayEdges('b', nodes[2], nodes[3], 'track'),
  ])
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
  edgeType: RoutingEdge['edgeType'],
): RoutingEdge[] {
  return [
    directedEdge(`${id}:forward`, from, to, edgeType),
    directedEdge(`${id}:reverse`, to, from, edgeType),
  ]
}

function directedEdge(
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
    cost: distanceMeters,
    edgeType,
  }
}
