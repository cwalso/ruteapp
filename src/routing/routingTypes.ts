export type EdgeType = 'path' | 'track' | 'road' | 'virtual'

export type RoutingNode = {
  id: string
  longitude: number
  latitude: number
}

export type RoutingEdge = {
  id: string
  fromNodeId: string
  toNodeId: string
  /**
   * Physical travel length along the edge. Graph producers must ensure that
   * this is not shorter than the geographic straight-line distance between
   * the edge endpoints.
   */
  distanceMeters: number
  edgeType: EdgeType
  /** Routing weight. The first cost model requires cost >= distanceMeters. */
  cost: number
}

export type RoutingGraph = {
  nodes: ReadonlyMap<string, RoutingNode>
  edges: readonly RoutingEdge[]
  outgoingEdges: ReadonlyMap<string, readonly RoutingEdge[]>
}

export type RouteResult = {
  nodeIds: readonly string[]
  edges: readonly RoutingEdge[]
  totalDistanceMeters: number
  totalCost: number
}
