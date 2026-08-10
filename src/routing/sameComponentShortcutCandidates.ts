import { calculateGeographicDistanceMeters } from '../utils/geographicDistance'
import { findRoute } from './aStar'
import { createRoutingGraph } from './routingGraph'
import type {
  EdgeType,
  RoutingEdge,
  RoutingGraph,
  RoutingNode,
} from './routingTypes'
import { findWeaklyConnectedComponents } from './virtualConnections'

export type SameComponentShortcutConfig = {
  minimumDirectDistanceMeters: number
  maximumDirectDistanceMeters: number
  minimumOrdinaryNetworkDistanceMeters: number
  minimumDetourRatio: number
  deduplicationRadiusMeters: number
}

export type SameComponentShortcutCandidate = {
  candidateId: string
  componentId: string
  fromEdgeId: string
  toEdgeId: string
  fromEdgeType: Exclude<EdgeType, 'virtual'>
  toEdgeType: Exclude<EdgeType, 'virtual'>
  fromCoordinate: RoutingPosition
  toCoordinate: RoutingPosition
  fromPositionAlongEdge: number
  toPositionAlongEdge: number
  directDistanceMeters: number
  ordinaryNetworkDistanceMeters: number
  networkCost: number
  detourRatio: number
}

export type SameComponentShortcutSearchResult = {
  componentCount: number
  physicalSegmentCount: number
  geographicPairsEvaluated: number
  nearbyPairs: number
  networkCalculations: number
  aStarRuns: number
  candidatesBeforeDeduplication: number
  candidates: readonly SameComponentShortcutCandidate[]
}

type RoutingPosition = Pick<RoutingNode, 'longitude' | 'latitude'>

type ProjectedPoint = {
  x: number
  y: number
}

type PhysicalSegment = {
  id: string
  edgeType: Exclude<EdgeType, 'virtual'>
  representativeEdge: RoutingEdge
  directedEdges: RoutingEdge[]
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

type TravelOption = {
  nodeId: string
  distanceMeters: number
  cost: number
}

type NetworkMeasurement = {
  distanceMeters: number
  cost: number
  aStarRuns: number
}

const earthRadiusMeters = 6_371_008.8
const distanceToleranceMeters = 1e-6

export function findSameComponentShortcutCandidates(
  graph: RoutingGraph,
  config: SameComponentShortcutConfig,
): SameComponentShortcutSearchResult {
  validateConfig(config)

  const ordinaryGraph = createRoutingGraph(
    [...graph.nodes.values()],
    graph.edges.filter(({ edgeType }) => edgeType !== 'virtual'),
  )
  const components = findWeaklyConnectedComponents(ordinaryGraph)
  const referenceLatitude =
    [...ordinaryGraph.nodes.values()].reduce(
      (sum, node) => sum + node.latitude,
      0,
    ) / Math.max(ordinaryGraph.nodes.size, 1)
  const segments = createPhysicalSegments(
    ordinaryGraph,
    components.componentByNodeId,
    createLocalProjection(referenceLatitude),
  )
  const segmentIndexesByCell = indexSegments(
    segments,
    config.maximumDirectDistanceMeters,
  )
  const evaluatedPairs = new Set<string>()
  const routeCache = new Map<
    string,
    ReturnType<typeof findRoute>
  >()
  const candidates: SameComponentShortcutCandidate[] = []
  let geographicPairsEvaluated = 0
  let nearbyPairs = 0
  let networkCalculations = 0
  let aStarRuns = 0

  for (const segmentIndexes of segmentIndexesByCell.values()) {
    for (let firstIndex = 0; firstIndex < segmentIndexes.length; firstIndex += 1) {
      const firstSegmentIndex = segmentIndexes[firstIndex]
      const first = segments[firstSegmentIndex]

      for (
        let secondIndex = firstIndex + 1;
        secondIndex < segmentIndexes.length;
        secondIndex += 1
      ) {
        const secondSegmentIndex = segmentIndexes[secondIndex]
        const pairKey = createSortedPairKey(
          firstSegmentIndex,
          secondSegmentIndex,
        )

        if (evaluatedPairs.has(pairKey)) {
          continue
        }
        evaluatedPairs.add(pairKey)
        geographicPairsEvaluated += 1

        const second = segments[secondSegmentIndex]

        if (
          first.componentId !== second.componentId ||
          shareNode(first, second)
        ) {
          continue
        }

        const closest = findClosestSegmentPoints(first, second)
        const firstCoordinate = interpolatePosition(
          first.from,
          first.to,
          closest.firstPosition,
        )
        const secondCoordinate = interpolatePosition(
          second.from,
          second.to,
          closest.secondPosition,
        )
        const directDistanceMeters = calculateGeographicDistanceMeters(
          firstCoordinate,
          secondCoordinate,
        )

        if (
          directDistanceMeters <
            config.minimumDirectDistanceMeters - distanceToleranceMeters ||
          directDistanceMeters >
            config.maximumDirectDistanceMeters + distanceToleranceMeters
        ) {
          continue
        }
        nearbyPairs += 1
        networkCalculations += 1

        const networkMeasurement = measureNetworkDistance(
          ordinaryGraph,
          first,
          closest.firstPosition,
          second,
          closest.secondPosition,
          routeCache,
        )
        aStarRuns += networkMeasurement?.aStarRuns ?? 0

        if (
          !networkMeasurement ||
          networkMeasurement.distanceMeters <
            config.minimumOrdinaryNetworkDistanceMeters -
              distanceToleranceMeters
        ) {
          continue
        }

        const detourRatio =
          networkMeasurement.distanceMeters / directDistanceMeters

        if (
          detourRatio < config.minimumDetourRatio - distanceToleranceMeters
        ) {
          continue
        }

        const ordered = orderEndpoints(
          first,
          second,
          closest,
          firstCoordinate,
          secondCoordinate,
        )
        const candidateId = createCandidateId(ordered)

        candidates.push({
          candidateId,
          componentId: first.componentId,
          fromEdgeId: ordered.from.representativeEdge.id,
          toEdgeId: ordered.to.representativeEdge.id,
          fromEdgeType: ordered.from.edgeType,
          toEdgeType: ordered.to.edgeType,
          fromCoordinate: ordered.fromCoordinate,
          toCoordinate: ordered.toCoordinate,
          fromPositionAlongEdge: ordered.fromPosition,
          toPositionAlongEdge: ordered.toPosition,
          directDistanceMeters,
          ordinaryNetworkDistanceMeters: networkMeasurement.distanceMeters,
          networkCost: networkMeasurement.cost,
          detourRatio,
        })
      }
    }
  }

  const deduplicatedCandidates = deduplicateCandidates(
    candidates,
    config.deduplicationRadiusMeters,
  )

  return {
    componentCount: components.componentIds.length,
    physicalSegmentCount: segments.length,
    geographicPairsEvaluated,
    nearbyPairs,
    networkCalculations,
    aStarRuns,
    candidatesBeforeDeduplication: candidates.length,
    candidates: deduplicatedCandidates,
  }
}

function createPhysicalSegments(
  graph: RoutingGraph,
  componentByNodeId: ReadonlyMap<string, string>,
  project: (position: RoutingPosition) => ProjectedPoint,
) {
  const groups = new Map<
    string,
    {
      edgeType: Exclude<EdgeType, 'virtual'>
      nodeIds: readonly [string, string]
      directedEdges: RoutingEdge[]
    }
  >()

  for (const edge of graph.edges) {
    if (edge.edgeType === 'virtual') {
      continue
    }

    const nodeIds = [edge.fromNodeId, edge.toNodeId].sort() as [string, string]
    const key = `${nodeIds[0]}\u0000${nodeIds[1]}\u0000${edge.edgeType}`
    const existing = groups.get(key)

    if (existing) {
      existing.directedEdges.push(edge)
    } else {
      groups.set(key, {
        nodeIds,
        edgeType: edge.edgeType,
        directedEdges: [edge],
      })
    }
  }

  return [...groups.entries()]
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .map(([id, group]): PhysicalSegment => {
      const from = getRequiredNode(graph, group.nodeIds[0])
      const to = getRequiredNode(graph, group.nodeIds[1])
      const directedEdges = group.directedEdges.sort((first, second) =>
        first.id.localeCompare(second.id),
      )

      return {
        id,
        edgeType: group.edgeType,
        representativeEdge: directedEdges[0],
        directedEdges,
        componentId: componentByNodeId.get(group.nodeIds[0])!,
        from,
        to,
        projectedFrom: project(from),
        projectedTo: project(to),
      }
    })
}

function indexSegments(
  segments: readonly PhysicalSegment[],
  maximumDistanceMeters: number,
) {
  const indexesByCell = new Map<string, number[]>()

  segments.forEach((segment, segmentIndex) => {
    const minimumX =
      Math.min(segment.projectedFrom.x, segment.projectedTo.x) -
      maximumDistanceMeters
    const maximumX =
      Math.max(segment.projectedFrom.x, segment.projectedTo.x) +
      maximumDistanceMeters
    const minimumY =
      Math.min(segment.projectedFrom.y, segment.projectedTo.y) -
      maximumDistanceMeters
    const maximumY =
      Math.max(segment.projectedFrom.y, segment.projectedTo.y) +
      maximumDistanceMeters

    for (
      let cellX = Math.floor(minimumX / maximumDistanceMeters);
      cellX <= Math.floor(maximumX / maximumDistanceMeters);
      cellX += 1
    ) {
      for (
        let cellY = Math.floor(minimumY / maximumDistanceMeters);
        cellY <= Math.floor(maximumY / maximumDistanceMeters);
        cellY += 1
      ) {
        const key = `${cellX}:${cellY}`
        const indexes = indexesByCell.get(key) ?? []
        indexes.push(segmentIndex)
        indexesByCell.set(key, indexes)
      }
    }
  })

  return indexesByCell
}

function measureNetworkDistance(
  graph: RoutingGraph,
  first: PhysicalSegment,
  firstPosition: number,
  second: PhysicalSegment,
  secondPosition: number,
  routeCache: Map<string, ReturnType<typeof findRoute>>,
): NetworkMeasurement | null {
  const attempts = [
    measureDirectionalNetworkDistance(
      graph,
      createDepartureOptions(first, firstPosition),
      createArrivalOptions(second, secondPosition),
      routeCache,
    ),
    measureDirectionalNetworkDistance(
      graph,
      createDepartureOptions(second, secondPosition),
      createArrivalOptions(first, firstPosition),
      routeCache,
    ),
  ]
  const measurements = attempts.flatMap(({ measurement }) =>
    measurement ? [measurement] : [],
  )
  const aStarRuns = attempts.reduce(
    (total, attempt) => total + attempt.aStarRuns,
    0,
  )

  if (measurements.length === 0) {
    return null
  }

  const best = measurements.sort(compareNetworkMeasurements)[0]

  return { ...best, aStarRuns }
}

function measureDirectionalNetworkDistance(
  graph: RoutingGraph,
  departures: readonly TravelOption[],
  arrivals: readonly TravelOption[],
  routeCache: Map<string, ReturnType<typeof findRoute>>,
): { measurement: NetworkMeasurement | null; aStarRuns: number } {
  let best: NetworkMeasurement | null = null
  let aStarRuns = 0

  for (const departure of departures) {
    for (const arrival of arrivals) {
      const cacheKey = `${departure.nodeId}\u0000${arrival.nodeId}`
      let route = routeCache.get(cacheKey)

      if (departure.nodeId === arrival.nodeId) {
        route = {
          nodeIds: [departure.nodeId],
          edges: [],
          totalDistanceMeters: 0,
          totalCost: 0,
        }
      } else if (!routeCache.has(cacheKey)) {
        route = findRoute(graph, departure.nodeId, arrival.nodeId)
        routeCache.set(cacheKey, route)
        aStarRuns += 1
      }

      if (!route) {
        continue
      }

      const measurement = {
        distanceMeters:
          departure.distanceMeters +
          route.totalDistanceMeters +
          arrival.distanceMeters,
        cost: departure.cost + route.totalCost + arrival.cost,
        aStarRuns: 0,
      }

      if (!best || compareNetworkMeasurements(measurement, best) < 0) {
        best = measurement
      }
    }
  }

  return { measurement: best, aStarRuns }
}

function createDepartureOptions(
  segment: PhysicalSegment,
  canonicalPosition: number,
) {
  return deduplicateTravelOptions(
    segment.directedEdges.map((edge) => {
      const position = getDirectedPosition(segment, edge, canonicalPosition)

      return {
        nodeId: edge.toNodeId,
        distanceMeters: edge.distanceMeters * (1 - position),
        cost: edge.cost * (1 - position),
      }
    }),
  )
}

function createArrivalOptions(
  segment: PhysicalSegment,
  canonicalPosition: number,
) {
  return deduplicateTravelOptions(
    segment.directedEdges.map((edge) => {
      const position = getDirectedPosition(segment, edge, canonicalPosition)

      return {
        nodeId: edge.fromNodeId,
        distanceMeters: edge.distanceMeters * position,
        cost: edge.cost * position,
      }
    }),
  )
}

function getDirectedPosition(
  segment: PhysicalSegment,
  edge: RoutingEdge,
  canonicalPosition: number,
) {
  return edge.fromNodeId === segment.from.id
    ? canonicalPosition
    : 1 - canonicalPosition
}

function deduplicateTravelOptions(options: readonly TravelOption[]) {
  const bestByNodeId = new Map<string, TravelOption>()

  for (const option of options) {
    const existing = bestByNodeId.get(option.nodeId)

    if (
      !existing ||
      option.distanceMeters < existing.distanceMeters - distanceToleranceMeters
    ) {
      bestByNodeId.set(option.nodeId, option)
    }
  }

  return [...bestByNodeId.values()].sort((first, second) =>
    first.nodeId.localeCompare(second.nodeId),
  )
}

function deduplicateCandidates(
  candidates: readonly SameComponentShortcutCandidate[],
  radiusMeters: number,
) {
  const selected: SameComponentShortcutCandidate[] = []

  for (const candidate of [...candidates].sort(compareCandidatePriority)) {
    const isDuplicate = selected.some(
      (existing) =>
        candidate.componentId === existing.componentId &&
        endpointsAreNear(candidate, existing, radiusMeters),
    )

    if (!isDuplicate) {
      selected.push(candidate)
    }
  }

  return selected.sort(compareCandidatePriority)
}

function endpointsAreNear(
  first: SameComponentShortcutCandidate,
  second: SameComponentShortcutCandidate,
  radiusMeters: number,
) {
  const sameOrientation =
    calculateGeographicDistanceMeters(
      first.fromCoordinate,
      second.fromCoordinate,
    ) <= radiusMeters &&
    calculateGeographicDistanceMeters(
      first.toCoordinate,
      second.toCoordinate,
    ) <= radiusMeters
  const oppositeOrientation =
    calculateGeographicDistanceMeters(
      first.fromCoordinate,
      second.toCoordinate,
    ) <= radiusMeters &&
    calculateGeographicDistanceMeters(
      first.toCoordinate,
      second.fromCoordinate,
    ) <= radiusMeters

  return sameOrientation || oppositeOrientation
}

function orderEndpoints(
  first: PhysicalSegment,
  second: PhysicalSegment,
  closest: ClosestSegmentPoints,
  firstCoordinate: RoutingPosition,
  secondCoordinate: RoutingPosition,
) {
  if (first.id.localeCompare(second.id) <= 0) {
    return {
      from: first,
      to: second,
      fromPosition: closest.firstPosition,
      toPosition: closest.secondPosition,
      fromCoordinate: firstCoordinate,
      toCoordinate: secondCoordinate,
    }
  }

  return {
    from: second,
    to: first,
    fromPosition: closest.secondPosition,
    toPosition: closest.firstPosition,
    fromCoordinate: secondCoordinate,
    toCoordinate: firstCoordinate,
  }
}

function createCandidateId(
  candidate: ReturnType<typeof orderEndpoints>,
) {
  return [
    'same-component-shortcut',
    candidate.from.representativeEdge.id,
    candidate.fromPosition.toFixed(6),
    candidate.to.representativeEdge.id,
    candidate.toPosition.toFixed(6),
  ].join(':')
}

function compareCandidatePriority(
  first: SameComponentShortcutCandidate,
  second: SameComponentShortcutCandidate,
) {
  return (
    second.detourRatio - first.detourRatio ||
    first.directDistanceMeters - second.directDistanceMeters ||
    second.ordinaryNetworkDistanceMeters - first.ordinaryNetworkDistanceMeters ||
    first.candidateId.localeCompare(second.candidateId)
  )
}

function compareNetworkMeasurements(
  first: NetworkMeasurement,
  second: NetworkMeasurement,
) {
  return (
    first.distanceMeters - second.distanceMeters ||
    first.cost - second.cost
  )
}

function shareNode(first: PhysicalSegment, second: PhysicalSegment) {
  return (
    first.from.id === second.from.id ||
    first.from.id === second.to.id ||
    first.to.id === second.from.id ||
    first.to.id === second.to.id
  )
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

  return candidates.sort((firstCandidate, secondCandidate) => {
    const distanceDifference =
      squaredDistanceBetweenSegmentPositions(
        firstCandidate,
        first,
        second,
      ) -
      squaredDistanceBetweenSegmentPositions(
        secondCandidate,
        first,
        second,
      )

    if (Math.abs(distanceDifference) > distanceToleranceMeters ** 2) {
      return distanceDifference
    }

    return (
      Math.abs(firstCandidate.firstPosition - 0.5) +
      Math.abs(firstCandidate.secondPosition - 0.5) -
      Math.abs(secondCandidate.firstPosition - 0.5) -
      Math.abs(secondCandidate.secondPosition - 0.5)
    )
  })[0]
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

function squaredDistanceBetweenSegmentPositions(
  positions: ClosestSegmentPoints,
  first: PhysicalSegment,
  second: PhysicalSegment,
) {
  const firstPoint = interpolateProjectedPoint(
    first.projectedFrom,
    first.projectedTo,
    positions.firstPosition,
  )
  const secondPoint = interpolateProjectedPoint(
    second.projectedFrom,
    second.projectedTo,
    positions.secondPosition,
  )

  return (firstPoint.x - secondPoint.x) ** 2 + (firstPoint.y - secondPoint.y) ** 2
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

function createLocalProjection(referenceLatitude: number) {
  const longitudeScale =
    earthRadiusMeters * Math.cos((referenceLatitude * Math.PI) / 180)

  return (position: RoutingPosition): ProjectedPoint => ({
    x: (position.longitude * Math.PI * longitudeScale) / 180,
    y: (position.latitude * Math.PI * earthRadiusMeters) / 180,
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
  return { x: first.x - second.x, y: first.y - second.y }
}

function cross(first: ProjectedPoint, second: ProjectedPoint) {
  return first.x * second.y - first.y * second.x
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function createSortedPairKey(first: number, second: number) {
  return first < second ? `${first}:${second}` : `${second}:${first}`
}

function getRequiredNode(graph: RoutingGraph, nodeId: string) {
  const node = graph.nodes.get(nodeId)

  if (!node) {
    throw new Error(`Routing edge references an unknown node: ${nodeId}`)
  }

  return node
}

function validateConfig(config: SameComponentShortcutConfig) {
  const values = Object.values(config)

  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('Shortcut candidate thresholds must be finite and non-negative.')
  }

  if (
    config.maximumDirectDistanceMeters <=
    config.minimumDirectDistanceMeters
  ) {
    throw new Error('Maximum direct distance must exceed minimum direct distance.')
  }

  if (config.minimumDetourRatio <= 1) {
    throw new Error('Minimum detour ratio must exceed 1.')
  }
}
