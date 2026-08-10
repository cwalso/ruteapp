import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findNearestRoutingEdgePoint } from '../../../src/routing/nearestRoutingEdgePoint.ts'
import {
  loadRoutingDataset,
  parseRoutingDataset,
} from '../../../src/routing/routingDataset.ts'
import { routeWaypoints } from '../../../src/routing/routeWaypoints.ts'
import type { RoutingNode } from '../../../src/routing/routingTypes.ts'
import { calculateGeographicDistanceMeters } from '../../../src/utils/geographicDistance.ts'
import type { FkbSpikeSourceObject } from './fkbConflationSpikeGraph.ts'
import {
  buildFkbValidationGraph,
  countValidationRouteEdgesBySource,
} from './fkbValidationGraph.ts'

type FkbValidationFixtureCase = {
  featureIndex: number
  id: string
  caseId: string
  name: string
  expectation: 'positive' | 'overlap-negative'
  sourceObject: FkbSpikeSourceObject
}

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
  'scripts/routing/diagnostics/fixtures/fkbNerskogenValidation.fixture.json',
)
const diagnosticDirectory = resolve(projectRoot, 'data/routing/diagnostics')
const resultsPath = resolve(
  diagnosticDirectory,
  'fkb-validation-results.json',
)
const geoJsonPath = resolve(
  diagnosticDirectory,
  'fkb-validation-routes.geojson',
)

const CONFLATION_TOLERANCE_METERS = 1
const USER_SNAP_DISTANCE_METERS = 100
const OVERLAP_SEARCH_DISTANCE_METERS = 250

const dataset = parseRoutingDataset(
  JSON.parse(await readFile(datasetPath, 'utf8')),
)
const osmGraph = loadRoutingDataset(dataset)
const fixtureCases = JSON.parse(
  await readFile(fixturePath, 'utf8'),
) as FkbValidationFixtureCase[]
const originalNodeCount = osmGraph.nodes.size
const originalEdgeCount = osmGraph.edges.length
const results = []
const geoJsonFeatures = []

for (const fixtureCase of fixtureCases) {
  const spike = buildFkbValidationGraph(
    osmGraph,
    fixtureCase.sourceObject,
    CONFLATION_TOLERANCE_METERS,
  )
  const routePoints = spike.conflationPoints.map(({ osmPosition }) => ({
    longitude: osmPosition.longitude,
    latitude: osmPosition.latitude,
  }))
  const pureOsmResult = routeWaypoints(
    routePoints,
    osmGraph,
    dataset.metadata.bounds,
    USER_SNAP_DISTANCE_METERS,
  )
  const hybridResult = routeWaypoints(
    routePoints,
    spike.graph,
    dataset.metadata.bounds,
    USER_SNAP_DISTANCE_METERS,
  )

  if (pureOsmResult.status !== 'routed' || hybridResult.status !== 'routed') {
    throw new Error(
      `${fixtureCase.caseId}: expected routed results, got OSM=${pureOsmResult.status}, hybrid=${hybridResult.status}`,
    )
  }

  const sourceCoordinates = fixtureCase.sourceObject.geometry.coordinates
  const overlapDistances = sourceCoordinates.map((coordinate) =>
    findNearestRoutingEdgePoint(
      osmGraph,
      { longitude: coordinate[0], latitude: coordinate[1] },
      OVERLAP_SEARCH_DISTANCE_METERS,
    )?.distanceMeters ?? null,
  )
  const knownOverlapDistances = overlapDistances.filter(
    (distance): distance is number => distance !== null,
  )
  const sortedOverlapDistances = [...knownOverlapDistances].sort(
    (first, second) => first - second,
  )
  const sourceCounts = countValidationRouteEdgesBySource(
    hybridResult.route.edges,
    spike.edgeProvenance,
  )
  const pureOsmMeters = pureOsmResult.route.totalDistanceMeters
  const hybridMeters = hybridResult.route.totalDistanceMeters
  const result = {
    caseId: fixtureCase.caseId,
    name: fixtureCase.name,
    expectation: fixtureCase.expectation,
    fkb: {
      featureIndex: fixtureCase.featureIndex,
      sourceId: fixtureCase.sourceObject.sourceId,
      sourceIdIsStable: fixtureCase.sourceObject.sourceIdIsStable,
      objectType: fixtureCase.sourceObject.objectType,
      typeVeg: fixtureCase.sourceObject.typeVeg,
      edgeType: fixtureCase.sourceObject.typeVeg === 'sti' ? 'path' : 'track',
      coordinateCount: sourceCoordinates.length,
      lengthMeters: lineLength(sourceCoordinates),
    },
    routePoints,
    conflationToleranceMeters: CONFLATION_TOLERANCE_METERS,
    conflationPoints: spike.conflationPoints.map((point) => ({
      endpoint: point.endpoint,
      distanceMeters: point.distanceMeters,
      osmEdgeId: point.osmEdgeId,
      osmEdgeType: point.osmEdgeType,
      osmFromNodeId: point.osmFromNodeId,
      osmToNodeId: point.osmToNodeId,
      osmPosition: toCoordinate(point.osmPosition),
      fkbPosition: toCoordinate(point.fkbPosition),
    })),
    pureOsm: {
      distanceMeters: pureOsmMeters,
      edgeCount: pureOsmResult.route.edges.length,
      edgeTypeCounts: pureOsmResult.diagnostics.edgeTypeCounts,
      snappedPoints: pureOsmResult.snappedPoints,
    },
    hybrid: {
      distanceMeters: hybridMeters,
      edgeCount: hybridResult.route.edges.length,
      edgeSourceCounts: sourceCounts,
      snappedPoints: hybridResult.snappedPoints,
    },
    improvement: {
      distanceMeters: pureOsmMeters - hybridMeters,
      percent: ((pureOsmMeters - hybridMeters) / pureOsmMeters) * 100,
    },
    overlap: {
      searchedDistanceMeters: OVERLAP_SEARCH_DISTANCE_METERS,
      verticesChecked: sourceCoordinates.length,
      verticesWithinOneMeter: overlapDistances.filter(
        (distance) => distance !== null && distance <= 1,
      ).length,
      verticesWithinFiveMeters: overlapDistances.filter(
        (distance) => distance !== null && distance <= 5,
      ).length,
      meanNearestOsmDistanceMeters:
        knownOverlapDistances.reduce((sum, distance) => sum + distance, 0) /
        knownOverlapDistances.length,
      medianNearestOsmDistanceMeters: percentile(sortedOverlapDistances, 0.5),
      percentile95NearestOsmDistanceMeters: percentile(
        sortedOverlapDistances,
        0.95,
      ),
      maxKnownNearestOsmDistanceMeters: Math.max(...knownOverlapDistances),
      skippedExactDuplicateSegments: spike.skippedExactDuplicateSegments,
    },
  }

  results.push(result)
  geoJsonFeatures.push(
    lineFeature(sourceCoordinates, {
      caseId: fixtureCase.caseId,
      layer: 'fkb-source',
      sourceId: fixtureCase.sourceObject.sourceId,
      typeVeg: fixtureCase.sourceObject.typeVeg,
    }),
    lineFeature(
      pureOsmResult.routeNodes.map(toCoordinate),
      { caseId: fixtureCase.caseId, layer: 'pure-osm-route' },
    ),
    lineFeature(
      hybridResult.routeNodes.map(toCoordinate),
      { caseId: fixtureCase.caseId, layer: 'hybrid-route' },
    ),
    ...spike.conflationPoints.map((point) =>
      lineFeature(
        [toCoordinate(point.osmPosition), toCoordinate(point.fkbPosition)],
        {
          caseId: fixtureCase.caseId,
          layer: 'conflation-link',
          endpoint: point.endpoint,
          distanceMeters: point.distanceMeters,
        },
      ),
    ),
  )
}

if (
  osmGraph.nodes.size !== originalNodeCount ||
  osmGraph.edges.length !== originalEdgeCount
) {
  throw new Error('The validation spike mutated the original OSM graph')
}

await mkdir(diagnosticDirectory, { recursive: true })
await writeFile(resultsPath, JSON.stringify(results, null, 2), 'utf8')
await writeFile(
  geoJsonPath,
  JSON.stringify(
    { type: 'FeatureCollection', features: geoJsonFeatures },
    null,
    2,
  ),
  'utf8',
)

console.table(
  results.map((result) => ({
    case: result.caseId,
    type: result.fkb.typeVeg,
    osmMeters: result.pureOsm.distanceMeters.toFixed(1),
    hybridMeters: result.hybrid.distanceMeters.toFixed(1),
    improvementMeters: result.improvement.distanceMeters.toFixed(1),
    improvementPercent: result.improvement.percent.toFixed(1),
    virtualEdges: result.hybrid.edgeSourceCounts.virtual,
  })),
)
console.log(`Detaljer: ${resultsPath}`)
console.log(`Diagnostisk GeoJSON: ${geoJsonPath}`)

function lineLength(coordinates: readonly (readonly [number, number])[]) {
  let distanceMeters = 0

  for (let index = 1; index < coordinates.length; index += 1) {
    distanceMeters += calculateGeographicDistanceMeters(
      {
        longitude: coordinates[index - 1][0],
        latitude: coordinates[index - 1][1],
      },
      {
        longitude: coordinates[index][0],
        latitude: coordinates[index][1],
      },
    )
  }

  return distanceMeters
}

function percentile(sortedValues: readonly number[], fraction: number) {
  if (sortedValues.length === 0) {
    return null
  }

  return sortedValues[
    Math.min(
      sortedValues.length - 1,
      Math.floor((sortedValues.length - 1) * fraction),
    )
  ]
}

function lineFeature(
  coordinates: readonly (readonly [number, number])[],
  properties: Record<string, string | number>,
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
