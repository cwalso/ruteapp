import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import process from 'node:process'
import { getRoutingArea } from './routingAreas.ts'
import { getRawOsmPath } from './routingPaths.ts'

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'
const INCLUDED_HIGHWAYS = [
  'path',
  'footway',
  'track',
  'pedestrian',
  'steps',
  'service',
  'unclassified',
  'residential',
  'living_street',
] as const

const areaId = process.argv[2] ?? 'nerskogen'
const area = getRoutingArea(areaId)
const rawOsmPath = getRawOsmPath(area.id)
const { south, west, north, east } = area.bounds
const highwayPattern = `^(${INCLUDED_HIGHWAYS.join('|')})$`
const query = `[out:json][timeout:120];
(
  way["highway"~"${highwayPattern}"](${south},${west},${north},${east});
);
out body;
>;
out skel qt;`

console.log(`Henter OSM-data for ${area.name} fra Overpass...`)

const response = await fetch(OVERPASS_ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    'User-Agent': 'RuteApp-development-routing-import/0.1',
  },
  body: new URLSearchParams({ data: query }),
})

if (!response.ok) {
  throw new Error(
    `Overpass request failed: ${response.status} ${response.statusText}`,
  )
}

const responseText = await response.text()
const responseData = JSON.parse(responseText) as { remark?: string }

if (responseData.remark) {
  throw new Error(`Overpass returned an error: ${responseData.remark}`)
}

await mkdir(dirname(rawOsmPath), { recursive: true })
await writeFile(rawOsmPath, responseText, 'utf8')

console.log(`Rådata lagret: ${rawOsmPath}`)
