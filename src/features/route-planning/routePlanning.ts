import type { RoutePoint } from '../../types/routePoint'

const EARTH_RADIUS_METERS = 6_371_008.8

export type RoutePointRole = {
  kind: 'start' | 'via' | 'end'
  label: string
}

export function getRoutePointRole(
  index: number,
  pointCount: number,
): RoutePointRole {
  if (index === 0) {
    return { kind: 'start', label: 'A' }
  }

  if (index === pointCount - 1) {
    return { kind: 'end', label: 'B' }
  }

  return { kind: 'via', label: String(index) }
}

export function calculateRouteDistanceMeters(
  routePoints: readonly RoutePoint[],
) {
  let totalDistance = 0

  for (let index = 1; index < routePoints.length; index += 1) {
    totalDistance += calculateDistanceBetween(
      routePoints[index - 1],
      routePoints[index],
    )
  }

  return totalDistance
}

export function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1_000) {
    return `${Math.round(distanceMeters)} m`
  }

  return `${new Intl.NumberFormat('nb-NO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(distanceMeters / 1_000)} km`
}

function calculateDistanceBetween(from: RoutePoint, to: RoutePoint) {
  const fromLatitude = degreesToRadians(from.latitude)
  const toLatitude = degreesToRadians(to.latitude)
  const latitudeDelta = toLatitude - fromLatitude
  const longitudeDelta = degreesToRadians(to.longitude - from.longitude)

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2

  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  )
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180
}
