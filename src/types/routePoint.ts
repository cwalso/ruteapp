export type RoutePoint = {
  id: string
  longitude: number
  latitude: number
}

export type RoutePointPosition = Pick<
  RoutePoint,
  'longitude' | 'latitude'
>
