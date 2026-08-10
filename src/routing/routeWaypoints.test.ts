import { describe, expect, it } from 'vitest'
import { calculateGeographicDistanceMeters } from '../utils/geographicDistance'
import { findNearestRoutingEdgePoint } from './nearestRoutingEdgePoint'
import { createRoutingGraph } from './routingGraph'
import { parseRoutingDataset } from './routingDataset'
import { routeWaypoints } from './routeWaypoints'
import type { RoutingEdge, RoutingNode } from './routingTypes'

const nodes = {
  a: node('a', 9.6, 62.78),
  b: node('b', 9.61, 62.78),
  c: node('c', 9.62, 62.78),
  d: node('d', 9.63, 62.78),
  x: node('x', 9.6, 62.79),
  y: node('y', 9.61, 62.79),
}
const edges = [
  bidirectionalEdges('a-b', nodes.a, nodes.b),
  bidirectionalEdges('b-c', nodes.b, nodes.c),
  bidirectionalEdges('c-d', nodes.c, nodes.d),
  bidirectionalEdges('x-y', nodes.x, nodes.y),
].flat()
const graph = createRoutingGraph(Object.values(nodes), edges)
const bounds = {
  south: 62.77,
  west: 9.59,
  north: 62.8,
  east: 9.64,
}

describe('routing edge snapping', () => {
  it('snaps a point in the middle of a long edge to the edge geometry', () => {
    const result = findNearestRoutingEdgePoint(
      graph,
      { longitude: 9.605, latitude: 62.7801 },
      100,
    )

    expect(result?.edge.id).toBe('a-b:f')
    expect(result?.positionAlongEdge).toBeCloseTo(0.5, 4)
    expect(result?.snappedPosition.longitude).toBeCloseTo(9.605, 5)
    expect(result?.distanceMeters).toBeLessThan(12)
    expect(
      calculateGeographicDistanceMeters(
        result?.snappedPosition ?? nodes.a,
        nodes.a,
      ),
    ).toBeGreaterThan(200)
  })

  it('rejects an edge outside the maximum snap distance', () => {
    expect(
      findNearestRoutingEdgePoint(
        graph,
        { longitude: 9.605, latitude: 62.785 },
        100,
      ),
    ).toBeNull()
  })
})

describe('routing dataset parsing', () => {
  it('rejects an invalid runtime dataset', () => {
    expect(() => parseRoutingDataset({ metadata: {} })).toThrow(
      'Routing dataset has an invalid structure',
    )
  })
})

describe('routeWaypoints with temporary edge splits', () => {
  it('routes from the middle of one edge to the middle of another', () => {
    const result = routeWaypoints(
      [position(9.605), position(9.615)],
      graph,
      bounds,
      100,
    )

    expect(result.status).toBe('routed')

    if (result.status === 'routed') {
      expect(result.routeNodes).toHaveLength(3)
      expect(result.routeNodes[0].longitude).toBeCloseTo(9.605, 5)
      expect(result.routeNodes[1].id).toBe('b')
      expect(result.routeNodes[2].longitude).toBeCloseTo(9.615, 5)
      expect(result.route.totalDistanceMeters).toBeCloseTo(
        edgeDistance('a-b:f') / 2 + edgeDistance('b-c:f') / 2,
        3,
      )
    }
  })

  it('routes the short section between two snaps on the same edge', () => {
    const result = routeWaypoints(
      [position(9.602), position(9.608)],
      graph,
      bounds,
      100,
    )

    expect(result.status).toBe('routed')

    if (result.status === 'routed') {
      expect(result.route.edges).toHaveLength(1)
      expect(result.route.totalDistanceMeters).toBeCloseTo(
        edgeDistance('a-b:f') * 0.6,
        3,
      )
    }
  })

  it('splits a bidirectional edge in both directions', () => {
    const result = routeWaypoints(
      [position(9.608), position(9.602)],
      graph,
      bounds,
      100,
    )

    expect(result.status).toBe('routed')

    if (result.status === 'routed') {
      expect(result.route.edges).toHaveLength(1)
      expect(result.route.edges[0].fromNodeId).toBe(result.route.nodeIds[0])
      expect(result.route.edges[0].toNodeId).toBe(result.route.nodeIds[1])
      expect(result.route.totalDistanceMeters).toBeCloseTo(
        edgeDistance('a-b:r') * 0.6,
        3,
      )
    }
  })

  it('preserves the direction of a one-way edge', () => {
    const oneWayEdge = directedEdge('one-way', nodes.a, nodes.b)
    const oneWayGraph = createRoutingGraph(
      [nodes.a, nodes.b],
      [oneWayEdge],
    )

    expect(
      routeWaypoints(
        [position(9.602), position(9.608)],
        oneWayGraph,
        bounds,
        100,
      ).status,
    ).toBe('routed')
    expect(
      routeWaypoints(
        [position(9.608), position(9.602)],
        oneWayGraph,
        bounds,
        100,
      ).status,
    ).toBe('noRoute')
  })

  it('preserves cost and physical-distance invariants in split edges', () => {
    const result = routeWaypoints(
      [position(9.602), position(9.618)],
      graph,
      bounds,
      100,
    )

    expect(result.status).toBe('routed')

    if (result.status === 'routed') {
      const routeNodes = new Map(result.routeNodes.map((node) => [node.id, node]))

      for (const edge of result.route.edges) {
        const fromNode = routeNodes.get(edge.fromNodeId)
        const toNode = routeNodes.get(edge.toNodeId)

        expect(fromNode).toBeDefined()
        expect(toNode).toBeDefined()
        expect(edge.cost).toBeGreaterThanOrEqual(edge.distanceMeters)
        expect(edge.distanceMeters + 1e-7).toBeGreaterThanOrEqual(
          calculateGeographicDistanceMeters(fromNode!, toNode!),
        )
      }
    }
  })

  it('merges routes through a via point without duplicating its snap node', () => {
    const result = routeWaypoints(
      [position(9.602), position(9.615), position(9.628)],
      graph,
      bounds,
      100,
    )

    expect(result.status).toBe('routed')

    if (result.status === 'routed') {
      const viaNodeId = result.snappedPoints[1].node.id

      expect(result.snappedPoints).toHaveLength(3)
      expect(
        result.route.nodeIds.filter((nodeId) => nodeId === viaNodeId),
      ).toHaveLength(1)
      expect(result.route.totalDistanceMeters).toBeGreaterThan(0)
    }
  })

  it('routes exact graph nodes through multiple edges', () => {
    const result = routeWaypoints([nodes.a, nodes.c], graph, bounds, 100)

    expect(result.status).toBe('routed')

    if (result.status === 'routed') {
      expect(result.route.nodeIds).toEqual(['a', 'b', 'c'])
      expect(result.route.edges).toHaveLength(2)
    }
  })

  it('returns noRoute for points in separate graph components', () => {
    const result = routeWaypoints(
      [position(9.605), { longitude: 9.605, latitude: 62.79 }],
      graph,
      bounds,
      100,
    )

    expect(result.status).toBe('noRoute')
  })

  it('returns outsideDataset before attempting to snap', () => {
    const result = routeWaypoints(
      [nodes.a, { longitude: 9.7, latitude: 62.78 }],
      graph,
      bounds,
      100,
    )

    expect(result).toEqual({ status: 'outsideDataset', pointIndex: 1 })
  })

  it('provides routing topology diagnostics without UI-specific types', () => {
    const result = routeWaypoints(
      [position(9.602), position(9.618)],
      graph,
      bounds,
      100,
    )

    expect(result.status).toBe('routed')

    if (result.status === 'routed') {
      expect(result.snappedPoints[0]).toMatchObject({
        originalPosition: position(9.602),
        edgeId: 'a-b:f',
        edgeType: 'path',
        fromNodeId: 'a',
        toNodeId: 'b',
      })
      expect(result.diagnostics.routeEdgeIds).toEqual(
        result.route.edges.map(({ id }) => id),
      )
      expect(result.diagnostics.edgeTypeCounts).toEqual({
        path: result.route.edges.length,
        track: 0,
        road: 0,
        virtual: 0,
      })
    }
  })
})

function position(longitude: number) {
  return { longitude, latitude: 62.78 }
}

function node(
  id: string,
  longitude: number,
  latitude: number,
): RoutingNode {
  return { id, longitude, latitude }
}

function edgeDistance(edgeId: string) {
  const edge = edges.find(({ id }) => id === edgeId)

  if (!edge) {
    throw new Error(`Missing test edge: ${edgeId}`)
  }

  return edge.distanceMeters
}

function bidirectionalEdges(
  id: string,
  fromNode: RoutingNode,
  toNode: RoutingNode,
): RoutingEdge[] {
  return [
    directedEdge(`${id}:f`, fromNode, toNode),
    directedEdge(`${id}:r`, toNode, fromNode),
  ]
}

function directedEdge(
  id: string,
  fromNode: RoutingNode,
  toNode: RoutingNode,
): RoutingEdge {
  const distanceMeters = calculateGeographicDistanceMeters(fromNode, toNode)

  return {
    id,
    fromNodeId: fromNode.id,
    toNodeId: toNode.id,
    distanceMeters,
    edgeType: 'path',
    cost: distanceMeters,
  }
}
