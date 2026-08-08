import { describe, expect, it } from 'vitest'
import { findRoute } from './aStar'
import { createRoutingGraph } from './routingGraph'
import type { RoutingEdge, RoutingNode } from './routingTypes'
import { calculateGeographicDistanceMeters } from '../utils/geographicDistance'

const nodes = {
  a: node('a', 9.6, 62.78),
  b: node('b', 9.601, 62.78),
  c: node('c', 9.602, 62.78),
  d: node('d', 9.601, 62.7805),
}

const nodesById = new Map(
  Object.values(nodes).map((routingNode) => [routingNode.id, routingNode]),
)

describe('findRoute', () => {
  it('chooses the ordinary route with the lowest cost', () => {
    const graph = createRoutingGraph(Object.values(nodes), [
      edge('a-b', 'a', 'b', 60, 'path'),
      edge('b-c', 'b', 'c', 60, 'track'),
      edge('a-d', 'a', 'd', 90, 'road'),
      edge('d-c', 'd', 'c', 90, 'road'),
    ])

    const result = findRoute(graph, 'a', 'c')

    expect(result?.nodeIds).toEqual(['a', 'b', 'c'])
    expect(result?.edges.map(({ id }) => id)).toEqual(['a-b', 'b-c'])
    expect(result?.totalDistanceMeters).toBe(120)
    expect(result?.totalCost).toBe(120)
  })

  it('avoids a geometrically shorter virtual edge when its cost is higher', () => {
    const graph = createRoutingGraph(Object.values(nodes), [
      edge('a-b', 'a', 'b', 60, 'path'),
      edge('b-c', 'b', 'c', 60, 'path'),
      edge('a-c-virtual', 'a', 'c', 105, 'virtual', 160),
    ])

    const result = findRoute(graph, 'a', 'c')

    expect(result?.edges.map(({ id }) => id)).toEqual(['a-b', 'b-c'])
    expect(result?.totalDistanceMeters).toBe(120)
    expect(result?.totalCost).toBe(120)
  })

  it('uses an explicit virtual edge when it is the only connection', () => {
    const graph = createRoutingGraph(Object.values(nodes), [
      edge('a-b', 'a', 'b', 60, 'path'),
      edge('b-c-virtual', 'b', 'c', 60, 'virtual', 120),
      edge('c-d', 'c', 'd', 90, 'track'),
    ])

    const result = findRoute(graph, 'a', 'd')

    expect(result?.nodeIds).toEqual(['a', 'b', 'c', 'd'])
    expect(result?.edges.map(({ edgeType }) => edgeType)).toEqual([
      'path',
      'virtual',
      'track',
    ])
    expect(result?.totalDistanceMeters).toBe(210)
    expect(result?.totalCost).toBe(270)
  })

  it('returns null when the target cannot be reached', () => {
    const graph = createRoutingGraph(Object.values(nodes), [
      edge('a-b', 'a', 'b', 60, 'path'),
      edge('c-d', 'c', 'd', 90, 'track'),
    ])

    expect(findRoute(graph, 'a', 'd')).toBeNull()
  })

  it('rejects an edge whose cost is lower than its physical distance', () => {
    expect(() =>
      createRoutingGraph([nodes.a, nodes.b], [
        edge('invalid', 'a', 'b', 60, 'path', 50),
      ]),
    ).toThrow('Routing edge cost cannot be lower than distance: invalid')
  })

  it('uses fixture edge lengths that are not shorter than straight-line distance', () => {
    const fixtureEdges = [
      edge('a-b', 'a', 'b', 60, 'path'),
      edge('b-c', 'b', 'c', 60, 'track'),
      edge('a-c', 'a', 'c', 105, 'virtual', 160),
      edge('a-d', 'a', 'd', 90, 'road'),
      edge('d-c', 'd', 'c', 90, 'road'),
    ]

    for (const routingEdge of fixtureEdges) {
      const fromNode = nodesById.get(routingEdge.fromNodeId)
      const toNode = nodesById.get(routingEdge.toNodeId)

      if (!fromNode || !toNode) {
        throw new Error(`Fixture edge references an unknown node: ${routingEdge.id}`)
      }

      expect(routingEdge.distanceMeters).toBeGreaterThanOrEqual(
        calculateGeographicDistanceMeters(fromNode, toNode),
      )
    }
  })
})

function node(
  id: string,
  longitude: number,
  latitude: number,
): RoutingNode {
  return { id, longitude, latitude }
}

function edge(
  id: string,
  fromNodeId: string,
  toNodeId: string,
  distanceMeters: number,
  edgeType: RoutingEdge['edgeType'],
  cost = distanceMeters,
): RoutingEdge {
  return {
    id,
    fromNodeId,
    toNodeId,
    distanceMeters,
    edgeType,
    cost,
  }
}
