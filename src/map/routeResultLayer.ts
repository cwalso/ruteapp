import type { GeoJSONSource, LayerSpecification, Map } from 'maplibre-gl'
import type { EdgeType } from '../routing/routingTypes'
import type { GeographicCoordinate } from '../utils/geographicDistance'

const ROUTE_RESULT_SOURCE_ID = 'route-result-source'
const ROUTE_RESULT_CASING_LAYER_ID = 'route-result-casing'
const ROUTE_RESULT_LAYER_ID = 'route-result'
const VIRTUAL_ROUTE_RESULT_LAYER_ID = 'route-result-virtual'

export type RouteResultSegment = {
  edgeType: EdgeType
  coordinates: readonly [GeographicCoordinate, GeographicCoordinate]
}

const routeResultCasingLayer = {
  id: ROUTE_RESULT_CASING_LAYER_ID,
  type: 'line',
  source: ROUTE_RESULT_SOURCE_ID,
  filter: ['!=', ['get', 'edgeType'], 'virtual'],
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': '#ffffff',
    'line-opacity': 0.9,
    'line-width': 8,
  },
} satisfies LayerSpecification

const routeResultLayer = {
  id: ROUTE_RESULT_LAYER_ID,
  type: 'line',
  source: ROUTE_RESULT_SOURCE_ID,
  filter: ['!=', ['get', 'edgeType'], 'virtual'],
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': '#c2382a',
    'line-opacity': 1,
    'line-width': 5,
  },
} satisfies LayerSpecification

const virtualRouteResultLayer = {
  id: VIRTUAL_ROUTE_RESULT_LAYER_ID,
  type: 'line',
  source: ROUTE_RESULT_SOURCE_ID,
  filter: ['==', ['get', 'edgeType'], 'virtual'],
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': '#67308f',
    'line-opacity': 1,
    'line-width': 5,
    'line-dasharray': [1.4, 1.4],
  },
} satisfies LayerSpecification

export function syncRouteResultLine(
  map: Map,
  routeSegments: readonly RouteResultSegment[],
) {
  const source = map.getSource(ROUTE_RESULT_SOURCE_ID) as
    | GeoJSONSource
    | undefined

  if (source) {
    source.setData(createRouteResultData(routeSegments))
    return
  }

  if (!map.isStyleLoaded()) {
    return
  }

  upsertRouteResultLine(map, routeSegments)
}

export function restoreRouteResultLine(
  map: Map,
  routeSegments: readonly RouteResultSegment[],
) {
  upsertRouteResultLine(map, routeSegments)
}

function upsertRouteResultLine(
  map: Map,
  routeSegments: readonly RouteResultSegment[],
) {
  const data = createRouteResultData(routeSegments)
  const source = map.getSource(ROUTE_RESULT_SOURCE_ID) as
    | GeoJSONSource
    | undefined

  if (source) {
    source.setData(data)
  } else {
    map.addSource(ROUTE_RESULT_SOURCE_ID, {
      type: 'geojson',
      data,
    })
  }

  if (!map.getLayer(ROUTE_RESULT_CASING_LAYER_ID)) {
    map.addLayer(routeResultCasingLayer)
  }

  if (!map.getLayer(ROUTE_RESULT_LAYER_ID)) {
    map.addLayer(routeResultLayer)
  }

  if (!map.getLayer(VIRTUAL_ROUTE_RESULT_LAYER_ID)) {
    map.addLayer(virtualRouteResultLayer)
  }
}

function createRouteResultData(
  routeSegments: readonly RouteResultSegment[],
) {
  return {
    type: 'FeatureCollection' as const,
    features: routeSegments.map(({ edgeType, coordinates }) => ({
      type: 'Feature' as const,
      properties: { edgeType },
      geometry: {
        type: 'LineString' as const,
        coordinates: coordinates.map(({ longitude, latitude }) => [
          longitude,
          latitude,
        ]),
      },
    })),
  }
}
