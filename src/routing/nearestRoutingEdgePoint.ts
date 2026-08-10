import type { GeographicCoordinate } from '../utils/geographicDistance'
import { calculateGeographicDistanceMeters } from '../utils/geographicDistance'
import type { RoutingEdge, RoutingGraph } from './routingTypes'

export type NearestRoutingEdgePoint = {
  edge: RoutingEdge
  snappedPosition: GeographicCoordinate
  distanceMeters: number
  positionAlongEdge: number
}

const DISTANCE_TIE_TOLERANCE_METERS = 1e-6

export function findNearestRoutingEdgePoint(
  graph: RoutingGraph,
  position: GeographicCoordinate,
  maxDistanceMeters: number,
): NearestRoutingEdgePoint | null {
  let nearest: NearestRoutingEdgePoint | undefined

  for (const edge of graph.edges) {
    const fromNode = graph.nodes.get(edge.fromNodeId)
    const toNode = graph.nodes.get(edge.toNodeId)

    if (!fromNode || !toNode) {
      continue
    }

    const positionAlongEdge = projectPositionOntoSegment(
      position,
      fromNode,
      toNode,
    )
    const snappedPosition = interpolateGreatCircle(
      fromNode,
      toNode,
      positionAlongEdge,
    )
    const distanceMeters = calculateGeographicDistanceMeters(
      position,
      snappedPosition,
    )

    if (
      !nearest ||
      distanceMeters <
        nearest.distanceMeters - DISTANCE_TIE_TOLERANCE_METERS ||
      (Math.abs(distanceMeters - nearest.distanceMeters) <=
        DISTANCE_TIE_TOLERANCE_METERS &&
        edge.id < nearest.edge.id)
    ) {
      nearest = {
        edge,
        snappedPosition,
        distanceMeters,
        positionAlongEdge,
      }
    }
  }

  if (!nearest || nearest.distanceMeters > maxDistanceMeters) {
    return null
  }

  return nearest
}

function projectPositionOntoSegment(
  position: GeographicCoordinate,
  from: GeographicCoordinate,
  to: GeographicCoordinate,
) {
  const referenceLatitudeRadians = degreesToRadians(position.latitude)
  const longitudeScale = Math.cos(referenceLatitudeRadians)
  const fromX =
    degreesToRadians(from.longitude - position.longitude) * longitudeScale
  const fromY = degreesToRadians(from.latitude - position.latitude)
  const toX =
    degreesToRadians(to.longitude - position.longitude) * longitudeScale
  const toY = degreesToRadians(to.latitude - position.latitude)
  const segmentX = toX - fromX
  const segmentY = toY - fromY
  const squaredSegmentLength = segmentX ** 2 + segmentY ** 2

  if (squaredSegmentLength === 0) {
    return 0
  }

  return clamp(
    -(fromX * segmentX + fromY * segmentY) / squaredSegmentLength,
    0,
    1,
  )
}

function interpolateGreatCircle(
  from: GeographicCoordinate,
  to: GeographicCoordinate,
  positionAlongEdge: number,
): GeographicCoordinate {
  if (positionAlongEdge === 0) {
    return { longitude: from.longitude, latitude: from.latitude }
  }

  if (positionAlongEdge === 1) {
    return { longitude: to.longitude, latitude: to.latitude }
  }

  const fromVector = toUnitVector(from)
  const toVector = toUnitVector(to)
  const angularDistance = Math.acos(
    clamp(dotProduct(fromVector, toVector), -1, 1),
  )

  if (angularDistance < 1e-12) {
    return {
      longitude:
        from.longitude + (to.longitude - from.longitude) * positionAlongEdge,
      latitude:
        from.latitude + (to.latitude - from.latitude) * positionAlongEdge,
    }
  }

  const sineDistance = Math.sin(angularDistance)
  const fromWeight =
    Math.sin((1 - positionAlongEdge) * angularDistance) / sineDistance
  const toWeight =
    Math.sin(positionAlongEdge * angularDistance) / sineDistance
  const x = fromWeight * fromVector.x + toWeight * toVector.x
  const y = fromWeight * fromVector.y + toWeight * toVector.y
  const z = fromWeight * fromVector.z + toWeight * toVector.z

  return {
    longitude: radiansToDegrees(Math.atan2(y, x)),
    latitude: radiansToDegrees(Math.atan2(z, Math.sqrt(x ** 2 + y ** 2))),
  }
}

function toUnitVector(position: GeographicCoordinate) {
  const longitude = degreesToRadians(position.longitude)
  const latitude = degreesToRadians(position.latitude)
  const latitudeCosine = Math.cos(latitude)

  return {
    x: latitudeCosine * Math.cos(longitude),
    y: latitudeCosine * Math.sin(longitude),
    z: Math.sin(latitude),
  }
}

function dotProduct(
  first: { x: number; y: number; z: number },
  second: { x: number; y: number; z: number },
) {
  return first.x * second.x + first.y * second.y + first.z * second.z
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180
}

function radiansToDegrees(radians: number) {
  return (radians * 180) / Math.PI
}
