import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { calculateGeographicDistanceMeters } from '../../../src/utils/geographicDistance.ts'
import { routeWaypoints } from '../../../src/routing/routeWaypoints.ts'
import {
  loadRoutingDataset,
  parseRoutingDataset,
} from '../../../src/routing/routingDataset.ts'
import { sameComponentShortcutConfig } from '../../../src/routing/sameComponentShortcutConfig.ts'
import {
  findSameComponentShortcutCandidates,
  type SameComponentShortcutCandidate,
} from '../../../src/routing/sameComponentShortcutCandidates.ts'
import { findWeaklyConnectedComponents } from '../../../src/routing/virtualConnections.ts'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const datasetPath = resolve(projectRoot, 'public/data/routing/nerskogen.json')
const outputPath = resolve(
  projectRoot,
  'data/routing/diagnostics/same-component-shortcuts.geojson',
)
const knownDetourRoutePoints = [
  { latitude: 62.76968, longitude: 9.55381 },
  { latitude: 62.76532, longitude: 9.55131 },
]
const knownGapNodeIds = ['8332065102', '13276455322'] as const
const componentGapEdgeIds = ['896319493:3:f', '303552729:1:f'] as const

const dataset = parseRoutingDataset(
  JSON.parse(await readFile(datasetPath, 'utf8')),
)
const ordinaryGraph = loadRoutingDataset(dataset)
const startedAt = performance.now()
const result = findSameComponentShortcutCandidates(
  ordinaryGraph,
  sameComponentShortcutConfig,
)
const durationMilliseconds = performance.now() - startedAt
const geoJson = createGeoJson(result.candidates)
const knownDetourRoute = routeWaypoints(
  knownDetourRoutePoints,
  ordinaryGraph,
  dataset.metadata.bounds,
  100,
)
const knownGapCandidate = findCandidateNearestKnownGap(
  result.candidates,
  ordinaryGraph,
)
const components = findWeaklyConnectedComponents(ordinaryGraph)
const componentGapEdges = componentGapEdgeIds.map((edgeId) =>
  ordinaryGraph.edges.find(({ id }) => id === edgeId),
)
const componentGapComponentIds = componentGapEdges.map((edge) =>
  edge ? components.componentByNodeId.get(edge.fromNodeId) : undefined,
)
const componentGapPairWasEmitted = result.candidates.some(
  ({ fromEdgeId, toEdgeId }) =>
    componentGapEdgeIds.includes(
      fromEdgeId as (typeof componentGapEdgeIds)[number],
    ) &&
    componentGapEdgeIds.includes(
      toEdgeId as (typeof componentGapEdgeIds)[number],
    ),
)

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(geoJson, null, 2)}\n`, 'utf8')

console.log('Same-component shortcut candidates – Nerskogen diagnose')
console.log('Kandidatene materialiseres ikke som virtuelle routing-edges.')
console.log(`Ordinary components: ${result.componentCount}`)
console.log(`Fysiske ordinary-segmenter: ${result.physicalSegmentCount}`)
console.log(
  `Geografiske edge-par vurdert: ${result.geographicPairsEvaluated}`,
)
console.log(`Nære par sendt til nettverksmåling: ${result.nearbyPairs}`)
console.log(`Nettverksberegninger: ${result.networkCalculations}`)
console.log(`Faktiske A*-kjøringer etter cache: ${result.aStarRuns}`)
console.log(
  `Kandidater før/etter deduplisering: ` +
    `${result.candidatesBeforeDeduplication}/${result.candidates.length}`,
)
console.log(`Samlet kjøretid: ${durationMilliseconds.toFixed(1)} ms`)
console.log(
  `Gjennomsnittlig samlet generatortid per A*-kjøring: ` +
    `${(durationMilliseconds / Math.max(result.aStarRuns, 1)).toFixed(3)} ms`,
)
console.log(`GeoJSON: ${outputPath}`)

if (knownDetourRoute.status === 'routed') {
  console.log(
    `Kjent lang omvei: ${knownDetourRoute.route.totalDistanceMeters.toFixed(1)} m ` +
      `over ${knownDetourRoute.route.edges.length} edges.`,
  )
}

if (knownGapCandidate) {
  console.log(
    `Nærmeste kandidat til kjent lokalt gap: ${knownGapCandidate.candidate.candidateId}; ` +
      `${knownGapCandidate.candidate.directDistanceMeters.toFixed(1)} m direkte, ` +
      `${knownGapCandidate.candidate.ordinaryNetworkDistanceMeters.toFixed(1)} m nettverk, ` +
      `ratio ${knownGapCandidate.candidate.detourRatio.toFixed(1)}, ` +
      `referanseavvik ${knownGapCandidate.endpointOffsetMeters.toFixed(1)} m.`,
  )
}

console.log(
  `Ørnkjellhaugan component-gap: komponenter ` +
    `${componentGapComponentIds.join(' / ')}, ` +
    `emittert av same-component-generator: ${componentGapPairWasEmitted}.`,
)
console.log('Topp 10 etter høyest detour ratio:')
console.table(
  result.candidates.slice(0, 10).map((candidate) => ({
    candidateId: candidate.candidateId,
    directMeters: candidate.directDistanceMeters.toFixed(1),
    networkMeters: candidate.ordinaryNetworkDistanceMeters.toFixed(1),
    ratio: candidate.detourRatio.toFixed(1),
    edgeTypes: `${candidate.fromEdgeType}/${candidate.toEdgeType}`,
    fromEdgeId: candidate.fromEdgeId,
    toEdgeId: candidate.toEdgeId,
    from: formatCoordinate(candidate.fromCoordinate),
    to: formatCoordinate(candidate.toCoordinate),
  })),
)

function createGeoJson(
  candidates: readonly SameComponentShortcutCandidate[],
) {
  return {
    type: 'FeatureCollection' as const,
    features: candidates.map((candidate) => ({
      type: 'Feature' as const,
      id: candidate.candidateId,
      properties: {
        candidateId: candidate.candidateId,
        directDistanceMeters: candidate.directDistanceMeters,
        ordinaryNetworkDistanceMeters:
          candidate.ordinaryNetworkDistanceMeters,
        detourRatio: candidate.detourRatio,
        componentId: candidate.componentId,
        fromEdgeId: candidate.fromEdgeId,
        toEdgeId: candidate.toEdgeId,
        fromEdgeType: candidate.fromEdgeType,
        toEdgeType: candidate.toEdgeType,
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [
            candidate.fromCoordinate.longitude,
            candidate.fromCoordinate.latitude,
          ],
          [
            candidate.toCoordinate.longitude,
            candidate.toCoordinate.latitude,
          ],
        ],
      },
    })),
  }
}

function findCandidateNearestKnownGap(
  candidates: readonly SameComponentShortcutCandidate[],
  graph: typeof ordinaryGraph,
) {
  const firstNode = graph.nodes.get(knownGapNodeIds[0])
  const secondNode = graph.nodes.get(knownGapNodeIds[1])

  if (!firstNode || !secondNode) {
    return undefined
  }

  return candidates
    .map((candidate) => ({
      candidate,
      endpointOffsetMeters: Math.min(
        calculateGeographicDistanceMeters(
          candidate.fromCoordinate,
          firstNode,
        ) +
          calculateGeographicDistanceMeters(
            candidate.toCoordinate,
            secondNode,
          ),
        calculateGeographicDistanceMeters(
          candidate.fromCoordinate,
          secondNode,
        ) +
          calculateGeographicDistanceMeters(
            candidate.toCoordinate,
            firstNode,
          ),
      ),
    }))
    .sort(
      (first, second) =>
        first.endpointOffsetMeters - second.endpointOffsetMeters ||
        first.candidate.candidateId.localeCompare(second.candidate.candidateId),
    )[0]
}

function formatCoordinate(position: {
  longitude: number
  latitude: number
}) {
  return `${position.latitude.toFixed(6)},${position.longitude.toFixed(6)}`
}
