export type SameComponentShortcutDebugProperties = {
  candidateId: string
  shortcutId: string
  directDistanceMeters: number
  ordinaryNetworkDistanceMeters: number
  detourRatio: number
  componentId: string
  fromEdgeId: string
  toEdgeId: string
  fromEdgeType: string
  toEdgeType: string
}

export type SameComponentShortcutDebugFeature = {
  type: 'Feature'
  id: string
  properties: SameComponentShortcutDebugProperties
  geometry: {
    type: 'LineString'
    coordinates: [[number, number], [number, number]]
  }
}

export type SameComponentShortcutDebugData = {
  type: 'FeatureCollection'
  features: SameComponentShortcutDebugFeature[]
}

export type SameComponentShortcutDisplayLimit = number | 'all'

export type SameComponentShortcutFilters = {
  limit: SameComponentShortcutDisplayLimit
  minimumDetourRatio: number
  maximumDirectDistanceMeters: number
}

export const sameComponentShortcutDataUrl =
  '/__ruteapp_dev/same-component-shortcuts.geojson'

export const emptySameComponentShortcutDebugData: SameComponentShortcutDebugData = {
  type: 'FeatureCollection',
  features: [],
}

export async function loadSameComponentShortcutDebugData(
  signal?: AbortSignal,
) {
  const response = await fetch(sameComponentShortcutDataUrl, { signal })

  if (!response.ok) {
    throw new Error(`Shortcut debug data request failed: ${response.status}`)
  }

  return parseSameComponentShortcutDebugData(await response.json())
}

export function selectSameComponentShortcutDebugData(
  data: SameComponentShortcutDebugData,
  filters: SameComponentShortcutFilters,
): SameComponentShortcutDebugData {
  const sortedFeatures = data.features
    .filter(
      ({ properties }) =>
        properties.detourRatio >= filters.minimumDetourRatio &&
        properties.directDistanceMeters <=
          filters.maximumDirectDistanceMeters,
    )
    .sort(compareFeatures)
  const features =
    filters.limit === 'all'
      ? sortedFeatures
      : sortedFeatures.slice(0, filters.limit)

  return { type: 'FeatureCollection', features }
}

export function parseSameComponentShortcutDebugData(
  value: unknown,
): SameComponentShortcutDebugData {
  if (
    !isRecord(value) ||
    value.type !== 'FeatureCollection' ||
    !Array.isArray(value.features)
  ) {
    throw new Error('Shortcut debug data has an invalid FeatureCollection.')
  }

  return {
    type: 'FeatureCollection',
    features: value.features.map(parseFeature),
  }
}

export function createSameComponentShortcutDisplayId(candidateId: string) {
  return `SC-${fnv1a32(candidateId).toString(16).padStart(8, '0').toUpperCase()}`
}

export function findSameComponentShortcutById(
  data: SameComponentShortcutDebugData,
  candidateId: string,
) {
  const normalizedId = candidateId.trim().toLocaleUpperCase()

  if (!normalizedId) {
    return undefined
  }

  return data.features.find(
    ({ properties }) =>
      properties.shortcutId.toLocaleUpperCase() === normalizedId ||
      properties.candidateId.toLocaleUpperCase() === normalizedId,
  )
}

export function includeSelectedSameComponentShortcut(
  data: SameComponentShortcutDebugData,
  selectedFeature: SameComponentShortcutDebugFeature | undefined,
): SameComponentShortcutDebugData {
  if (
    !selectedFeature ||
    data.features.some(
      ({ properties }) =>
        properties.candidateId === selectedFeature.properties.candidateId,
    )
  ) {
    return data
  }

  return {
    type: 'FeatureCollection',
    features: [...data.features, selectedFeature],
  }
}

function parseFeature(value: unknown): SameComponentShortcutDebugFeature {
  if (
    !isRecord(value) ||
    value.type !== 'Feature' ||
    !isRecord(value.properties) ||
    !isLineStringGeometry(value.geometry)
  ) {
    throw new Error('Shortcut debug data contains an invalid feature.')
  }

  const properties = value.properties
  const candidateId = requireString(properties.candidateId, 'candidateId')

  return {
    type: 'Feature',
    id: candidateId,
    properties: {
      candidateId,
      shortcutId: createSameComponentShortcutDisplayId(candidateId),
      directDistanceMeters: requireNumber(
        properties.directDistanceMeters,
        'directDistanceMeters',
      ),
      ordinaryNetworkDistanceMeters: requireNumber(
        properties.ordinaryNetworkDistanceMeters,
        'ordinaryNetworkDistanceMeters',
      ),
      detourRatio: requireNumber(properties.detourRatio, 'detourRatio'),
      componentId: requireString(properties.componentId, 'componentId'),
      fromEdgeId: requireString(properties.fromEdgeId, 'fromEdgeId'),
      toEdgeId: requireString(properties.toEdgeId, 'toEdgeId'),
      fromEdgeType: requireString(properties.fromEdgeType, 'fromEdgeType'),
      toEdgeType: requireString(properties.toEdgeType, 'toEdgeType'),
    },
    geometry: {
      type: 'LineString',
      coordinates: value.geometry.coordinates,
    },
  }
}

function compareFeatures(
  first: SameComponentShortcutDebugFeature,
  second: SameComponentShortcutDebugFeature,
) {
  return (
    second.properties.detourRatio - first.properties.detourRatio ||
    first.properties.directDistanceMeters -
      second.properties.directDistanceMeters ||
    second.properties.ordinaryNetworkDistanceMeters -
      first.properties.ordinaryNetworkDistanceMeters ||
    first.properties.candidateId.localeCompare(second.properties.candidateId)
  )
}

function isLineStringGeometry(
  value: unknown,
): value is SameComponentShortcutDebugFeature['geometry'] {
  return (
    isRecord(value) &&
    value.type === 'LineString' &&
    Array.isArray(value.coordinates) &&
    value.coordinates.length === 2 &&
    value.coordinates.every(isCoordinate)
  )
}

function isCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((coordinate) =>
      typeof coordinate === 'number' && Number.isFinite(coordinate),
    )
  )
}

function requireString(value: unknown, fieldName: string) {
  if (typeof value !== 'string') {
    throw new Error(`Shortcut debug property must be a string: ${fieldName}`)
  }

  return value
}

function requireNumber(value: unknown, fieldName: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Shortcut debug property must be a number: ${fieldName}`)
  }

  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function fnv1a32(value: string) {
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}
