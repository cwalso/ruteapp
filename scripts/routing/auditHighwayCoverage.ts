import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import process from 'node:process'
import { analyzeHighwayCoverage, type OverpassResponse } from './osmHighwayCoverage.ts'
import { getRoutingArea } from './routingAreas.ts'
import { getOsmHighwayAuditPath, getRawOsmPath } from './routingPaths.ts'

const areaId = process.argv[2] ?? 'nerskogen'
const area = getRoutingArea(areaId)
const rawOsmPath = getRawOsmPath(area.id)
const outputPath = getOsmHighwayAuditPath(area.id)
const rawData = JSON.parse(
  await readFile(rawOsmPath, 'utf8'),
) as OverpassResponse
const report = analyzeHighwayCoverage(rawData, area)

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8')

console.log(`OSM highway coverage-audit for ${report.area}`)
console.log(`Snapshot: ${report.snapshotTimestamp ?? 'ukjent'}`)
console.log('')
console.log('Dagens policy:')
printMetrics(report.currentPolicy)
console.log('')
console.log('Utvidet audit-policy:')
printMetrics(report.expandedAuditPolicy)
console.log('')
console.log('Topologisk delta:')
console.log(`  + ways: ${report.delta.addedWays}`)
console.log(`  + noder: ${report.delta.addedNodes}`)
console.log(`  + fysiske segmenter: ${report.delta.addedPhysicalSegments}`)
console.log(
  `  + lengde: ${(report.delta.addedDistanceMeters / 1000).toFixed(2)} km`,
)
console.log(`  komponentendring: ${report.delta.componentDelta}`)
console.log(
  `  baseline-komponenter faktisk slått sammen: ${report.delta.baselineComponentsJoined}`,
)
console.log(
  `  utvidede komponenter som samler flere baseline-komponenter: ${report.delta.expandedComponentsJoiningBaseline}`,
)
console.log('')
console.log('Audit-tillegg, konkrete ways:')

for (const way of report.auditAdditionWays) {
  console.log(
    `  ${way.highway} way ${way.id}: name=${formatTag(way.name)}, ref=${formatTag(way.ref)}, ` +
      `${(way.inBoundsDistanceMeters / 1000).toFixed(2)} km, segments=${way.inBoundsSegments}, ` +
      `baseline-components=${way.baselineComponentsTouched}, access-pass=${way.passingCurrentAccessFilter}, ` +
      `foot=${formatTag(way.foot)}, access=${formatTag(way.access)}, sidewalk=${formatTag(way.sidewalk)}, ` +
      `sidewalk:left=${formatTag(way.sidewalkLeft)}, sidewalk:right=${formatTag(way.sidewalkRight)}, ` +
      `surface=${formatTag(way.surface)}, maxspeed=${formatTag(way.maxspeed)}`,
  )
}

console.log('')
console.log('Observerte highway-klasser:')

for (const stats of report.observedHighways) {
  console.log(
    `  ${stats.highway}: ${stats.ways} ways, rolle=${stats.policyRole}, ` +
      `access-pass=${stats.passingCurrentAccessFilter}, explicit-foot-yes=${stats.explicitFootAllowed}, ` +
      `explicit-foot-no=${stats.explicitFootRestricted}, general-restricted=${stats.generalAccessRestricted}, ` +
      `implicit/ukjent=${stats.implicitOrUnknown}`,
  )
}

console.log('')
console.log(`Rapport lagret: ${outputPath}`)

function printMetrics(metrics: {
  ways: number
  nodes: number
  physicalSegments: number
  totalDistanceMeters: number
  components: number
  largestComponentNodes: number
}) {
  console.log(`  ways: ${metrics.ways}`)
  console.log(`  noder: ${metrics.nodes}`)
  console.log(`  fysiske segmenter: ${metrics.physicalSegments}`)
  console.log(`  lengde: ${(metrics.totalDistanceMeters / 1000).toFixed(2)} km`)
  console.log(`  komponenter: ${metrics.components}`)
  console.log(`  største komponent: ${metrics.largestComponentNodes} noder`)
}

function formatTag(value: string | null) {
  return value ?? '∅'
}
