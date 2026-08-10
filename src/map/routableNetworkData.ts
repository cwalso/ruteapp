import type { RoutingGraph, RoutingNode } from '../routing/routingTypes'

export type RoutableMapEdgeType = 'path' | 'track' | 'road'

export type RoutableMapSegment = {
  id: string
  edgeType: RoutableMapEdgeType
  geometry: readonly [RoutingNode, RoutingNode]
  sourceEdgeIds: readonly string[]
}

export type RoutableNetworkGeoJson = ReturnType<
  typeof createRoutableNetworkGeoJson
>

type SegmentGroup = {
  nodeIds: readonly [string, string]
  edgeType: RoutableMapEdgeType
  sourceEdgeIds: string[]
}

export function createRoutableMapSegments(
  graph: RoutingGraph,
): RoutableMapSegment[] {
  const groupsByPhysicalSegment = new Map<string, SegmentGroup>()

  for (const edge of graph.edges) {
    if (edge.edgeType === 'virtual') {
      continue
    }

    const nodeIds = [edge.fromNodeId, edge.toNodeId].sort() as [
      string,
      string,
    ]
    const key = createPhysicalSegmentKey(nodeIds, edge.edgeType)
    const existing = groupsByPhysicalSegment.get(key)

    if (existing) {
      existing.sourceEdgeIds.push(edge.id)
    } else {
      groupsByPhysicalSegment.set(key, {
        nodeIds,
        edgeType: edge.edgeType,
        sourceEdgeIds: [edge.id],
      })
    }
  }

  return [...groupsByPhysicalSegment.values()]
    .map(({ nodeIds, edgeType, sourceEdgeIds }) => {
      const from = getRequiredNode(graph, nodeIds[0])
      const to = getRequiredNode(graph, nodeIds[1])

      return {
        id: createRoutableMapSegmentId(nodeIds, edgeType),
        edgeType,
        geometry: [from, to] as const,
        sourceEdgeIds: sourceEdgeIds.sort(),
      }
    })
    .sort((first, second) => first.id.localeCompare(second.id))
}

export function createRoutableNetworkGeoJson(
  segments: readonly RoutableMapSegment[],
) {
  return {
    type: 'FeatureCollection' as const,
    features: segments.map(({ id, edgeType, geometry }) => ({
      type: 'Feature' as const,
      id,
      properties: {
        segmentId: id,
        edgeType,
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: geometry.map(({ longitude, latitude }) => [
          longitude,
          latitude,
        ]),
      },
    })),
  }
}

function createPhysicalSegmentKey(
  nodeIds: readonly [string, string],
  edgeType: RoutableMapEdgeType,
) {
  return `${nodeIds[0]}\u0000${nodeIds[1]}\u0000${edgeType}`
}

function createRoutableMapSegmentId(
  nodeIds: readonly [string, string],
  edgeType: RoutableMapEdgeType,
) {
  return `routable:${edgeType}:${nodeIds[0]}:${nodeIds[1]}`
}

function getRequiredNode(graph: RoutingGraph, nodeId: string) {
  const node = graph.nodes.get(nodeId)

  if (!node) {
    throw new Error(`Routable map segment references unknown node: ${nodeId}`)
  }

  return node
}
