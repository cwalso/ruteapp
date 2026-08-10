import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRoutingDataset, parseRoutingDataset } from '../../../src/routing/routingDataset.ts'
import { virtualConnectionConfig } from '../../../src/routing/virtualConnectionConfig.ts'
import { createGraphWithVirtualConnections } from '../../../src/routing/virtualConnections.ts'
import { createVirtualCandidateDebugData } from '../../../src/map/virtualCandidateDebugData.ts'
import { findNearestRoutingEdgePoint } from '../../../src/routing/nearestRoutingEdgePoint.ts'
import { findRoute } from '../../../src/routing/aStar.ts'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const datasetPath = resolve(projectRoot, 'public/data/routing/nerskogen.json')
const outputPath = resolve(
  projectRoot,
  'data/routing/diagnostics/virtual-candidates.geojson',
)
const readStartedAt = performance.now()
const datasetText = await readFile(datasetPath, 'utf8')
const readDurationMilliseconds = performance.now() - readStartedAt
const parseStartedAt = performance.now()
const dataset = parseRoutingDataset(JSON.parse(datasetText))
const parseDurationMilliseconds = performance.now() - parseStartedAt
const graphStartedAt = performance.now()
const ordinaryGraph = loadRoutingDataset(dataset)
const graphDurationMilliseconds = performance.now() - graphStartedAt
const startedAt = performance.now()
const result = createGraphWithVirtualConnections(
  ordinaryGraph,
  virtualConnectionConfig,
)
const durationMilliseconds = performance.now() - startedAt
const debugData = createVirtualCandidateDebugData(result.candidates)
const westernSnapStartedAt = performance.now()
const westernSnap = findNearestRoutingEdgePoint(
  ordinaryGraph,
  { latitude: 62.8028, longitude: 9.52499 },
  100,
)
const westernSnapDurationMilliseconds =
  performance.now() - westernSnapStartedAt
const goldenRouteStartedAt = performance.now()
const goldenRoute = findRoute(result.graph, '8332025315', '3079323663')
const goldenRouteDurationMilliseconds =
  performance.now() - goldenRouteStartedAt
const buckets = {
  '0–50 m': 0,
  '50–100 m': 0,
  '100–150 m': 0,
  '150–200 m': 0,
}

for (const candidate of result.candidates) {
  if (candidate.distanceMeters < 50) {
    buckets['0–50 m'] += 1
  } else if (candidate.distanceMeters < 100) {
    buckets['50–100 m'] += 1
  } else if (candidate.distanceMeters < 150) {
    buckets['100–150 m'] += 1
  } else {
    buckets['150–200 m'] += 1
  }
}

console.log('Virtuelle terrengforbindelser – Nerskogen diagnose')
console.log('Kun topologi og avstand er vurdert; kandidatene er ikke sikkerhetsvurdert.')
console.log(`Maksimal avstand: ${virtualConnectionConfig.maxVirtualDistanceMeters} m`)
console.log(`Kostnadsfaktor: ${virtualConnectionConfig.virtualCostMultiplier}`)
console.log(`Routingnoder: ${ordinaryGraph.nodes.size}`)
console.log(`Routingedges: ${ordinaryGraph.edges.length}`)
console.log(`Datasettstørrelse: ${Buffer.byteLength(datasetText, 'utf8')} bytes`)
console.log(
  `Lokal filinnlesing/parsing/grafbygging: ${readDurationMilliseconds.toFixed(1)} / ` +
    `${parseDurationMilliseconds.toFixed(1)} / ${graphDurationMilliseconds.toFixed(1)} ms`,
)
console.log(`Komponenter før: ${result.componentCountBefore}`)
console.log(`Komponenter etter: ${result.componentCountAfter}`)
console.log(`Komponenter med minst én kandidat: ${result.connectableComponentCount}`)
console.log(`Genererte kandidater: ${result.candidates.length}`)
console.log(`Avstandsfordeling: ${JSON.stringify(buckets)}`)
console.log(`Kjøretid: ${durationMilliseconds.toFixed(1)} ms`)
console.log(
  `Vestlig snap: ${westernSnap?.edge.id ?? 'ingen'} / ` +
    `${westernSnap?.distanceMeters.toFixed(1) ?? '–'} m / ` +
    `${westernSnapDurationMilliseconds.toFixed(1)} ms`,
)
console.log(
  `Ørnkjellhaugan A*: ${goldenRoute?.totalDistanceMeters.toFixed(1) ?? 'ingen rute'} m / ` +
    `${goldenRouteDurationMilliseconds.toFixed(1)} ms`,
)
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(debugData, null, 2)}\n`, 'utf8')
console.log(`GeoJSON: ${outputPath}`)
console.log('Ti korteste kandidater:')

console.table(
  result.candidates.slice(0, 10).map((candidate, index) => ({
    id: debugData.features[index].properties.candidateId,
    distanceMeters: candidate.distanceMeters.toFixed(2),
    components: candidate.componentIds.join(' → '),
    fromEdge: candidate.from.edgeId,
    fromPosition: candidate.from.positionAlongEdge.toFixed(4),
    toEdge: candidate.to.edgeId,
    toPosition: candidate.to.positionAlongEdge.toFixed(4),
  })),
)
