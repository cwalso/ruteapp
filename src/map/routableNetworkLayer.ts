import type { GeoJSONSource, LayerSpecification, Map } from 'maplibre-gl'
import type { RoutableNetworkGeoJson } from './routableNetworkData'

const ROUTABLE_NETWORK_SOURCE_ID = 'routable-network-source'
const ROUTABLE_ROAD_LAYER_ID = 'routable-network-road'
const ROUTABLE_TRACK_LAYER_ID = 'routable-network-track'
const ROUTABLE_PATH_LAYER_ID = 'routable-network-path'

const widthByZoom = (overview: number, planning: number, detail: number) => [
  'interpolate',
  ['linear'],
  ['zoom'],
  11,
  overview,
  14,
  planning,
  16,
  detail,
] as [
  'interpolate',
  ['linear'],
  ['zoom'],
  number,
  number,
  number,
  number,
  number,
  number,
]

const roadLayer = {
  id: ROUTABLE_ROAD_LAYER_ID,
  type: 'line',
  source: ROUTABLE_NETWORK_SOURCE_ID,
  filter: ['==', ['get', 'edgeType'], 'road'],
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': '#435b5f',
    'line-opacity': 0.82,
    'line-width': widthByZoom(1.25, 2.1, 3.2),
  },
} satisfies LayerSpecification

const trackLayer = {
  id: ROUTABLE_TRACK_LAYER_ID,
  type: 'line',
  source: ROUTABLE_NETWORK_SOURCE_ID,
  filter: ['==', ['get', 'edgeType'], 'track'],
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': '#756128',
    'line-dasharray': [4, 2],
    'line-opacity': 0.88,
    'line-width': widthByZoom(1.1, 1.9, 2.8),
  },
} satisfies LayerSpecification

const pathLayer = {
  id: ROUTABLE_PATH_LAYER_ID,
  type: 'line',
  source: ROUTABLE_NETWORK_SOURCE_ID,
  filter: ['==', ['get', 'edgeType'], 'path'],
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': '#176d62',
    'line-dasharray': [1.2, 1.5],
    'line-opacity': 0.9,
    'line-width': widthByZoom(0.9, 1.6, 2.4),
  },
} satisfies LayerSpecification

export function syncRoutableNetworkLayer(
  map: Map,
  data: RoutableNetworkGeoJson,
) {
  const source = map.getSource(ROUTABLE_NETWORK_SOURCE_ID) as
    | GeoJSONSource
    | undefined

  if (source) {
    source.setData(data)
    return
  }

  if (!map.isStyleLoaded()) {
    return
  }

  restoreRoutableNetworkLayer(map, data)
}

export function restoreRoutableNetworkLayer(
  map: Map,
  data: RoutableNetworkGeoJson,
) {
  const source = map.getSource(ROUTABLE_NETWORK_SOURCE_ID) as
    | GeoJSONSource
    | undefined

  if (source) {
    source.setData(data)
  } else {
    map.addSource(ROUTABLE_NETWORK_SOURCE_ID, {
      type: 'geojson',
      data,
    })
  }

  for (const layer of [roadLayer, trackLayer, pathLayer]) {
    if (!map.getLayer(layer.id)) {
      map.addLayer(layer)
    }
  }
}
