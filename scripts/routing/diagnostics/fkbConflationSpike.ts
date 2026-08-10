import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadRoutingDataset,
  parseRoutingDataset,
} from '../../../src/routing/routingDataset.ts'
import { routeWaypoints } from '../../../src/routing/routeWaypoints.ts'
import type { RoutingNode } from '../../../src/routing/routingTypes.ts'
import { calculateGeographicDistanceMeters } from '../../../src/utils/geographicDistance.ts'
import {
  buildFkbConflationSpikeGraph,
  countRouteEdgesBySource,
  getSpikeEdgeProvenance,
  type FkbConflationSpikeResult,
  type FkbSpikeSourceObject,
} from './fkbConflationSpikeGraph.ts'

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..',
)
const datasetPath = resolve(
  projectRoot,
  'public/data/routing/nerskogen.json',
)
const fixturePath = resolve(
  projectRoot,
  'scripts/routing/diagnostics/fixtures/fkbNerskogenGap.fixture.json',
)
const diagnosticOutputPath = resolve(
  projectRoot,
  'data/routing/diagnostics/fkb-conflation-spike.geojson',
)

const WFS_ENDPOINT =
  'https://wms.geonorge.no/skwms1/wms.traktorveg_skogsbilveger'
const WFS_BBOX = '62.765,9.548,62.771,9.560,EPSG:4326'
const SOURCE_IDS = new Set([
  'traktorveg_sti.1524706',
  'traktorveg_sti.1524755',
])
const CONFLATION_TOLERANCE_METERS = 1
const USER_SNAP_DISTANCE_METERS = 100
const ROUTE_POINTS = [
  { latitude: 62.76968, longitude: 9.55381 },
  { latitude: 62.76532, longitude: 9.55131 },
] as const

const useLiveWfs = process.argv.includes('--live')
const dataset = parseRoutingDataset(
  JSON.parse(await readFile(datasetPath, 'utf8')),
)
const osmGraph = loadRoutingDataset(dataset)
const originalNodeCount = osmGraph.nodes.size
const originalEdgeCount = osmGraph.edges.length
const sourceObjects = useLiveWfs
  ? await fetchFkbSourceObjects()
  : (JSON.parse(
      await readFile(fixturePath, 'utf8'),
    ) as FkbSpikeSourceObject[])
const spike = buildFkbConflationSpikeGraph(
  osmGraph,
  sourceObjects,
  CONFLATION_TOLERANCE_METERS,
)
const osmResult = routeWaypoints(
  ROUTE_POINTS,
  osmGraph,
  dataset.metadata.bounds,
  USER_SNAP_DISTANCE_METERS,
)
const hybridResult = routeWaypoints(
  ROUTE_POINTS,
  spike.graph,
  dataset.metadata.bounds,
  USER_SNAP_DISTANCE_METERS,
)

if (osmResult.status !== 'routed' || hybridResult.status !== 'routed') {
  throw new Error(
    `Expected routed results, got OSM=${osmResult.status}, hybrid=${hybridResult.status}`,
  )
}

if (
  osmGraph.nodes.size !== originalNodeCount ||
  osmGraph.edges.length !== originalEdgeCount
) {
  throw new Error('The diagnostic spike mutated the original OSM graph')
}

const sourceCounts = countRouteEdgesBySource(
  hybridResult.route.edges,
  spike.edgeProvenance,
)
const usedFkbSourceIds = [
  ...new Set(
    hybridResult.route.edges
      .map((edge) =>
        getSpikeEdgeProvenance(edge.id, spike.edgeProvenance),
      )
      .filter((provenance) => provenance?.kind === 'source')
      .map((provenance) => provenance!.sourceId),
  ),
]

await mkdir(dirname(diagnosticOutputPath), { recursive: true })
await writeFile(
  diagnosticOutputPath,
  JSON.stringify(createDiagnosticGeoJson(hybridResult, spike), null, 2),
  'utf8',
)

console.log(`Datakilde: ${useLiveWfs ? 'live FKB-WFS' : 'deterministisk fixture'}`)
console.log(`Conflation-toleranse: ${CONFLATION_TOLERANCE_METERS.toFixed(1)} m`)
for (const point of spike.conflationPoints) {
  console.log(
    `Kobling ${point.sourceId} -> OSM-node ${point.osmNodeId}: ` +
      `${point.distanceMeters.toFixed(6)} m`,
  )
}
console.log(`Ren OSM-rute: ${osmResult.route.totalDistanceMeters.toFixed(6)} m`)
console.log(
  `Hybridrute: ${hybridResult.route.totalDistanceMeters.toFixed(6)} m, ` +
    `${hybridResult.route.edges.length} edges`,
)
console.log(`Edgefordeling: ${JSON.stringify(sourceCounts)}`)
console.log(`FKB-objekter i ruten: ${usedFkbSourceIds.join(', ')}`)
console.log(
  `Eksakte dublettsegmenter hoppet over: ${spike.skippedExactDuplicateSegments}`,
)
console.log(`Diagnostisk GeoJSON: ${diagnosticOutputPath}`)

async function fetchFkbSourceObjects() {
  const baseParameters = {
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'ms:traktorveg_sti',
    srsName: 'EPSG:4326',
    bbox: WFS_BBOX,
  }
  const gmlParameters = new URLSearchParams(baseParameters)
  const geoJsonParameters = new URLSearchParams({
    ...baseParameters,
    outputFormat: 'application/json; subtype=geojson',
  })
  const [gmlResponse, geoJsonResponse] = await Promise.all([
    fetch(`${WFS_ENDPOINT}?${gmlParameters}`, {
      headers: { 'User-Agent': 'RuteApp-FKB-conflation-spike/0.1' },
    }),
    fetch(`${WFS_ENDPOINT}?${geoJsonParameters}`, {
      headers: { 'User-Agent': 'RuteApp-FKB-conflation-spike/0.1' },
    }),
  ])

  for (const [format, response] of [
    ['GML', gmlResponse],
    ['GeoJSON', geoJsonResponse],
  ] as const) {
    console.log(
      `WFS ${format}: HTTP ${response.status}, ${response.headers.get('content-type') ?? 'ukjent content-type'}`,
    )

    if (!response.ok) {
      throw new Error(`FKB WFS ${format} request failed: ${response.status}`)
    }
  }

  const gmlObjects = parseSelectedFkbGml(await gmlResponse.text())
  const objects = attachHighPrecisionGeoJsonGeometry(
    gmlObjects,
    await geoJsonResponse.text(),
  )

  if (objects.length !== SOURCE_IDS.size) {
    throw new Error(
      `Expected ${SOURCE_IDS.size} selected FKB objects, received ${objects.length}`,
    )
  }

  return objects
}

function attachHighPrecisionGeoJsonGeometry(
  gmlObjects: readonly FkbSpikeSourceObject[],
  geoJsonText: string,
) {
  const geoJson = JSON.parse(geoJsonText) as {
    features?: Array<{
      properties?: Record<string, unknown>
      geometry?: {
        type?: string
        coordinates?: Array<[number, number]>
      }
    }>
  }
  const availableFeatures = [...(geoJson.features ?? [])]

  return gmlObjects.map((gmlObject) => {
    const gmlCoordinates = gmlObject.geometry.coordinates
    const matchingFeatureIndex = availableFeatures.findIndex((feature) => {
      const coordinates = feature.geometry?.coordinates

      if (
        feature.geometry?.type !== 'LineString' ||
        !coordinates ||
        coordinates.length !== gmlCoordinates.length ||
        feature.properties?.objtype !== gmlObject.objectType ||
        feature.properties?.typeveg !== gmlObject.typeVeg
      ) {
        return false
      }

      return (
        coordinateDistance(coordinates[0], gmlCoordinates[0]) < 0.25 &&
        coordinateDistance(coordinates.at(-1)!, gmlCoordinates.at(-1)!) < 0.25
      )
    })

    if (matchingFeatureIndex < 0) {
      throw new Error(
        `Could not match high-precision GeoJSON geometry for ${gmlObject.sourceId}`,
      )
    }

    const [matchingFeature] = availableFeatures.splice(
      matchingFeatureIndex,
      1,
    )

    return {
      ...gmlObject,
      geometry: {
        type: 'LineString' as const,
        coordinates: matchingFeature.geometry!.coordinates!,
      },
    }
  })
}

function coordinateDistance(
  first: readonly [number, number],
  second: readonly [number, number],
) {
  return calculateGeographicDistanceMeters(
    { longitude: first[0], latitude: first[1] },
    { longitude: second[0], latitude: second[1] },
  )
}

function parseSelectedFkbGml(gml: string): FkbSpikeSourceObject[] {
  const objects: FkbSpikeSourceObject[] = []
  const featurePattern =
    /<ms:traktorveg_sti\s+gml:id="([^"]+)">([\s\S]*?)<\/ms:traktorveg_sti>/g

  for (const match of gml.matchAll(featurePattern)) {
    const sourceId = match[1]

    if (!SOURCE_IDS.has(sourceId)) {
      continue
    }

    const featureXml = match[2]
    const positionList = featureXml.match(
      /<gml:posList[^>]*>([\s\S]*?)<\/gml:posList>/,
    )?.[1]

    if (!positionList) {
      throw new Error(`FKB object ${sourceId} is missing its LineString geometry`)
    }

    const values = positionList.trim().split(/\s+/).map(Number)
    const coordinates: Array<readonly [number, number]> = []

    for (let index = 0; index < values.length; index += 2) {
      coordinates.push([values[index + 1], values[index]])
    }

    objects.push({
      source: 'fkb',
      sourceId,
      sourceIdIsStable: false,
      objectType: readXmlElement(featureXml, 'objtype'),
      typeVeg: readXmlElement(featureXml, 'typeveg'),
      geometry: { type: 'LineString', coordinates },
    })
  }

  return objects.sort((first, second) =>
    first.sourceId.localeCompare(second.sourceId),
  )
}

function readXmlElement(xml: string, localName: string) {
  const value = xml.match(
    new RegExp(`<ms:${localName}>([\\s\\S]*?)<\\/ms:${localName}>`),
  )?.[1]

  if (value === undefined) {
    throw new Error(`FKB feature is missing ${localName}`)
  }

  return value.trim()
}

function createDiagnosticGeoJson(
  routeResult: Extract<
    ReturnType<typeof routeWaypoints>,
    { status: 'routed' }
  >,
  spikeResult: FkbConflationSpikeResult,
) {
  const routeFeatures = routeResult.route.edges.map((edge, index) => {
    const fromNode = routeResult.routeNodes[index]
    const toNode = routeResult.routeNodes[index + 1]
    const provenance = getSpikeEdgeProvenance(
      edge.id,
      spikeResult.edgeProvenance,
    )

    return lineFeature(
      [toCoordinate(fromNode), toCoordinate(toNode)],
      {
        layer: 'selected-route',
        edgeId: edge.id,
        edgeType: edge.edgeType,
        source: provenance?.source ?? 'osm',
        sourceId: provenance?.sourceId ?? null,
        kind: provenance?.kind ?? 'source',
      },
    )
  })
  const importedFkbFeatures = spikeResult.importedObjects.map(
    (sourceObject) =>
      lineFeature(sourceObject.importedGeometry.coordinates, {
        layer: 'imported-fkb-geometry',
        source: sourceObject.source,
        sourceId: sourceObject.sourceId,
        sourceIdIsStable: sourceObject.sourceIdIsStable,
        objectType: sourceObject.objectType,
        typeVeg: sourceObject.typeVeg,
      }),
  )
  const conflationFeatures = spikeResult.conflationPoints.flatMap((point) => [
    lineFeature(
      [toCoordinate(point.osmPosition), toCoordinate(point.fkbPosition)],
      {
        layer: 'conflation-link',
        sourceId: point.sourceId,
        osmNodeId: point.osmNodeId,
        distanceMeters: point.distanceMeters,
      },
    ),
    {
      type: 'Feature',
      properties: {
        layer: 'conflation-point',
        sourceId: point.sourceId,
        osmNodeId: point.osmNodeId,
        distanceMeters: point.distanceMeters,
      },
      geometry: {
        type: 'Point',
        coordinates: toCoordinate(point.fkbPosition),
      },
    },
  ])

  return {
    type: 'FeatureCollection',
    features: [
      ...importedFkbFeatures,
      ...routeFeatures,
      ...conflationFeatures,
    ],
  }
}

function lineFeature(
  coordinates: readonly (readonly [number, number])[],
  properties: Record<string, string | number | boolean | null>,
) {
  return {
    type: 'Feature',
    properties,
    geometry: { type: 'LineString', coordinates },
  }
}

function toCoordinate(node: RoutingNode): readonly [number, number] {
  return [node.longitude, node.latitude]
}
