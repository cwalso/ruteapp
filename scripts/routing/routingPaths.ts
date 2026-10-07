import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export function getRawOsmPath(areaId: string) {
  return resolve(projectRoot, 'data/routing/raw', `${areaId}-overpass.json`)
}

export function getRoutingDatasetPath(areaId: string) {
  return resolve(projectRoot, 'public/data/routing', `${areaId}.json`)
}

export function getOsmHighwayAuditPath(areaId: string) {
  return resolve(
    projectRoot,
    'data/routing/diagnostics',
    `${areaId}-osm-highway-audit.json`,
  )
}
