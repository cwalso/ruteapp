import process from 'node:process'
import { getRoutingArea } from './routingAreas.ts'

const ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
] as const

const areaId = process.argv[2] ?? 'nerskogen'
const area = getRoutingArea(areaId)
const { south, west, north, east } = area.bounds
const query = `[out:json][timeout:30];
way["highway"="secondary"](${south},${west},${north},${east});
out tags;`

for (const endpoint of ENDPOINTS) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'RuteApp-development-routing-audit/0.1',
      },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!response.ok) {
      console.warn(`${endpoint}: ${response.status} ${response.statusText}`)
      continue
    }

    const data = (await response.json()) as {
      elements: Array<{
        id: number
        tags?: Record<string, string>
      }>
    }

    console.log(`Secondary ways for ${area.name} via ${endpoint}: ${data.elements.length}`)
    for (const way of data.elements) {
      console.log(JSON.stringify({ id: way.id, ...way.tags }))
    }
    process.exit(0)
  } catch (error) {
    console.warn(
      `${endpoint}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

throw new Error('Unable to inspect secondary ways from Overpass')
