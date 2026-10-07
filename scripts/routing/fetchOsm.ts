import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import process from 'node:process'
import { getRoutingArea } from './routingAreas.ts'
import { AUDIT_EXPANDED_HIGHWAY_EDGE_TYPES } from './osmWalkingPolicy.ts'
import { getRawOsmPath } from './routingPaths.ts'

const OVERPASS_ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
] as const

const OVERPASS_REQUEST_TIMEOUT_MILLISECONDS = 30_000

const areaId = process.argv[2] ?? 'nerskogen'
const area = getRoutingArea(areaId)
const rawOsmPath = getRawOsmPath(area.id)
const { south, west, north, east } = area.bounds
const highwayPattern = `^(${Object.keys(AUDIT_EXPANDED_HIGHWAY_EDGE_TYPES).join('|')})import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import process from 'node:process'
import { getRoutingArea } from './routingAreas.ts'
import { AUDIT_EXPANDED_HIGHWAY_EDGE_TYPES } from './osmWalkingPolicy.ts'
import { getRawOsmPath } from './routingPaths.ts'

const OVERPASS_ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
] as const

const OVERPASS_REQUEST_TIMEOUT_MILLISECONDS = 30_000

const areaId = process.argv[2] ?? 'nerskogen'
const area = getRoutingArea(areaId)
const rawOsmPath = getRawOsmPath(area.id)

const query = `[out:json][timeout:120];
(
  way["highway"~"${highwayPattern}"](${south},${west},${north},${east});
);
out body;
>;
out skel qt;`

console.log(
  `Henter utvidet OSM highway-snapshot for ${area.name} fra Overpass...`,
)

const { responseText, endpoint } = await fetchOverpassSnapshot(query)
const responseData = JSON.parse(responseText) as { remark?: string }

if (responseData.remark) {
  throw new Error(`Overpass returned an error: ${responseData.remark}`)
}

await mkdir(dirname(rawOsmPath), { recursive: true })
await writeFile(rawOsmPath, responseText, 'utf8')

console.log(`Overpass-instans: ${endpoint}`)
console.log(`Rådata lagret: ${rawOsmPath}`)

async function fetchOverpassSnapshot(overpassQuery: string) {
  let lastError: Error | undefined

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'RuteApp-development-routing-import/0.1',
        },
        body: new URLSearchParams({ data: overpassQuery }),
        signal: AbortSignal.timeout(OVERPASS_REQUEST_TIMEOUT_MILLISECONDS),
      })

      if (!response.ok) {
        lastError = new Error(
          `Overpass request failed at ${endpoint}: ${response.status} ${response.statusText}`,
        )
        console.warn(lastError.message)
        continue
      }

      return {
        responseText: await response.text(),
        endpoint,
      }
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(`Unknown Overpass error at ${endpoint}`)
      console.warn(`Overpass request failed at ${endpoint}: ${lastError.message}`)
    }
  }

  throw lastError ?? new Error('All Overpass endpoints failed')
}
