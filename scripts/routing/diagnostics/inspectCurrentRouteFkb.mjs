import { readFile } from 'node:fs/promises'

const WFS_ENDPOINT =
  'https://wms.geonorge.no/skwms1/wms.traktorveg_skogsbilveger'
const WFS_BBOX = '62.789,9.592,62.797,9.622,EPSG:4326'
const A = { longitude: 9.59762, latitude: 62.79126 }
const B = { longitude: 9.61702, latitude: 62.79442 }
const EARTH_RADIUS_METERS = 6_371_008.8
const REFERENCE_LATITUDE_RADIANS =
  ((A.latitude + B.latitude) / 2) * Math.PI / 180

const parameters = new URLSearchParams({
  service: 'WFS',
  version: '2.0.0',
  request: 'GetFeature',
  typeNames: 'ms:traktorveg_sti',
  srsName: 'EPSG:4326',
  bbox: WFS_BBOX,
  count: '10000',
  outputFormat: 'application/json; subtype=geojson',
})

const response = await fetch(`${WFS_ENDPOINT}?${parameters}`, {
  headers: { 'User-Agent': 'RuteApp-current-route-diagnostic/0.1' },
})

console.log(
  `WFS response: HTTP ${response.status}, ${response.headers.get('content-type') ?? 'unknown'}`,
)

if (!response.ok) {
  throw new Error(`FKB WFS request failed: ${response.status}`)
}

const source = await response.json()
const routingDataset = JSON.parse(
  await readFile(new URL('../../../public/data/routing/nerskogen.json', import.meta.url), 'utf8'),
)
const osmSegments = createOsmSegments(routingDataset)
const features = (source.features ?? [])
  .filter((feature) =>
    feature.geometry?.type === 'LineString' &&
    ['sti', 'traktorveg'].includes(feature.properties?.typeveg),
  )
  .map((feature, index) => {
    const coordinates = feature.geometry.coordinates
    const positions = coordinates.map(([longitude, latitude]) => ({
      longitude,
      latitude,
    }))
    const minDistanceToA = minimumDistanceToLine(A, positions)
    const minDistanceToB = minimumDistanceToLine(B, positions)
    const minDistanceToDirectLine = minimumDistanceBetweenLines(
      [A, B],
      positions,
    )

    return {
      index,
      id: feature.id ?? null,
      objtype: feature.properties?.objtype ?? null,
      typeveg: feature.properties?.typeveg ?? null,
      coordinateCount: coordinates.length,
      lengthMeters: lineLength(positions),
      start: positions[0],
      end: positions.at(-1),
      minDistanceToA,
      minDistanceToB,
      minDistanceToDirectLine,
      startOsm: nearestOsmSegment(positions[0], osmSegments),
      endOsm: nearestOsmSegment(positions.at(-1), osmSegments),
      geometry:
        minDistanceToDirectLine <= 40
          ? feature.geometry
          : undefined,
    }
  })
  .sort(
    (first, second) =>
      first.minDistanceToDirectLine - second.minDistanceToDirectLine ||
      first.minDistanceToA + first.minDistanceToB -
        (second.minDistanceToA + second.minDistanceToB),
  )

console.log(`Walkable FKB features in bbox: ${features.length}`)
const endpointComponents = findEndpointComponents(features)
const corridorComponent = endpointComponents.find((component) =>
  component.featureIndexes.includes(18),
)
console.log('CURRENT_ROUTE_FKB_COMPONENT_START')
console.log(JSON.stringify(corridorComponent, null, 2))
console.log('CURRENT_ROUTE_FKB_COMPONENT_END')
console.log('CURRENT_ROUTE_FKB_JSON_START')
console.log(
  JSON.stringify(
    features.filter(
      (feature) =>
        feature.minDistanceToDirectLine <= 120 ||
        feature.minDistanceToA <= 120 ||
        feature.minDistanceToB <= 120,
    ),
    null,
    2,
  ),
)
console.log('CURRENT_ROUTE_FKB_JSON_END')

function lineLength(positions) {
  let total = 0

  for (let index = 1; index < positions.length; index += 1) {
    total += distance(positions[index - 1], positions[index])
  }

  return total
}

function minimumDistanceToLine(point, line) {
  let minimum = Number.POSITIVE_INFINITY

  for (let index = 1; index < line.length; index += 1) {
    minimum = Math.min(
      minimum,
      pointToSegmentDistance(point, line[index - 1], line[index]),
    )
  }

  return minimum
}

function minimumDistanceBetweenLines(first, second) {
  let minimum = Number.POSITIVE_INFINITY

  for (const point of first) {
    minimum = Math.min(minimum, minimumDistanceToLine(point, second))
  }

  for (const point of second) {
    minimum = Math.min(minimum, minimumDistanceToLine(point, first))
  }

  return minimum
}

function pointToSegmentDistance(point, from, to) {
  const projectedPoint = project(point)
  const projectedFrom = project(from)
  const projectedTo = project(to)
  const directionX = projectedTo.x - projectedFrom.x
  const directionY = projectedTo.y - projectedFrom.y
  const lengthSquared = directionX ** 2 + directionY ** 2
  const position =
    lengthSquared === 0
      ? 0
      : clamp(
          ((projectedPoint.x - projectedFrom.x) * directionX +
            (projectedPoint.y - projectedFrom.y) * directionY) /
            lengthSquared,
          0,
          1,
        )
  const nearestX = projectedFrom.x + directionX * position
  const nearestY = projectedFrom.y + directionY * position

  return Math.hypot(
    projectedPoint.x - nearestX,
    projectedPoint.y - nearestY,
  )
}

function distance(first, second) {
  const firstProjected = project(first)
  const secondProjected = project(second)

  return Math.hypot(
    firstProjected.x - secondProjected.x,
    firstProjected.y - secondProjected.y,
  )
}

function project(position) {
  return {
    x:
      position.longitude *
      Math.PI /
      180 *
      EARTH_RADIUS_METERS *
      Math.cos(REFERENCE_LATITUDE_RADIANS),
    y:
      position.latitude *
      Math.PI /
      180 *
      EARTH_RADIUS_METERS,
  }
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}


function createOsmSegments(dataset) {
  const nodes = new Map(
    dataset.nodes.map(([id, longitude, latitude]) => [
      id,
      { longitude, latitude },
    ]),
  )
  const seen = new Set()
  const segments = []

  for (const [, fromNodeId, toNodeId, , edgeType] of dataset.edges) {
    const key = [fromNodeId, toNodeId].sort().join('|')

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    const from = nodes.get(fromNodeId)
    const to = nodes.get(toNodeId)

    if (from && to) {
      segments.push({ fromNodeId, toNodeId, edgeType, from, to })
    }
  }

  return segments
}

function nearestOsmSegment(point, segments) {
  let nearest

  for (const segment of segments) {
    const projectedPoint = project(point)
    const projectedFrom = project(segment.from)
    const projectedTo = project(segment.to)
    const directionX = projectedTo.x - projectedFrom.x
    const directionY = projectedTo.y - projectedFrom.y
    const lengthSquared = directionX ** 2 + directionY ** 2
    const position =
      lengthSquared === 0
        ? 0
        : clamp(
            ((projectedPoint.x - projectedFrom.x) * directionX +
              (projectedPoint.y - projectedFrom.y) * directionY) /
              lengthSquared,
            0,
            1,
          )
    const snappedPosition = {
      longitude:
        segment.from.longitude +
        (segment.to.longitude - segment.from.longitude) * position,
      latitude:
        segment.from.latitude +
        (segment.to.latitude - segment.from.latitude) * position,
    }
    const distanceMeters = distance(point, snappedPosition)

    if (!nearest || distanceMeters < nearest.distanceMeters) {
      nearest = {
        edgeType: segment.edgeType,
        fromNodeId: segment.fromNodeId,
        toNodeId: segment.toNodeId,
        position,
        distanceMeters,
        snappedPosition,
      }
    }
  }

  return nearest
}


function findEndpointComponents(features) {
  const endpointToFeatureIndexes = new Map()

  for (const feature of features) {
    for (const endpoint of [feature.start, feature.end]) {
      const key = endpointKey(endpoint)
      const indexes = endpointToFeatureIndexes.get(key) ?? []
      indexes.push(feature.index)
      endpointToFeatureIndexes.set(key, indexes)
    }
  }

  const featureByIndex = new Map(features.map((feature) => [feature.index, feature]))
  const seen = new Set()
  const components = []

  for (const feature of features) {
    if (seen.has(feature.index)) {
      continue
    }

    const pending = [feature.index]
    const indexes = []
    seen.add(feature.index)

    while (pending.length > 0) {
      const index = pending.pop()
      indexes.push(index)
      const current = featureByIndex.get(index)

      for (const endpoint of [current.start, current.end]) {
        for (const neighborIndex of endpointToFeatureIndexes.get(endpointKey(endpoint)) ?? []) {
          if (!seen.has(neighborIndex)) {
            seen.add(neighborIndex)
            pending.push(neighborIndex)
          }
        }
      }
    }

    const members = indexes.map((index) => featureByIndex.get(index))
    const endpointCandidates = members.flatMap((member) => [
      {
        featureIndex: member.index,
        side: 'start',
        coordinate: member.start,
        osm: member.startOsm,
      },
      {
        featureIndex: member.index,
        side: 'end',
        coordinate: member.end,
        osm: member.endOsm,
      },
    ]).sort((first, second) => first.osm.distanceMeters - second.osm.distanceMeters)

    components.push({
      featureIndexes: indexes.sort((a, b) => a - b),
      totalLengthMeters: members.reduce((sum, member) => sum + member.lengthMeters, 0),
      nearestOsmEndpoints: endpointCandidates.slice(0, 10),
    })
  }

  return components
}

function endpointKey(position) {
  return `${position.longitude.toFixed(9)},${position.latitude.toFixed(9)}`
}
