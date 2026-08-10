import type { GeoJSONSource, LayerSpecification, Map } from 'maplibre-gl'
import type { GeographicCoordinate } from '../utils/geographicDistance'

export type RouteSnapDebugConnection = {
  pointIndex: number
  originalPosition: GeographicCoordinate
  snappedPosition: GeographicCoordinate
  distanceMeters: number
}

const ROUTE_SNAP_DEBUG_SOURCE_ID = 'route-snap-debug-source'
const ROUTE_SNAP_DEBUG_LINE_LAYER_ID = 'route-snap-debug-lines'
const ROUTE_SNAP_DEBUG_POINT_LAYER_ID = 'route-snap-debug-points'

const routeSnapDebugLineLayer = {
  id: ROUTE_SNAP_DEBUG_LINE_LAYER_ID,
  type: 'line',
  source: ROUTE_SNAP_DEBUG_SOURCE_ID,
  filter: ['==', ['geometry-type'], 'LineString'],
  layout: {
    'line-cap': 'round',
  },
  paint: {
    'line-color': '#d81b60',
    'line-opacity': 0.9,
    'line-width': 2,
  },
} satisfies LayerSpecification

const routeSnapDebugPointLayer = {
  id: ROUTE_SNAP_DEBUG_POINT_LAYER_ID,
  type: 'circle',
  source: ROUTE_SNAP_DEBUG_SOURCE_ID,
  filter: ['==', ['geometry-type'], 'Point'],
  paint: {
    'circle-color': '#ffeb3b',
    'circle-radius': 5,
    'circle-stroke-color': '#d81b60',
    'circle-stroke-width': 2,
  },
} satisfies LayerSpecification

export function syncRouteSnapDebugLayer(
  map: Map,
  connections: readonly RouteSnapDebugConnection[],
) {
  const source = map.getSource(ROUTE_SNAP_DEBUG_SOURCE_ID) as
    | GeoJSONSource
    | undefined

  if (source) {
    source.setData(createRouteSnapDebugData(connections))
    return
  }

  if (!map.isStyleLoaded()) {
    return
  }

  upsertRouteSnapDebugLayer(map, connections)
}

export function restoreRouteSnapDebugLayer(
  map: Map,
  connections: readonly RouteSnapDebugConnection[],
) {
  upsertRouteSnapDebugLayer(map, connections)
}

function upsertRouteSnapDebugLayer(
  map: Map,
  connections: readonly RouteSnapDebugConnection[],
) {
  const data = createRouteSnapDebugData(connections)
  const source = map.getSource(ROUTE_SNAP_DEBUG_SOURCE_ID) as
    | GeoJSONSource
    | undefined

  if (source) {
    source.setData(data)
  } else {
    map.addSource(ROUTE_SNAP_DEBUG_SOURCE_ID, {
      type: 'geojson',
      data,
    })
  }

  if (!map.getLayer(ROUTE_SNAP_DEBUG_LINE_LAYER_ID)) {
    map.addLayer(routeSnapDebugLineLayer)
  }

  if (!map.getLayer(ROUTE_SNAP_DEBUG_POINT_LAYER_ID)) {
    map.addLayer(routeSnapDebugPointLayer)
  }
}

function createRouteSnapDebugData(
  connections: readonly RouteSnapDebugConnection[],
) {
  return {
    type: 'FeatureCollection' as const,
    features: connections.flatMap((connection) => [
      {
        type: 'Feature' as const,
        properties: {
          pointIndex: connection.pointIndex,
          distanceMeters: connection.distanceMeters,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            toCoordinate(connection.originalPosition),
            toCoordinate(connection.snappedPosition),
          ],
        },
      },
      {
        type: 'Feature' as const,
        properties: {
          pointIndex: connection.pointIndex,
          distanceMeters: connection.distanceMeters,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: toCoordinate(connection.snappedPosition),
        },
      },
    ]),
  }
}

function toCoordinate({ longitude, latitude }: GeographicCoordinate) {
  return [longitude, latitude]
}
