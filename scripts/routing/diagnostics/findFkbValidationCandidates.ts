import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadRoutingDataset,
  parseRoutingDataset,
} from '../../../src/routing/routingDataset.ts'
import { routeWaypoints } from '../../../src/routing/routeWaypoints.ts'
import type {
  RoutingEdge,
  RoutingGraph,
  RoutingNode,
} from '../../../src/routing/routingTypes.ts'
import { calculateGeographicDistanceMeters } from '../../../src/utils/geographicDistance.ts'
import type { FkbCoordinate } from './fkbConflationSpikeGraph.ts'

type FkbGeoJsonFeature = {
  properties: {
    objtype: string
    typeveg: string
  }
  geometry: {
    type: 'LineString'
    coordinates: FkbCoordinate[]
  }
}

type IndexedOsmSegment = {
  edge: RoutingEdge
  fromNode: RoutingNode
  toNode: RoutingNode
}

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..',
)
const datasetPath = resolve(
  projectRoot,
  'public/data/routing/nerskogen.json',
)
const outputPath = resolve(
  projectRoot,
  'data/routing/diagnostics/fkb-validation-candidates.json',
)
const endpointToleranceMeters = 1
const minimumFkbLengthMeters = 50
const minimumMidpointDeviationMeters = 5
const userSnapDistanceMeters = 100
const wfsEndpoint =
  'https://wms.geonorge.no/skwms1/wms.traktorveg_skogsbilveger'
const wfsBbox = '62.745,9.53,62.815,9.67,EPSG:4326'

const dataset = parseRoutingDataset(
  JSON.parse(await readFile(datasetPath, 'utf8')),
)
const osmGraph = loadRoutingDataset(dataset)
const source = await fetchFkbFeatures()
const spatialIndex = createOsmSegmentIndex(osmGraph)
const candidates = []

for (const [featureIndex, feature] of source.features.entries()) {
  if (
    feature.geometry.type !== 'LineString' ||
    !['sti', 'traktorveg'].includes(feature.properties.typeveg)
  ) {
    continue
  }

  const coordinates = feature.geometry.coordinates
  const startMatch = spatialIndex.findNearest(coordinates[0])
  const endMatch = spatialIndex.findNearest(coordinates.at(-1)!)
  const fkbLengthMeters = calculateLineLength(coordinates)

  if (
    !startMatch ||
    !endMatch ||
    startMatch.distanceMeters > endpointToleranceMeters ||
    endMatch.distanceMeters > endpointToleranceMeters ||
    fkbLengthMeters < minimumFkbLengthMeters
  ) {
    continue
  }

  const midpoint = coordinates[Math.floor(coordinates.length / 2)]
  const midpointMatch = spatialIndex.findNearest(midpoint)

  if (
    !midpointMatch ||
    midpointMatch.distanceMeters < minimumMidpointDeviationMeters
  ) {
    continue
  }

  const osmResult = routeWaypoints(
    [startMatch.snappedPosition, endMatch.snappedPosition],
    osmGraph,
    dataset.metadata.bounds,
    userSnapDistanceMeters,
  )
  const estimatedHybridLengthMeters =
    fkbLengthMeters + startMatch.distanceMeters + endMatch.distanceMeters
  const osmLengthMeters =
    osmResult.status === 'routed'
      ? osmResult.route.totalDistanceMeters
      : null
  const improvementMeters =
    osmLengthMeters === null
      ? null
      : osmLengthMeters - estimatedHybridLengthMeters

  candidates.push({
    featureIndex,
    typeVeg: feature.properties.typeveg,
    coordinateCount: coordinates.length,
    start: {
      coordinate: coordinates[0],
      distanceMeters: startMatch.distanceMeters,
      osmEdgeId: startMatch.edge.id,
      osmEdgeType: startMatch.edge.edgeType,
      osmFromNodeId: startMatch.edge.fromNodeId,
      osmToNodeId: startMatch.edge.toNodeId,
    },
    end: {
      coordinate: coordinates.at(-1),
      distanceMeters: endMatch.distanceMeters,
      osmEdgeId: endMatch.edge.id,
      osmEdgeType: endMatch.edge.edgeType,
      osmFromNodeId: endMatch.edge.fromNodeId,
      osmToNodeId: endMatch.edge.toNodeId,
    },
    midpoint,
    midpointDeviationMeters: midpointMatch.distanceMeters,
    fkbLengthMeters,
    osmStatus: osmResult.status,
    osmLengthMeters,
    estimatedHybridLengthMeters,
    improvementMeters,
    improvementPercent:
      improvementMeters === null || osmLengthMeters === 0
        ? null
        : (improvementMeters / osmLengthMeters) * 100,
  })
}

candidates.sort((first, second) => {
  if (first.osmLengthMeters === null && second.osmLengthMeters !== null) {
    return -1
  }

  if (first.osmLengthMeters !== null && second.osmLengthMeters === null) {
    return 1
  }

  return (
    (second.improvementMeters ?? 0) - (first.improvementMeters ?? 0) ||
    second.midpointDeviationMeters - first.midpointDeviationMeters
  )
})

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, JSON.stringify(candidates, null, 2), 'utf8')

console.log(
  `Fant ${candidates.length} enkeltobjekt-kandidater med begge ender innenfor ` +
    `${endpointToleranceMeters} m og midtavvik minst ${minimumMidpointDeviationMeters} m.`,
)
console.table(
  candidates.slice(0, 20).map((candidate) => ({
    index: candidate.featureIndex,
    type: candidate.typeVeg,
    center: candidate.midpoint.map((value) => value.toFixed(5)).join(', '),
    fkbMeters: candidate.fkbLengthMeters.toFixed(1),
    osmMeters: candidate.osmLengthMeters?.toFixed(1) ?? candidate.osmStatus,
    improvementMeters:
      candidate.improvementMeters?.toFixed(1) ?? candidate.osmStatus,
    startGap: candidate.start.distanceMeters.toFixed(3),
    endGap: candidate.end.distanceMeters.toFixed(3),
  })),
)
console.log(`Detaljer: ${outputPath}`)

async function fetchFkbFeatures() {
  const parameters = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'ms:traktorveg_sti',
    srsName: 'EPSG:4326',
    bbox: wfsBbox,
    count: '10000',
    outputFormat: 'application/json; subtype=geojson',
  })
  const response = await fetch(`${wfsEndpoint}?${parameters}`, {
    headers: { 'User-Agent': 'RuteApp-FKB-validation-spike/0.1' },
  })

  console.log(
    `FKB WFS GeoJSON: HTTP ${response.status}, ` +
      `${response.headers.get('content-type') ?? 'ukjent content-type'}`,
  )

  if (!response.ok) {
    throw new Error(`FKB WFS request failed: ${response.status}`)
  }

  return (await response.json()) as { features: FkbGeoJsonFeature[] }
}

function calculateLineLength(coordinates: readonly FkbCoordinate[]) {
  let lengthMeters = 0

  for (let index = 1; index < coordinates.length; index += 1) {
    lengthMeters += calculateGeographicDistanceMeters(
      toPosition(coordinates[index - 1]),
      toPosition(coordinates[index]),
    )
  }

  return lengthMeters
}

function createOsmSegmentIndex(graph: RoutingGraph) {
  const cellSizeDegrees = 0.002
  const segments: IndexedOsmSegment[] = []
  const cells = new Map<string, number[]>()
  const physicalEdgeKeys = new Set<string>()

  for (const edge of graph.edges) {
    const physicalEdgeKey = [edge.fromNodeId, edge.toNodeId].sort().join('|')

    if (physicalEdgeKeys.has(physicalEdgeKey)) {
      continue
    }

    physicalEdgeKeys.add(physicalEdgeKey)
    const fromNode = graph.nodes.get(edge.fromNodeId)
    const toNode = graph.nodes.get(edge.toNodeId)

    if (!fromNode || !toNode) {
      continue
    }

    const segmentIndex = segments.length
    segments.push({ edge, fromNode, toNode })
    const minimumLongitude = Math.min(fromNode.longitude, toNode.longitude)
    const maximumLongitude = Math.max(fromNode.longitude, toNode.longitude)
    const minimumLatitude = Math.min(fromNode.latitude, toNode.latitude)
    const maximumLatitude = Math.max(fromNode.latitude, toNode.latitude)

    for (
      let longitudeCell = Math.floor(minimumLongitude / cellSizeDegrees);
      longitudeCell <= Math.floor(maximumLongitude / cellSizeDegrees);
      longitudeCell += 1
    ) {
      for (
        let latitudeCell = Math.floor(minimumLatitude / cellSizeDegrees);
        latitudeCell <= Math.floor(maximumLatitude / cellSizeDegrees);
        latitudeCell += 1
      ) {
        const key = `${longitudeCell},${latitudeCell}`
        const indexes = cells.get(key) ?? []
        indexes.push(segmentIndex)
        cells.set(key, indexes)
      }
    }
  }

  return {
    findNearest(coordinate: FkbCoordinate) {
      const longitudeCell = Math.floor(coordinate[0] / cellSizeDegrees)
      const latitudeCell = Math.floor(coordinate[1] / cellSizeDegrees)
      const candidateIndexes = new Set<number>()

      for (let longitudeOffset = -1; longitudeOffset <= 1; longitudeOffset += 1) {
        for (let latitudeOffset = -1; latitudeOffset <= 1; latitudeOffset += 1) {
          for (const segmentIndex of
            cells.get(
              `${longitudeCell + longitudeOffset},${latitudeCell + latitudeOffset}`,
            ) ?? []) {
            candidateIndexes.add(segmentIndex)
          }
        }
      }

      let nearest:
        | {
            edge: RoutingEdge
            snappedPosition: { longitude: number; latitude: number }
            distanceMeters: number
          }
        | undefined

      for (const segmentIndex of candidateIndexes) {
        const segment = segments[segmentIndex]
        const snappedPosition = projectOntoSegment(
          coordinate,
          segment.fromNode,
          segment.toNode,
        )
        const distanceMeters = calculateGeographicDistanceMeters(
          toPosition(coordinate),
          snappedPosition,
        )

        if (!nearest || distanceMeters < nearest.distanceMeters) {
          nearest = { edge: segment.edge, snappedPosition, distanceMeters }
        }
      }

      return nearest
    },
  }
}

function projectOntoSegment(
  coordinate: FkbCoordinate,
  fromNode: RoutingNode,
  toNode: RoutingNode,
) {
  const latitudeRadians = degreesToRadians(coordinate[1])
  const longitudeScale = Math.cos(latitudeRadians)
  const fromX = (fromNode.longitude - coordinate[0]) * longitudeScale
  const fromY = fromNode.latitude - coordinate[1]
  const toX = (toNode.longitude - coordinate[0]) * longitudeScale
  const toY = toNode.latitude - coordinate[1]
  const segmentX = toX - fromX
  const segmentY = toY - fromY
  const squaredLength = segmentX ** 2 + segmentY ** 2
  const position =
    squaredLength === 0
      ? 0
      : clamp(
          -(fromX * segmentX + fromY * segmentY) / squaredLength,
          0,
          1,
        )

  return {
    longitude:
      fromNode.longitude +
      (toNode.longitude - fromNode.longitude) * position,
    latitude:
      fromNode.latitude +
      (toNode.latitude - fromNode.latitude) * position,
  }
}

function toPosition(coordinate: FkbCoordinate) {
  return { longitude: coordinate[0], latitude: coordinate[1] }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180
}
