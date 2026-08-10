export type RoutingArea = {
  id: string
  name: string
  bounds: {
    south: number
    west: number
    north: number
    east: number
  }
}

export const routingAreas: Readonly<Record<string, RoutingArea>> = {
  nerskogen: {
    id: 'nerskogen',
    name: 'Nerskogen',
    bounds: {
      south: 62.735,
      west: 9.5,
      north: 62.825,
      east: 9.69,
    },
  },
}

export function getRoutingArea(areaId: string) {
  const area = routingAreas[areaId]

  if (!area) {
    throw new Error(`Unknown routing area: ${areaId}`)
  }

  return area
}
