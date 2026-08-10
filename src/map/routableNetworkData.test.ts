import { describe, expect, it } from 'vitest'
import { createRoutingGraph } from '../routing/routingGraph'
import type { EdgeType, RoutingEdge } from '../routing/routingTypes'
import {
  createRoutableMapSegments,
  createRoutableNetworkGeoJson,
} from './routableNetworkData'

describe('routable network map data', () => {
  it('deduplicates two opposite directed edges to one physical segment', () => {
    const segments = createRoutableMapSegments(
      createGraph([
        createEdge('path-forward', 'a', 'b', 'path'),
        createEdge('path-reverse', 'b', 'a', 'path'),
      ]),
    )

    expect(segments).toHaveLength(1)
    expect(segments[0].sourceEdgeIds).toEqual([
      'path-forward',
      'path-reverse',
    ])
  })

  it('keeps a one-way edge as one physical segment', () => {
    const segments = createRoutableMapSegments(
      createGraph([createEdge('one-way', 'b', 'c', 'road')]),
    )

    expect(segments).toHaveLength(1)
    expect(segments[0].sourceEdgeIds).toEqual(['one-way'])
  })

  it.each(['path', 'track', 'road'] as const)(
    'preserves the %s edge type',
    (edgeType) => {
      const segments = createRoutableMapSegments(
        createGraph([createEdge(`${edgeType}-edge`, 'a', 'b', edgeType)]),
      )

      expect(segments[0].edgeType).toBe(edgeType)
    },
  )

  it('excludes virtual edges from the ordinary routable map layer', () => {
    const segments = createRoutableMapSegments(
      createGraph([
        createEdge('ordinary', 'a', 'b', 'path'),
        createEdge('virtual', 'b', 'c', 'virtual'),
      ]),
    )

    expect(segments.map(({ edgeType }) => edgeType)).toEqual(['path'])
  })

  it('creates correct GeoJSON geometry and properties', () => {
    const graph = createGraph([createEdge('track-edge', 'b', 'a', 'track')])
    const data = createRoutableNetworkGeoJson(
      createRoutableMapSegments(graph),
    )

    expect(data.features[0]).toMatchObject({
      properties: {
        segmentId: 'routable:track:a:b',
        edgeType: 'track',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [9.5, 62.7],
          [9.6, 62.8],
        ],
      },
    })
  })

  it('keeps segment ids and ordering deterministic', () => {
    const edges = [
      createEdge('z-reverse', 'b', 'a', 'path'),
      createEdge('a-forward', 'a', 'b', 'path'),
      createEdge('track', 'b', 'c', 'track'),
    ]
    const first = createRoutableMapSegments(createGraph(edges))
    const second = createRoutableMapSegments(createGraph([...edges].reverse()))

    expect(first).toEqual(second)
    expect(first.map(({ id }) => id)).toEqual([
      'routable:path:a:b',
      'routable:track:b:c',
    ])
  })
})

function createGraph(edges: RoutingEdge[]) {
  return createRoutingGraph(
    [
      { id: 'a', longitude: 9.5, latitude: 62.7 },
      { id: 'b', longitude: 9.6, latitude: 62.8 },
      { id: 'c', longitude: 9.7, latitude: 62.9 },
    ],
    edges,
  )
}

function createEdge(
  id: string,
  fromNodeId: string,
  toNodeId: string,
  edgeType: EdgeType,
): RoutingEdge {
  return {
    id,
    fromNodeId,
    toNodeId,
    distanceMeters: 100,
    cost: edgeType === 'virtual' ? 300 : 100,
    edgeType,
  }
}
