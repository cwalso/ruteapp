import type {
  FilterSpecification,
  GeoJSONSource,
  LayerSpecification,
  Map,
  MapGeoJSONFeature,
  PointLike,
} from 'maplibre-gl'
import { Popup } from 'maplibre-gl'
import type {
  SameComponentShortcutDebugData,
  SameComponentShortcutDebugFeature,
  SameComponentShortcutDebugProperties,
} from './sameComponentShortcutDebugData'

const SOURCE_ID = 'same-component-shortcut-debug-source'
const LINE_LAYER_ID = 'same-component-shortcut-debug-lines'
const SELECTED_LINE_LAYER_ID = 'same-component-shortcut-debug-selected-line'
const HIT_LAYER_ID = 'same-component-shortcut-debug-hit-area'
const ENDPOINT_SOURCE_ID = 'same-component-shortcut-debug-endpoints-source'
const ENDPOINT_LAYER_ID = 'same-component-shortcut-debug-endpoints'
const NO_SELECTED_CANDIDATE_ID = '__no-selected-shortcut__'

const activePopupByMap = new WeakMap<Map, Popup>()

const lineLayer = {
  id: LINE_LAYER_ID,
  type: 'line',
  source: SOURCE_ID,
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': '#e58a00',
    'line-opacity': 0.78,
    'line-width': 2.2,
    'line-dasharray': [2, 2],
  },
} satisfies LayerSpecification

const hitLayer = {
  id: HIT_LAYER_ID,
  type: 'line',
  source: SOURCE_ID,
  paint: {
    'line-color': '#e58a00',
    'line-opacity': 0,
    'line-width': 14,
  },
} satisfies LayerSpecification

const selectedLineLayer = {
  id: SELECTED_LINE_LAYER_ID,
  type: 'line',
  source: SOURCE_ID,
  filter: candidateFilter(),
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': '#ff9d00',
    'line-opacity': 1,
    'line-width': 5,
    'line-dasharray': [2, 1.5],
  },
} satisfies LayerSpecification

const endpointLayer = {
  id: ENDPOINT_LAYER_ID,
  type: 'circle',
  source: ENDPOINT_SOURCE_ID,
  paint: {
    'circle-radius': 6,
    'circle-color': '#ff9d00',
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 2,
  },
} satisfies LayerSpecification

export function syncSameComponentShortcutDebugLayer(
  map: Map,
  data: SameComponentShortcutDebugData,
  selectedFeature?: SameComponentShortcutDebugFeature,
) {
  const startedAt = performance.now()
  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined

  if (data.features.length === 0) {
    activePopupByMap.get(map)?.remove()
    activePopupByMap.delete(map)
  }

  if (source) {
    source.setData(data)
    syncSelection(map, selectedFeature)
    return performance.now() - startedAt
  }

  if (!map.isStyleLoaded()) {
    return performance.now() - startedAt
  }

  upsertLayer(map, data, selectedFeature)
  return performance.now() - startedAt
}

export function restoreSameComponentShortcutDebugLayer(
  map: Map,
  data: SameComponentShortcutDebugData,
  selectedFeature?: SameComponentShortcutDebugFeature,
) {
  const startedAt = performance.now()
  upsertLayer(map, data, selectedFeature)
  return performance.now() - startedAt
}

export function inspectSameComponentShortcutAtPoint(
  map: Map,
  point: PointLike,
) {
  if (!map.getLayer(HIT_LAYER_ID)) {
    return false
  }

  const feature = map.queryRenderedFeatures(point, {
    layers: [HIT_LAYER_ID],
  })[0]

  if (!feature) {
    return false
  }

  showPopup(map, feature)
  return true
}

export function showSameComponentShortcutPopup(
  map: Map,
  feature: SameComponentShortcutDebugFeature,
) {
  showPopup(map, feature)
}

function upsertLayer(
  map: Map,
  data: SameComponentShortcutDebugData,
  selectedFeature?: SameComponentShortcutDebugFeature,
) {
  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined

  if (source) {
    source.setData(data)
  } else {
    map.addSource(SOURCE_ID, { type: 'geojson', data })
  }

  if (!map.getLayer(LINE_LAYER_ID)) {
    map.addLayer(lineLayer)
  }

  if (!map.getLayer(SELECTED_LINE_LAYER_ID)) {
    map.addLayer(selectedLineLayer)
  }

  if (!map.getLayer(HIT_LAYER_ID)) {
    map.addLayer(hitLayer)
  }

  if (!map.getSource(ENDPOINT_SOURCE_ID)) {
    map.addSource(ENDPOINT_SOURCE_ID, {
      type: 'geojson',
      data: createEndpointData(),
    })
  }

  if (!map.getLayer(ENDPOINT_LAYER_ID)) {
    map.addLayer(endpointLayer)
  }

  syncSelection(map, selectedFeature)
}

function syncSelection(
  map: Map,
  selectedFeature: SameComponentShortcutDebugFeature | undefined,
) {
  if (map.getLayer(LINE_LAYER_ID)) {
    map.setPaintProperty(
      LINE_LAYER_ID,
      'line-opacity',
      selectedFeature ? 0.2 : 0.78,
    )
  }

  if (map.getLayer(SELECTED_LINE_LAYER_ID)) {
    map.setFilter(
      SELECTED_LINE_LAYER_ID,
      candidateFilter(selectedFeature?.properties.candidateId),
    )
  }

  const endpointSource = map.getSource(ENDPOINT_SOURCE_ID) as
    | GeoJSONSource
    | undefined
  endpointSource?.setData(createEndpointData(selectedFeature))
}

function showPopup(
  map: Map,
  feature: MapGeoJSONFeature | SameComponentShortcutDebugFeature,
) {
  const properties = feature.properties as SameComponentShortcutDebugProperties
  const content = document.createElement('div')
  const title = document.createElement('strong')
  const details = document.createElement('dl')

  title.textContent = `Shortcut: ${properties.shortcutId}`
  content.append(title, details)
  appendDetail(
    details,
    'Direkte',
    formatDistance(properties.directDistanceMeters),
  )
  appendDetail(
    details,
    'Via nett',
    formatDistance(properties.ordinaryNetworkDistanceMeters),
  )
  appendDetail(details, 'Omvei', `${properties.detourRatio.toFixed(1)}×`)
  appendDetail(
    details,
    'Type',
    `${properties.fromEdgeType} → ${properties.toEdgeType}`,
  )
  appendDetail(details, 'Candidate ID', properties.candidateId)
  appendDetail(
    details,
    'Edges',
    `${properties.fromEdgeId} → ${properties.toEdgeId}`,
  )

  activePopupByMap.get(map)?.remove()
  const popup = new Popup({
    className: 'same-component-shortcut-popup',
    closeButton: true,
    closeOnClick: true,
    maxWidth: '22rem',
  })
    .setLngLat(getPopupCoordinates(feature))
    .setDOMContent(content)
    .addTo(map)
  activePopupByMap.set(map, popup)
}

function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1_000) {
    return `${Math.round(distanceMeters)} m`
  }

  return `${(distanceMeters / 1_000).toFixed(2).replace('.', ',')} km`
}

function appendDetail(container: HTMLElement, label: string, value: string) {
  const term = document.createElement('dt')
  const description = document.createElement('dd')
  term.textContent = label
  description.textContent = value
  container.append(term, description)
}

function getPopupCoordinates(
  feature: MapGeoJSONFeature | SameComponentShortcutDebugFeature,
) {
  if (feature.geometry.type !== 'LineString') {
    throw new Error('Shortcut debug feature must be a LineString.')
  }

  const [from, to] = feature.geometry.coordinates
  return {
    lng: (from[0] + to[0]) / 2,
    lat: (from[1] + to[1]) / 2,
  }
}

function candidateFilter(candidateId = NO_SELECTED_CANDIDATE_ID) {
  return [
    '==',
    ['get', 'candidateId'],
    candidateId,
  ] as FilterSpecification
}

function createEndpointData(
  selectedFeature?: SameComponentShortcutDebugFeature,
) {
  return {
    type: 'FeatureCollection' as const,
    features: selectedFeature
      ? selectedFeature.geometry.coordinates.map((coordinates, index) => ({
          type: 'Feature' as const,
          id: `${selectedFeature.properties.candidateId}:${index}`,
          properties: {},
          geometry: {
            type: 'Point' as const,
            coordinates,
          },
        }))
      : [],
  }
}
