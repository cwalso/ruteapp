import type {
  GeoJSONFeature,
  GeoJSONSource,
  LayerSpecification,
  Map,
  MapGeoJSONFeature,
  PointLike,
} from 'maplibre-gl'
import { Popup } from 'maplibre-gl'
import type { VirtualConnectionCandidate } from '../routing/virtualConnections'
import {
  createVirtualCandidateDebugData,
  type VirtualCandidateDebugProperties,
} from './virtualCandidateDebugData'

const VIRTUAL_CANDIDATE_DEBUG_SOURCE_ID =
  'virtual-candidate-debug-source'
const VIRTUAL_CANDIDATE_DEBUG_LINE_LAYER_ID =
  'virtual-candidate-debug-lines'
const VIRTUAL_CANDIDATE_DEBUG_HIT_LAYER_ID =
  'virtual-candidate-debug-hit-area'

const activePopupByMap = new WeakMap<Map, Popup>()

const virtualCandidateDebugLineLayer = {
  id: VIRTUAL_CANDIDATE_DEBUG_LINE_LAYER_ID,
  type: 'line',
  source: VIRTUAL_CANDIDATE_DEBUG_SOURCE_ID,
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': '#087f8c',
    'line-opacity': [
      'match',
      ['get', 'distanceCategory'],
      '0-50',
      0.72,
      '50-100',
      0.6,
      '100-150',
      0.48,
      0.36,
    ],
    'line-width': [
      'match',
      ['get', 'distanceCategory'],
      '0-50',
      2.4,
      '50-100',
      2,
      '100-150',
      1.6,
      1.2,
    ],
  },
} satisfies LayerSpecification

const virtualCandidateDebugHitLayer = {
  id: VIRTUAL_CANDIDATE_DEBUG_HIT_LAYER_ID,
  type: 'line',
  source: VIRTUAL_CANDIDATE_DEBUG_SOURCE_ID,
  paint: {
    'line-color': '#087f8c',
    'line-opacity': 0,
    'line-width': 12,
  },
} satisfies LayerSpecification

export function syncVirtualCandidateDebugLayer(
  map: Map,
  candidates: readonly VirtualConnectionCandidate[],
) {
  const source = map.getSource(VIRTUAL_CANDIDATE_DEBUG_SOURCE_ID) as
    | GeoJSONSource
    | undefined

  if (source) {
    source.setData(createVirtualCandidateDebugData(candidates))
    return
  }

  if (!map.isStyleLoaded()) {
    return
  }

  upsertVirtualCandidateDebugLayer(map, candidates)
}

export function restoreVirtualCandidateDebugLayer(
  map: Map,
  candidates: readonly VirtualConnectionCandidate[],
) {
  upsertVirtualCandidateDebugLayer(map, candidates)
}

export function inspectVirtualCandidateAtPoint(
  map: Map,
  point: PointLike,
) {
  if (!map.getLayer(VIRTUAL_CANDIDATE_DEBUG_HIT_LAYER_ID)) {
    return false
  }

  const feature = map.queryRenderedFeatures(point, {
    layers: [VIRTUAL_CANDIDATE_DEBUG_HIT_LAYER_ID],
  })[0]

  if (!feature) {
    return false
  }

  showCandidatePopup(map, feature)
  return true
}

function upsertVirtualCandidateDebugLayer(
  map: Map,
  candidates: readonly VirtualConnectionCandidate[],
) {
  const data = createVirtualCandidateDebugData(candidates)
  const source = map.getSource(VIRTUAL_CANDIDATE_DEBUG_SOURCE_ID) as
    | GeoJSONSource
    | undefined

  if (source) {
    source.setData(data)
  } else {
    map.addSource(VIRTUAL_CANDIDATE_DEBUG_SOURCE_ID, {
      type: 'geojson',
      data,
    })
  }

  if (!map.getLayer(VIRTUAL_CANDIDATE_DEBUG_LINE_LAYER_ID)) {
    map.addLayer(virtualCandidateDebugLineLayer)
  }

  if (!map.getLayer(VIRTUAL_CANDIDATE_DEBUG_HIT_LAYER_ID)) {
    map.addLayer(virtualCandidateDebugHitLayer)
  }
}

function showCandidatePopup(map: Map, feature: MapGeoJSONFeature) {
  const properties = feature.properties as VirtualCandidateDebugProperties
  const coordinates = getPopupCoordinates(feature)
  const content = document.createElement('div')
  const title = document.createElement('strong')
  const details = document.createElement('dl')

  title.textContent = `Kandidat: ${properties.candidateId}`
  content.append(title, details)
  appendDetail(details, 'Avstand', `${properties.distanceMeters.toFixed(1)} m`)
  appendDetail(
    details,
    'Komponenter',
    `${properties.componentA} → ${properties.componentB}`,
  )
  appendDetail(details, 'Edges', `${properties.edgeA} → ${properties.edgeB}`)

  activePopupByMap.get(map)?.remove()
  const popup = new Popup({ closeButton: true, closeOnClick: true })
    .setLngLat(coordinates)
    .setDOMContent(content)
    .addTo(map)
  activePopupByMap.set(map, popup)
}

function appendDetail(container: HTMLElement, label: string, value: string) {
  const term = document.createElement('dt')
  const description = document.createElement('dd')
  term.textContent = label
  description.textContent = value
  container.append(term, description)
}

function getPopupCoordinates(feature: GeoJSONFeature) {
  if (feature.geometry.type !== 'LineString') {
    throw new Error('Virtual candidate debug feature must be a LineString.')
  }

  const [from, to] = feature.geometry.coordinates
  return {
    lng: (from[0] + to[0]) / 2,
    lat: (from[1] + to[1]) / 2,
  }
}
