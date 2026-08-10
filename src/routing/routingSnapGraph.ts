import type { NearestRoutingEdgePoint } from './nearestRoutingEdgePoint'
import { createRoutingGraph } from './routingGraph'
import type {
  RoutingEdge,
  RoutingGraph,
  RoutingNode,
} from './routingTypes'

export type IndexedRoutingEdgeSnap = {
  pointIndex: number
  snap: NearestRoutingEdgePoint
}

export type ResolvedRoutingEdgeSnap = IndexedRoutingEdgeSnap & {
  node: RoutingNode
}

type InteriorSnap = ResolvedRoutingEdgeSnap & {
  canonicalPosition: number
}

const ENDPOINT_TOLERANCE = 1e-12

export function createRoutingGraphWithEdgeSnaps(
  graph: RoutingGraph,
  indexedSnaps: readonly IndexedRoutingEdgeSnap[],
) {
  const usedNodeIds = new Set(graph.nodes.keys())
  const temporaryNodes: RoutingNode[] = []
  const interiorSnapsByEdge = new Map<string, InteriorSnap[]>()
  const resolvedSnaps: ResolvedRoutingEdgeSnap[] = []

  for (const indexedSnap of indexedSnaps) {
    const { edge, positionAlongEdge, snappedPosition } = indexedSnap.snap
    let node: RoutingNode | undefined

    if (positionAlongEdge <= ENDPOINT_TOLERANCE) {
      node = graph.nodes.get(edge.fromNodeId)
    } else if (positionAlongEdge >= 1 - ENDPOINT_TOLERANCE) {
      node = graph.nodes.get(edge.toNodeId)
    }

    if (!node) {
      node = {
        id: createUniqueId(`route-snap-${indexedSnap.pointIndex}`, usedNodeIds),
        ...snappedPosition,
      }
      temporaryNodes.push(node)
    }

    const resolvedSnap = { ...indexedSnap, node }
    resolvedSnaps.push(resolvedSnap)

    if (temporaryNodes.includes(node)) {
      const edgeKey = getPhysicalEdgeKey(edge)
      const interiorSnaps = interiorSnapsByEdge.get(edgeKey) ?? []
      interiorSnaps.push({
        ...resolvedSnap,
        canonicalPosition: getCanonicalPosition(edge, positionAlongEdge),
      })
      interiorSnapsByEdge.set(edgeKey, interiorSnaps)
    }
  }

  if (interiorSnapsByEdge.size === 0) {
    return { graph, resolvedSnaps }
  }

  const derivedEdges: RoutingEdge[] = []
  const usedEdgeIds = new Set(graph.edges.map(({ id }) => id))

  for (const edge of graph.edges) {
    const interiorSnaps = interiorSnapsByEdge.get(getPhysicalEdgeKey(edge))

    if (!interiorSnaps) {
      derivedEdges.push(edge)
      continue
    }

    const splitPoints = interiorSnaps
      .map((snap) => ({
        node: snap.node,
        pointIndex: snap.pointIndex,
        positionAlongEdge: getPositionForEdge(edge, snap.canonicalPosition),
      }))
      .sort(
        (first, second) =>
          first.positionAlongEdge - second.positionAlongEdge ||
          first.pointIndex - second.pointIndex,
      )
    const chain = [
      {
        node: getRequiredNode(graph, edge.fromNodeId),
        positionAlongEdge: 0,
      },
      ...splitPoints,
      {
        node: getRequiredNode(graph, edge.toNodeId),
        positionAlongEdge: 1,
      },
    ]

    for (let index = 0; index < chain.length - 1; index += 1) {
      const from = chain[index]
      const to = chain[index + 1]
      const lengthRatio = to.positionAlongEdge - from.positionAlongEdge

      derivedEdges.push({
        id: createUniqueId(`${edge.id}:route-split:${index}`, usedEdgeIds),
        fromNodeId: from.node.id,
        toNodeId: to.node.id,
        distanceMeters: edge.distanceMeters * lengthRatio,
        edgeType: edge.edgeType,
        cost: edge.cost * lengthRatio,
      })
    }
  }

  return {
    graph: createRoutingGraph(
      [...graph.nodes.values(), ...temporaryNodes],
      derivedEdges,
    ),
    resolvedSnaps,
  }
}

function getPhysicalEdgeKey(edge: RoutingEdge) {
  const endpointIds = [edge.fromNodeId, edge.toNodeId].sort()
  return JSON.stringify([...endpointIds, edge.edgeType])
}

function getCanonicalPosition(edge: RoutingEdge, positionAlongEdge: number) {
  return edge.fromNodeId <= edge.toNodeId
    ? positionAlongEdge
    : 1 - positionAlongEdge
}

function getPositionForEdge(edge: RoutingEdge, canonicalPosition: number) {
  return edge.fromNodeId <= edge.toNodeId
    ? canonicalPosition
    : 1 - canonicalPosition
}

function getRequiredNode(graph: RoutingGraph, nodeId: string) {
  const node = graph.nodes.get(nodeId)

  if (!node) {
    throw new Error(`Routing edge references an unknown node: ${nodeId}`)
  }

  return node
}

function createUniqueId(baseId: string, usedIds: Set<string>) {
  let id = baseId
  let suffix = 1

  while (usedIds.has(id)) {
    id = `${baseId}:${suffix}`
    suffix += 1
  }

  usedIds.add(id)
  return id
}
