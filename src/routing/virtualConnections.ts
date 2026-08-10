import { calculateGeographicDistanceMeters } from '../utils/geographicDistance'
import { createRoutingGraph } from './routingGraph'
import { createRoutingGraphWithEdgeSnaps } from './routingSnapGraph'
import type {
  RoutingEdge,
  RoutingGraph,
  RoutingNode,
} from './routingTypes'
import type { IndexedRoutingEdgeSnap } from './routingSnapGraph'

export type VirtualConnectionConfig = {
  maxVirtualDistanceMeters: number
  virtualCostMultiplier: number
}

export type VirtualConnectionEndpoint = {
  edgeId: string
  nodeId: string
  positionAlongEdge: number
  position: RoutingPosition
}

export type VirtualConnectionCandidate = {
  id: string
  componentIds: readonly [string, string]
  from: VirtualConnectionEndpoint
  to: VirtualConnectionEndpoint
  distanceMeters: number
  cost: number
}

export type VirtualConnectionGraphResult = {
  graph: RoutingGraph
  snapGraph: RoutingGraph
  candidates: VirtualConnectionCandidate[]
  componentCountBefore: number
  componentCountAfter: number
  connectableComponentCount: number
}

type ProjectedPoint = {
  x: number
  y: number
}

type RoutingPosition = Pick<RoutingNode, 'longitude' | 'latitude'>

type PhysicalSegment = {
  edge: RoutingEdge
  componentId: string
  from: RoutingNode
  to: RoutingNode
  projectedFrom: ProjectedPoint
  projectedTo: ProjectedPoint
}

type ClosestSegmentPoints = {
  firstPosition: number
  secondPosition: number
}

type CandidateWithEdges = {
  componentIds: readonly [string, string]
  fromEdge: RoutingEdge
  toEdge: RoutingEdge
  fromPositionAlongEdge: number
  toPositionAlongEdge: number
  fromPosition: RoutingPosition
  toPosition: RoutingPosition
  distanceMeters: number
}

const earthRadiusMeters = 6_371_008.8
const distanceComparisonToleranceMeters = 1e-6

export function findWeaklyConnectedComponents(graph: RoutingGraph) {
  const neighbors = new Map<string, Set<string>>()

  for (const nodeId of graph.nodes.keys()) {
    neighbors.set(nodeId, new Set())
  }

  for (const edge of graph.edges.values()) {
    neighbors.get(edge.fromNodeId)?.add(edge.toNodeId)
    neighbors.get(edge.toNodeId)?.add(edge.fromNodeId)
  }

  const componentByNodeId = new Map<string, string>()
  const componentIds: string[] = []

  for (const startNodeId of [...graph.nodes.keys()].sort()) {
    if (componentByNodeId.has(startNodeId)) {
      continue
    }

    const memberNodeIds: string[] = []
    const pendingNodeIds = [startNodeId]
    componentByNodeId.set(startNodeId, startNodeId)

    while (pendingNodeIds.length > 0) {
      const nodeId = pendingNodeIds.pop()!
      memberNodeIds.push(nodeId)

      for (const neighborNodeId of neighbors.get(nodeId) ?? []) {
        if (!componentByNodeId.has(neighborNodeId)) {
          componentByNodeId.set(neighborNodeId, startNodeId)
          pendingNodeIds.push(neighborNodeId)
        }
      }
    }

    const componentId = memberNodeIds.sort()[0]
    componentIds.push(componentId)

    for (const nodeId of memberNodeIds) {
      componentByNodeId.set(nodeId, componentId)
    }
  }

  return {
    componentByNodeId,
    componentIds: componentIds.sort(),
  }
}

export function createGraphWithVirtualConnections(
  graph: RoutingGraph,
  config: VirtualConnectionConfig,
): VirtualConnectionGraphResult {
  validateConfig(config)

  const ordinaryGraph = createRoutingGraph(
    [...graph.nodes.values()],
    [...graph.edges.values()].filter((edge) => edge.edgeType !== 'virtual'),
  )
  const componentsBefore = findWeaklyConnectedComponents(ordinaryGraph)
  const selectedCandidates = findVirtualConnectionCandidates(
    ordinaryGraph,
    componentsBefore.componentByNodeId,
    config.maxVirtualDistanceMeters,
  )

  if (selectedCandidates.length === 0) {
    return {
      graph: ordinaryGraph,
      snapGraph: ordinaryGraph,
      candidates: [],
      componentCountBefore: componentsBefore.componentIds.length,
      componentCountAfter: componentsBefore.componentIds.length,
      connectableComponentCount: 0,
    }
  }

  const edgeSnaps: IndexedRoutingEdgeSnap[] = selectedCandidates.flatMap(
    (candidate, candidateIndex) => [
      createIndexedEdgeSnap(
        candidateIndex * 2,
        candidate.fromEdge,
        candidate.fromPosition,
        candidate.fromPositionAlongEdge,
      ),
      createIndexedEdgeSnap(
        candidateIndex * 2 + 1,
        candidate.toEdge,
        candidate.toPosition,
        candidate.toPositionAlongEdge,
      ),
    ],
  )
  const splitResult = createRoutingGraphWithEdgeSnaps(ordinaryGraph, edgeSnaps)
  const virtualEdges: RoutingEdge[] = []
  const candidates: VirtualConnectionCandidate[] = []

  selectedCandidates.forEach((candidate, candidateIndex) => {
    const fromSnap = splitResult.resolvedSnaps.find(
      ({ pointIndex }) => pointIndex === candidateIndex * 2,
    )
    const toSnap = splitResult.resolvedSnaps.find(
      ({ pointIndex }) => pointIndex === candidateIndex * 2 + 1,
    )

    if (!fromSnap || !toSnap) {
      throw new Error('Kunne ikke materialisere virtuell terrengforbindelse.')
    }

    const id = `virtual-connection-${candidateIndex}`
    const cost = candidate.distanceMeters * config.virtualCostMultiplier

    virtualEdges.push(
      {
        id: `${id}:forward`,
        fromNodeId: fromSnap.node.id,
        toNodeId: toSnap.node.id,
        distanceMeters: candidate.distanceMeters,
        cost,
        edgeType: 'virtual',
      },
      {
        id: `${id}:reverse`,
        fromNodeId: toSnap.node.id,
        toNodeId: fromSnap.node.id,
        distanceMeters: candidate.distanceMeters,
        cost,
        edgeType: 'virtual',
      },
    )
    candidates.push({
      id,
      componentIds: candidate.componentIds,
      from: {
        edgeId: candidate.fromEdge.id,
        nodeId: fromSnap.node.id,
        positionAlongEdge: candidate.fromPositionAlongEdge,
        position: candidate.fromPosition,
      },
      to: {
        edgeId: candidate.toEdge.id,
        nodeId: toSnap.node.id,
        positionAlongEdge: candidate.toPositionAlongEdge,
        position: candidate.toPosition,
      },
      distanceMeters: candidate.distanceMeters,
      cost,
    })
  })

  const graphWithVirtualConnections = createRoutingGraph(
    [...splitResult.graph.nodes.values()],
    [...splitResult.graph.edges.values(), ...virtualEdges],
  )
  const componentsAfter = findWeaklyConnectedComponents(
    graphWithVirtualConnections,
  )
  const connectableComponents = new Set(
    candidates.flatMap((candidate) => candidate.componentIds),
  )

  return {
    graph: graphWithVirtualConnections,
    snapGraph: splitResult.graph,
    candidates,
    componentCountBefore: componentsBefore.componentIds.length,
    componentCountAfter: componentsAfter.componentIds.length,
    connectableComponentCount: connectableComponents.size,
  }
}

function validateConfig(config: VirtualConnectionConfig) {
  if (
    !Number.isFinite(config.maxVirtualDistanceMeters) ||
    config.maxVirtualDistanceMeters <= 0
  ) {
    throw new Error('Maksimal virtuell avstand må være større enn null.')
  }

  if (
    !Number.isFinite(config.virtualCostMultiplier) ||
    config.virtualCostMultiplier <= 1
  ) {
    throw new Error('Kostnadsfaktoren for virtuelle forbindelser må være over 1.')
  }
}

function findVirtualConnectionCandidates(
  graph: RoutingGraph,
  componentByNodeId: ReadonlyMap<string, string>,
  maxDistanceMeters: number,
) {
  const referenceLatitude =
    [...graph.nodes.values()].reduce((sum, node) => sum + node.latitude, 0) /
    Math.max(graph.nodes.size, 1)
  const project = createLocalProjection(referenceLatitude)
  const segments = createPhysicalSegments(graph, componentByNodeId, project)
  const segmentIndexesByCell = indexSegments(
    segments,
    maxDistanceMeters,
  )
  const evaluatedSegmentPairs = new Set<string>()
  const shortestCandidateByComponentPair = new Map<
    string,
    CandidateWithEdges
  >()

  for (const segmentIndexes of segmentIndexesByCell.values()) {
    for (let firstIndex = 0; firstIndex < segmentIndexes.length; firstIndex += 1) {
      const first = segments[segmentIndexes[firstIndex]]

      for (
        let secondIndex = firstIndex + 1;
        secondIndex < segmentIndexes.length;
        secondIndex += 1
      ) {
        const second = segments[segmentIndexes[secondIndex]]

        if (first.componentId === second.componentId) {
          continue
        }

        const segmentPairKey = createSortedPairKey(
          segmentIndexes[firstIndex],
          segmentIndexes[secondIndex],
        )

        if (evaluatedSegmentPairs.has(segmentPairKey)) {
          continue
        }
        evaluatedSegmentPairs.add(segmentPairKey)

        const closest = findClosestSegmentPoints(first, second)
        const firstPosition = interpolatePosition(
          first.from,
          first.to,
          closest.firstPosition,
        )
        const secondPosition = interpolatePosition(
          second.from,
          second.to,
          closest.secondPosition,
        )
        const distanceMeters = calculateGeographicDistanceMeters(
          firstPosition,
          secondPosition,
        )

        if (
          distanceMeters <= distanceComparisonToleranceMeters ||
          distanceMeters > maxDistanceMeters + distanceComparisonToleranceMeters
        ) {
          continue
        }

        const ordered = orderCandidateEndpoints(
          first,
          second,
          closest,
          firstPosition,
          secondPosition,
        )
        const candidate: CandidateWithEdges = {
          ...ordered,
          distanceMeters,
        }
        const componentPairKey = candidate.componentIds.join('\u0000')
        const existing = shortestCandidateByComponentPair.get(componentPairKey)

        if (!existing || compareCandidates(candidate, existing) < 0) {
          shortestCandidateByComponentPair.set(componentPairKey, candidate)
        }
      }
    }
  }

  return [...shortestCandidateByComponentPair.values()].sort(compareCandidates)
}

function createPhysicalSegments(
  graph: RoutingGraph,
  componentByNodeId: ReadonlyMap<string, string>,
  project: (position: RoutingPosition) => ProjectedPoint,
) {
  const representativeEdgeByPhysicalSegment = new Map<string, RoutingEdge>()

  for (const edge of graph.edges.values()) {
    if (edge.edgeType === 'virtual') {
      continue
    }

    const endpoints = [edge.fromNodeId, edge.toNodeId].sort()
    const physicalSegmentKey = `${endpoints[0]}\u0000${endpoints[1]}\u0000${edge.edgeType}`
    const existing = representativeEdgeByPhysicalSegment.get(physicalSegmentKey)

    if (!existing || edge.id.localeCompare(existing.id) < 0) {
      representativeEdgeByPhysicalSegment.set(physicalSegmentKey, edge)
    }
  }

  return [...representativeEdgeByPhysicalSegment.values()]
    .sort((first, second) => first.id.localeCompare(second.id))
    .map((edge): PhysicalSegment => {
      const from = graph.nodes.get(edge.fromNodeId)!
      const to = graph.nodes.get(edge.toNodeId)!

      return {
        edge,
        componentId: componentByNodeId.get(edge.fromNodeId)!,
        from,
        to,
        projectedFrom: project(from),
        projectedTo: project(to),
      }
    })
}

function indexSegments(
  segments: PhysicalSegment[],
  maxDistanceMeters: number,
) {
  const cellSizeMeters = maxDistanceMeters
  const segmentIndexesByCell = new Map<string, number[]>()

  segments.forEach((segment, segmentIndex) => {
    const minX =
      Math.min(segment.projectedFrom.x, segment.projectedTo.x) -
      maxDistanceMeters
    const maxX =
      Math.max(segment.projectedFrom.x, segment.projectedTo.x) +
      maxDistanceMeters
    const minY =
      Math.min(segment.projectedFrom.y, segment.projectedTo.y) -
      maxDistanceMeters
    const maxY =
      Math.max(segment.projectedFrom.y, segment.projectedTo.y) +
      maxDistanceMeters

    for (
      let cellX = Math.floor(minX / cellSizeMeters);
      cellX <= Math.floor(maxX / cellSizeMeters);
      cellX += 1
    ) {
      for (
        let cellY = Math.floor(minY / cellSizeMeters);
        cellY <= Math.floor(maxY / cellSizeMeters);
        cellY += 1
      ) {
        const cellKey = `${cellX}:${cellY}`
        const indexes = segmentIndexesByCell.get(cellKey) ?? []
        indexes.push(segmentIndex)
        segmentIndexesByCell.set(cellKey, indexes)
      }
    }
  })

  return segmentIndexesByCell
}

function findClosestSegmentPoints(
  first: PhysicalSegment,
  second: PhysicalSegment,
): ClosestSegmentPoints {
  const firstDirection = subtract(first.projectedTo, first.projectedFrom)
  const secondDirection = subtract(second.projectedTo, second.projectedFrom)
  const directionsCross = cross(firstDirection, secondDirection)

  if (Math.abs(directionsCross) > Number.EPSILON) {
    const betweenStarts = subtract(second.projectedFrom, first.projectedFrom)
    const firstPosition = cross(betweenStarts, secondDirection) / directionsCross
    const secondPosition = cross(betweenStarts, firstDirection) / directionsCross

    if (
      firstPosition >= 0 &&
      firstPosition <= 1 &&
      secondPosition >= 0 &&
      secondPosition <= 1
    ) {
      return { firstPosition, secondPosition }
    }
  }

  const candidates = [
    endpointProjection(first.projectedFrom, second, 0, true),
    endpointProjection(first.projectedTo, second, 1, true),
    endpointProjection(second.projectedFrom, first, 0, false),
    endpointProjection(second.projectedTo, first, 1, false),
    midpointProjection(first, second, true),
    midpointProjection(second, first, false),
  ]

  return candidates.sort((firstCandidate, secondCandidate) =>
    compareClosestPoints(firstCandidate, secondCandidate, first, second),
  )[0]
}

function endpointProjection(
  endpoint: ProjectedPoint,
  segment: PhysicalSegment,
  endpointPosition: number,
  endpointBelongsToFirst: boolean,
) {
  const projectedPosition = projectPointOntoSegment(endpoint, segment)

  return endpointBelongsToFirst
    ? { firstPosition: endpointPosition, secondPosition: projectedPosition }
    : { firstPosition: projectedPosition, secondPosition: endpointPosition }
}

function midpointProjection(
  midpointSegment: PhysicalSegment,
  otherSegment: PhysicalSegment,
  midpointBelongsToFirst: boolean,
) {
  const midpoint = {
    x: (midpointSegment.projectedFrom.x + midpointSegment.projectedTo.x) / 2,
    y: (midpointSegment.projectedFrom.y + midpointSegment.projectedTo.y) / 2,
  }
  const projectedPosition = projectPointOntoSegment(midpoint, otherSegment)

  return midpointBelongsToFirst
    ? { firstPosition: 0.5, secondPosition: projectedPosition }
    : { firstPosition: projectedPosition, secondPosition: 0.5 }
}

function compareClosestPoints(
  first: ClosestSegmentPoints,
  second: ClosestSegmentPoints,
  firstSegment: PhysicalSegment,
  secondSegment: PhysicalSegment,
) {
  const firstDistance = squaredDistanceBetweenSegmentPositions(first)
  const secondDistance = squaredDistanceBetweenSegmentPositions(second)
  const distanceDifference = firstDistance - secondDistance

  if (Math.abs(distanceDifference) > distanceComparisonToleranceMeters ** 2) {
    return distanceDifference
  }

  const firstCenterOffset =
    Math.abs(first.firstPosition - 0.5) + Math.abs(first.secondPosition - 0.5)
  const secondCenterOffset =
    Math.abs(second.firstPosition - 0.5) + Math.abs(second.secondPosition - 0.5)

  return firstCenterOffset - secondCenterOffset

  function squaredDistanceBetweenSegmentPositions(
    positions: ClosestSegmentPoints,
  ) {
    const firstPoint = interpolateProjectedPoint(
      firstSegment.projectedFrom,
      firstSegment.projectedTo,
      positions.firstPosition,
    )
    const secondPoint = interpolateProjectedPoint(
      secondSegment.projectedFrom,
      secondSegment.projectedTo,
      positions.secondPosition,
    )
    return (firstPoint.x - secondPoint.x) ** 2 + (firstPoint.y - secondPoint.y) ** 2
  }
}

function projectPointOntoSegment(
  point: ProjectedPoint,
  segment: PhysicalSegment,
) {
  const direction = subtract(segment.projectedTo, segment.projectedFrom)
  const lengthSquared = direction.x ** 2 + direction.y ** 2

  if (lengthSquared === 0) {
    return 0
  }

  const fromStart = subtract(point, segment.projectedFrom)
  return clamp(
    (fromStart.x * direction.x + fromStart.y * direction.y) / lengthSquared,
    0,
    1,
  )
}

function orderCandidateEndpoints(
  first: PhysicalSegment,
  second: PhysicalSegment,
  closest: ClosestSegmentPoints,
  firstPosition: RoutingPosition,
  secondPosition: RoutingPosition,
) {
  if (first.componentId.localeCompare(second.componentId) <= 0) {
    return {
      componentIds: [first.componentId, second.componentId] as const,
      fromEdge: first.edge,
      toEdge: second.edge,
      fromPositionAlongEdge: closest.firstPosition,
      toPositionAlongEdge: closest.secondPosition,
      fromPosition: firstPosition,
      toPosition: secondPosition,
    }
  }

  return {
    componentIds: [second.componentId, first.componentId] as const,
    fromEdge: second.edge,
    toEdge: first.edge,
    fromPositionAlongEdge: closest.secondPosition,
    toPositionAlongEdge: closest.firstPosition,
    fromPosition: secondPosition,
    toPosition: firstPosition,
  }
}

function compareCandidates(
  first: CandidateWithEdges,
  second: CandidateWithEdges,
) {
  const distanceDifference = first.distanceMeters - second.distanceMeters

  if (Math.abs(distanceDifference) > distanceComparisonToleranceMeters) {
    return distanceDifference
  }

  return candidateSignature(first).localeCompare(candidateSignature(second))
}

function candidateSignature(candidate: CandidateWithEdges) {
  return [
    ...candidate.componentIds,
    candidate.fromEdge.id,
    candidate.fromPositionAlongEdge.toFixed(12),
    candidate.toEdge.id,
    candidate.toPositionAlongEdge.toFixed(12),
  ].join('\u0000')
}

function createIndexedEdgeSnap(
  pointIndex: number,
  edge: RoutingEdge,
  position: RoutingPosition,
  positionAlongEdge: number,
): IndexedRoutingEdgeSnap {
  return {
    pointIndex,
    snap: {
      edge,
      snappedPosition: position,
      distanceMeters: 0,
      positionAlongEdge,
    },
  }
}

function createLocalProjection(referenceLatitude: number) {
  const longitudeScale =
    earthRadiusMeters * Math.cos((referenceLatitude * Math.PI) / 180)
  const latitudeScale = earthRadiusMeters

  return (position: RoutingPosition): ProjectedPoint => ({
    x: (position.longitude * Math.PI * longitudeScale) / 180,
    y: (position.latitude * Math.PI * latitudeScale) / 180,
  })
}

function interpolatePosition(
  from: RoutingPosition,
  to: RoutingPosition,
  position: number,
): RoutingPosition {
  return {
    longitude: from.longitude + (to.longitude - from.longitude) * position,
    latitude: from.latitude + (to.latitude - from.latitude) * position,
  }
}

function interpolateProjectedPoint(
  from: ProjectedPoint,
  to: ProjectedPoint,
  position: number,
) {
  return {
    x: from.x + (to.x - from.x) * position,
    y: from.y + (to.y - from.y) * position,
  }
}

function subtract(first: ProjectedPoint, second: ProjectedPoint) {
  return {
    x: first.x - second.x,
    y: first.y - second.y,
  }
}

function cross(first: ProjectedPoint, second: ProjectedPoint) {
  return first.x * second.y - first.y * second.x
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function createSortedPairKey(first: number, second: number) {
  return first < second ? `${first}:${second}` : `${second}:${first}`
}
