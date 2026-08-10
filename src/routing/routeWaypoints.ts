import type { GeographicCoordinate } from '../utils/geographicDistance'
import { findRoute } from './aStar'
import { findNearestRoutingEdgePoint } from './nearestRoutingEdgePoint'
import type { RoutingDatasetBounds } from './routingDataset'
import { createRoutingGraphWithEdgeSnaps } from './routingSnapGraph'
import type {
  EdgeType,
  RouteResult,
  RoutingEdge,
  RoutingGraph,
  RoutingNode,
} from './routingTypes'

export type SnappedRoutingPoint = {
  pointIndex: number
  originalPosition: GeographicCoordinate
  node: RoutingNode
  snappedPosition: GeographicCoordinate
  distanceMeters: number
  edgeId: string
  edgeType: EdgeType
  fromNodeId: string
  toNodeId: string
  positionAlongEdge: number
}

export type RoutingDiagnostics = {
  routeEdgeIds: readonly string[]
  routeEdgeTypes: readonly EdgeType[]
  edgeTypeCounts: Readonly<Record<EdgeType, number>>
}

export type WaypointRouteResult = RouteResult & {
  virtualEdgeCount: number
  virtualDistanceMeters: number
}

export type WaypointRoutingResult =
  | { status: 'idle' }
  | { status: 'outsideDataset'; pointIndex: number }
  | { status: 'noNearbyNetwork'; pointIndex: number }
  | {
      status: 'noRoute'
      segmentIndex: number
      snappedPoints: readonly SnappedRoutingPoint[]
    }
  | {
      status: 'routed'
      snappedPoints: readonly SnappedRoutingPoint[]
      route: WaypointRouteResult
      routeNodes: readonly RoutingNode[]
      diagnostics: RoutingDiagnostics
    }

export function routeWaypoints(
  routePoints: readonly GeographicCoordinate[],
  graph: RoutingGraph,
  bounds: RoutingDatasetBounds,
  maxSnapDistanceMeters: number,
  snapGraph: RoutingGraph = graph,
): WaypointRoutingResult {
  if (routePoints.length < 2) {
    return { status: 'idle' }
  }

  const edgeSnaps = []

  for (const [pointIndex, routePoint] of routePoints.entries()) {
    if (!isInsideBounds(routePoint, bounds)) {
      return { status: 'outsideDataset', pointIndex }
    }

    const nearestEdgePoint = findNearestRoutingEdgePoint(
      snapGraph,
      routePoint,
      maxSnapDistanceMeters,
    )

    if (!nearestEdgePoint) {
      return { status: 'noNearbyNetwork', pointIndex }
    }

    edgeSnaps.push({ pointIndex, snap: nearestEdgePoint })
  }

  const {
    graph: routeGraph,
    resolvedSnaps,
  } = createRoutingGraphWithEdgeSnaps(graph, edgeSnaps)
  const snappedPoints: SnappedRoutingPoint[] = resolvedSnaps.map(
    ({ pointIndex, node, snap }) => {
      const originalPosition = routePoints[pointIndex]

      return {
        pointIndex,
        originalPosition: {
          longitude: originalPosition.longitude,
          latitude: originalPosition.latitude,
        },
        node,
        snappedPosition: snap.snappedPosition,
        distanceMeters: snap.distanceMeters,
        edgeId: snap.edge.id,
        edgeType: snap.edge.edgeType,
        fromNodeId: snap.edge.fromNodeId,
        toNodeId: snap.edge.toNodeId,
        positionAlongEdge: snap.positionAlongEdge,
      }
    },
  )

  const routeNodeIds: string[] = []
  const routeEdges: RouteResult['edges'][number][] = []
  let totalDistanceMeters = 0
  let totalCost = 0

  for (let segmentIndex = 0; segmentIndex < snappedPoints.length - 1; segmentIndex += 1) {
    const segmentRoute = findRoute(
      routeGraph,
      snappedPoints[segmentIndex].node.id,
      snappedPoints[segmentIndex + 1].node.id,
    )

    if (!segmentRoute) {
      return { status: 'noRoute', segmentIndex, snappedPoints }
    }

    routeNodeIds.push(
      ...(segmentIndex === 0
        ? segmentRoute.nodeIds
        : segmentRoute.nodeIds.slice(1)),
    )
    routeEdges.push(...segmentRoute.edges)
    totalDistanceMeters += segmentRoute.totalDistanceMeters
    totalCost += segmentRoute.totalCost
  }

  const virtualEdges = routeEdges.filter(
    ({ edgeType }) => edgeType === 'virtual',
  )
  const route: WaypointRouteResult = {
    nodeIds: routeNodeIds,
    edges: routeEdges,
    totalDistanceMeters,
    totalCost,
    virtualEdgeCount: virtualEdges.length,
    virtualDistanceMeters: virtualEdges.reduce(
      (sum, edge) => sum + edge.distanceMeters,
      0,
    ),
  }
  const routeNodes = route.nodeIds.map((nodeId) => {
    const node = routeGraph.nodes.get(nodeId)

    if (!node) {
      throw new Error(`Route references an unknown node: ${nodeId}`)
    }

    return node
  })

  return {
    status: 'routed',
    snappedPoints,
    route,
    routeNodes,
    diagnostics: createRoutingDiagnostics(route.edges),
  }
}

function createRoutingDiagnostics(
  routeEdges: readonly RoutingEdge[],
): RoutingDiagnostics {
  const edgeTypeCounts: Record<EdgeType, number> = {
    path: 0,
    track: 0,
    road: 0,
    virtual: 0,
  }

  for (const edge of routeEdges) {
    edgeTypeCounts[edge.edgeType] += 1
  }

  return {
    routeEdgeIds: routeEdges.map(({ id }) => id),
    routeEdgeTypes: routeEdges.map(({ edgeType }) => edgeType),
    edgeTypeCounts,
  }
}

function isInsideBounds(
  position: GeographicCoordinate,
  bounds: RoutingDatasetBounds,
) {
  return (
    position.latitude >= bounds.south &&
    position.latitude <= bounds.north &&
    position.longitude >= bounds.west &&
    position.longitude <= bounds.east
  )
}
