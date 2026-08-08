import type {
  RoutingEdge,
  RoutingGraph,
  RoutingNode,
} from './routingTypes'

export function createRoutingGraph(
  nodes: readonly RoutingNode[],
  edges: readonly RoutingEdge[],
): RoutingGraph {
  const nodesById = new Map<string, RoutingNode>()
  const outgoingEdges = new Map<string, RoutingEdge[]>()
  const edgeIds = new Set<string>()

  for (const node of nodes) {
    if (nodesById.has(node.id)) {
      throw new Error(`Routing node id must be unique: ${node.id}`)
    }

    nodesById.set(node.id, node)
    outgoingEdges.set(node.id, [])
  }

  for (const edge of edges) {
    validateEdge(edge, nodesById, edgeIds)
    edgeIds.add(edge.id)
    outgoingEdges.get(edge.fromNodeId)?.push(edge)
  }

  return {
    nodes: nodesById,
    edges: [...edges],
    outgoingEdges,
  }
}

export function getRoutingNode(graph: RoutingGraph, nodeId: string) {
  return graph.nodes.get(nodeId)
}

export function getOutgoingEdges(graph: RoutingGraph, nodeId: string) {
  return graph.outgoingEdges.get(nodeId) ?? []
}

function validateEdge(
  edge: RoutingEdge,
  nodesById: ReadonlyMap<string, RoutingNode>,
  edgeIds: ReadonlySet<string>,
) {
  if (edgeIds.has(edge.id)) {
    throw new Error(`Routing edge id must be unique: ${edge.id}`)
  }

  if (!nodesById.has(edge.fromNodeId) || !nodesById.has(edge.toNodeId)) {
    throw new Error(`Routing edge references an unknown node: ${edge.id}`)
  }

  if (edge.distanceMeters < 0) {
    throw new Error(`Routing edge distance cannot be negative: ${edge.id}`)
  }

  if (edge.cost < edge.distanceMeters) {
    throw new Error(
      `Routing edge cost cannot be lower than distance: ${edge.id}`,
    )
  }
}
