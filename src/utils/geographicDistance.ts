export type GeographicCoordinate = {
  longitude: number
  latitude: number
}

const EARTH_RADIUS_METERS = 6_371_008.8

export function calculateGeographicDistanceMeters(
  from: GeographicCoordinate,
  to: GeographicCoordinate,
) {
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
