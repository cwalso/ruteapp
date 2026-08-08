import { calculateGeographicDistanceMeters } from '../utils/geographicDistance'
import { getOutgoingEdges, getRoutingNode } from './routingGraph'
import type {
  RouteResult,
  RoutingEdge,
  RoutingGraph,
  RoutingNode,
} from './routingTypes'

export function findRoute(
  graph: RoutingGraph,
  startNodeId: string,
  targetNodeId: string,
): RouteResult | null {
  const startNode = getRoutingNode(graph, startNodeId)
  const targetNode = getRoutingNode(graph, targetNodeId)

  if (!startNode || !targetNode) {
    return null
  }

  const openNodeIds = new Set([startNodeId])
  const costFromStart = new Map([[startNodeId, 0]])
  const estimatedTotalCost = new Map([
    [startNodeId, estimateRemainingCost(startNode, targetNode)],
  ])
  const incomingEdge = new Map<string, RoutingEdge>()

  while (openNodeIds.size > 0) {
    const currentNodeId = getLowestCostNode(
      openNodeIds,
      estimatedTotalCost,
    )

    if (currentNodeId === targetNodeId) {
      return buildRouteResult(
        startNodeId,
        targetNodeId,
        incomingEdge,
      )
    }

    openNodeIds.delete(currentNodeId)
    const currentCost = costFromStart.get(currentNodeId)

    if (currentCost === undefined) {
      continue
    }

    for (const edge of getOutgoingEdges(graph, currentNodeId)) {
      const nextNode = getRoutingNode(graph, edge.toNodeId)

      if (!nextNode) {
        continue
      }

      const candidateCost = currentCost + edge.cost
      const knownCost = costFromStart.get(nextNode.id) ?? Number.POSITIVE_INFINITY

      if (candidateCost >= knownCost) {
        continue
      }

      incomingEdge.set(nextNode.id, edge)
      costFromStart.set(nextNode.id, candidateCost)
      estimatedTotalCost.set(
        nextNode.id,
        candidateCost + estimateRemainingCost(nextNode, targetNode),
      )
      openNodeIds.add(nextNode.id)
    }
  }

  return null
}

function estimateRemainingCost(from: RoutingNode, target: RoutingNode) {
  // Admissible while every edge's physical distance is at least the
  // straight-line distance between its endpoints and cost >= distanceMeters.
  return calculateGeographicDistanceMeters(from, target)
}

function getLowestCostNode(
  openNodeIds: ReadonlySet<string>,
  estimatedTotalCost: ReadonlyMap<string, number>,
) {
  let bestNodeId: string | undefined
  let bestCost = Number.POSITIVE_INFINITY

  for (const nodeId of openNodeIds) {
    const nodeCost =
      estimatedTotalCost.get(nodeId) ?? Number.POSITIVE_INFINITY

    if (
      nodeCost < bestCost ||
      (nodeCost === bestCost &&
        (bestNodeId === undefined || nodeId < bestNodeId))
    ) {
      bestNodeId = nodeId
      bestCost = nodeCost
    }
  }

  if (bestNodeId === undefined) {
    throw new Error('A* open set cannot be empty')
  }

  return bestNodeId
}

function buildRouteResult(
  startNodeId: string,
  targetNodeId: string,
  incomingEdge: ReadonlyMap<string, RoutingEdge>,
): RouteResult {
  const routeEdges: RoutingEdge[] = []
  let currentNodeId = targetNodeId

  while (currentNodeId !== startNodeId) {
    const edge = incomingEdge.get(currentNodeId)

    if (!edge) {
      throw new Error('A* route reconstruction failed')
    }

    routeEdges.push(edge)
    currentNodeId = edge.fromNodeId
  }

  routeEdges.reverse()

  return {
    nodeIds: [startNodeId, ...routeEdges.map(({ toNodeId }) => toNodeId)],
    edges: routeEdges,
    totalDistanceMeters: routeEdges.reduce(
      (total, { distanceMeters }) => total + distanceMeters,
      0,
    ),
    totalCost: routeEdges.reduce((total, { cost }) => total + cost, 0),
  }
}
