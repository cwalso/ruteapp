import type { GeoJSONSource, LayerSpecification, Map } from 'maplibre-gl'
import type { RoutePoint } from '../types/routePoint'

const ROUTE_LINE_SOURCE_ID = 'route-planning-line-source'
const ROUTE_LINE_LAYER_ID = 'route-planning-line'

const routeLineLayer = {
  id: ROUTE_LINE_LAYER_ID,
  type: 'line',
  source: ROUTE_LINE_SOURCE_ID,
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': '#405c68',
    'line-dasharray': [0.5, 2.5],
    'line-opacity': 0.55,
    'line-width': 1.5,
  },
} satisfies LayerSpecification

export function syncRoutePlanningLine(
  map: Map,
  routePoints: readonly RoutePoint[],
) {
  const source = map.getSource(ROUTE_LINE_SOURCE_ID) as
    | GeoJSONSource
    | undefined

  if (source) {
    source.setData(createRouteLineData(routePoints))
    return
  }

  if (!map.isStyleLoaded()) {
    return
  }

  upsertRoutePlanningLine(map, routePoints)
}

export function restoreRoutePlanningLine(
  map: Map,
  routePoints: readonly RoutePoint[],
) {
  upsertRoutePlanningLine(map, routePoints)
}

function upsertRoutePlanningLine(
  map: Map,
  routePoints: readonly RoutePoint[],
) {
  const data = createRouteLineData(routePoints)
  const source = map.getSource(ROUTE_LINE_SOURCE_ID) as
    | GeoJSONSource
    | undefined

  if (source) {
    source.setData(data)
  } else {
    map.addSource(ROUTE_LINE_SOURCE_ID, {
      type: 'geojson',
      data,
    })
  }

  if (!map.getLayer(ROUTE_LINE_LAYER_ID)) {
    map.addLayer(routeLineLayer)
  }
}

function createRouteLineData(routePoints: readonly RoutePoint[]) {
  return {
    type: 'FeatureCollection' as const,
    features:
      routePoints.length > 1
        ? [
            {
              type: 'Feature' as const,
              properties: {},
              geometry: {
                type: 'LineString' as const,
                coordinates: routePoints.map(({ longitude, latitude }) => [
                  longitude,
                  latitude,
                ]),
              },
            },
          ]
        : [],
  }
}
