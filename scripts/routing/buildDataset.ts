import { Buffer } from 'node:buffer'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import process from 'node:process'
import type {
  EdgeType,
  RoutingEdge,
  RoutingNode,
} from '../../src/routing/routingTypes.ts'
import type {
  RuteAppRoutingDataset,
  RoutingDatasetEdge,
  RoutingDatasetNode,
} from '../../src/routing/routingDataset.ts'
import { calculateGeographicDistanceMeters } from '../../src/utils/geographicDistance.ts'
import { getRoutingArea } from './routingAreas.ts'
import {
  getRawOsmPath,
  getRoutingDatasetPath,
} from './routingPaths.ts'

type OsmNode = {
  type: 'node'
  id: number
  lat: number
  lon: number
}

type OsmWay = {
  type: 'way'
  id: number
  nodes: number[]
  tags?: Record<string, string>
}

type OverpassResponse = {
  elements: Array<OsmNode | OsmWay>
}

const HIGHWAY_EDGE_TYPES: Readonly<Record<string, EdgeType>> = {
  path: 'path',
  footway: 'path',
  pedestrian: 'path',
  steps: 'path',
  track: 'track',
  service: 'road',
  unclassified: 'road',
  residential: 'road',
  living_street: 'road',
}

const RESTRICTED_ACCESS = new Set(['no', 'private'])
const EXPLICIT_FOOT_ACCESS = new Set(['yes', 'designated', 'permissive'])
const FORWARD_FOOT_ONEWAY = new Set(['yes', 'true', '1'])

const areaId = process.argv[2] ?? 'nerskogen'
const area = getRoutingArea(areaId)
const rawOsmPath = getRawOsmPath(area.id)
const routingDatasetPath = getRoutingDatasetPath(area.id)
const rawData = JSON.parse(await readFile(rawOsmPath, 'utf8')) as OverpassResponse
const osmNodes = new Map(
  rawData.elements
    .filter((element): element is OsmNode => element.type === 'node')
    .map((node) => [node.id, node]),
)
const osmWays = rawData.elements.filter(
  (element): element is OsmWay => element.type === 'way',
)

let excludedForAccess = 0
const walkableWays = osmWays.filter((way) => {
  if (!isWalkable(way.tags ?? {})) {
    excludedForAccess += 1
    return false
  }

  return true
})

const routingNodes = new Map<string, RoutingNode>()
const routingEdges: RoutingEdge[] = []
const includedWayIds = new Set<number>()

for (const way of walkableWays) {
  const tags = way.tags ?? {}
  const edgeType = HIGHWAY_EDGE_TYPES[tags.highway]

  if (!edgeType) {
    continue
  }

  for (let index = 1; index < way.nodes.length; index += 1) {
    const fromOsmNode = getOsmNode(osmNodes, way.nodes[index - 1], way.id)
    const toOsmNode = getOsmNode(osmNodes, way.nodes[index], way.id)

    if (
      !isInsideBounds(fromOsmNode, area.bounds) ||
      !isInsideBounds(toOsmNode, area.bounds)
    ) {
      continue
    }

    const fromNode = toRoutingNode(fromOsmNode)
    const toNode = toRoutingNode(toOsmNode)
    const distanceMeters = calculateGeographicDistanceMeters(
      fromNode,
      toNode,
    )

    routingNodes.set(fromNode.id, fromNode)
    routingNodes.set(toNode.id, toNode)
    includedWayIds.add(way.id)

    const direction = getFootDirection(tags['oneway:foot'])

    if (direction !== 'reverse') {
      routingEdges.push(
        createEdge(
          `${way.id}:${index}:f`,
          fromNode,
          toNode,
          distanceMeters,
          edgeType,
        ),
      )
    }

    if (direction !== 'forward') {
      routingEdges.push(
        createEdge(
          `${way.id}:${index}:r`,
          toNode,
          fromNode,
          distanceMeters,
          edgeType,
        ),
      )
    }
  }
}

const dataset: RuteAppRoutingDataset = {
  metadata: {
    area: area.name,
    bounds: area.bounds,
    generatedAt: new Date().toISOString(),
    source: '© OpenStreetMap contributors',
  },
  nodes: [...routingNodes.values()].map(toDatasetNode),
  edges: routingEdges.map(toDatasetEdge),
}
const serializedDataset = JSON.stringify(dataset)

await mkdir(dirname(routingDatasetPath), { recursive: true })
await writeFile(routingDatasetPath, serializedDataset, 'utf8')

const edgeTypeCounts = countEdgeTypes(routingEdges)
const componentCount = countWeaklyConnectedComponents(
  [...routingNodes.values()],
  routingEdges,
)
const byteSize = Buffer.byteLength(serializedDataset)

console.log(`Routingdata generert for ${area.name}`)
console.log(`OSM ways lest: ${osmWays.length}`)
console.log(`Ways inkludert: ${includedWayIds.size}`)
console.log(`Routing nodes: ${dataset.nodes.length}`)
console.log(`Routing edges: ${dataset.edges.length}`)
console.log(`Path-edges: ${edgeTypeCounts.path}`)
console.log(`Track-edges: ${edgeTypeCounts.track}`)
console.log(`Road-edges: ${edgeTypeCounts.road}`)
console.log(`Ways ekskludert på grunn av adgang: ${excludedForAccess}`)
console.log(
  `Gangbare ways uten segment innenfor bbox: ${walkableWays.length - includedWayIds.size}`,
)
console.log(`Sammenhengende komponenter: ${componentCount}`)
console.log(`JSON-størrelse: ${formatByteSize(byteSize)}`)
console.log(`Dataset lagret: ${routingDatasetPath}`)

function isWalkable(tags: Record<string, string>) {
  const footAccess = tags.foot?.toLowerCase()
  const generalAccess = tags.access?.toLowerCase()

  if (footAccess && RESTRICTED_ACCESS.has(footAccess)) {
    return false
  }

  return !(
    generalAccess &&
    RESTRICTED_ACCESS.has(generalAccess) &&
    (!footAccess || !EXPLICIT_FOOT_ACCESS.has(footAccess))
  )
}

function getFootDirection(onewayFoot: string | undefined) {
  const normalizedValue = onewayFoot?.toLowerCase()

  if (normalizedValue === '-1') {
    return 'reverse' as const
  }

  if (normalizedValue && FORWARD_FOOT_ONEWAY.has(normalizedValue)) {
    return 'forward' as const
  }

  return 'both' as const
}

function isInsideBounds(
  node: OsmNode,
  bounds: {
    south: number
    west: number
    north: number
    east: number
  },
) {
  return (
    node.lat >= bounds.south &&
    node.lat <= bounds.north &&
    node.lon >= bounds.west &&
    node.lon <= bounds.east
  )
}

function getOsmNode(
  nodes: ReadonlyMap<number, OsmNode>,
  nodeId: number,
  wayId: number,
) {
  const node = nodes.get(nodeId)

  if (!node) {
    throw new Error(`OSM way ${wayId} references missing node ${nodeId}`)
  }

  return node
}

function toRoutingNode(node: OsmNode): RoutingNode {
  return {
    id: String(node.id),
    longitude: node.lon,
    latitude: node.lat,
  }
}

function createEdge(
  id: string,
  fromNode: RoutingNode,
  toNode: RoutingNode,
  distanceMeters: number,
  edgeType: EdgeType,
): RoutingEdge {
  const straightLineDistance = calculateGeographicDistanceMeters(
    fromNode,
    toNode,
  )
  const cost = distanceMeters

  if (distanceMeters + Number.EPSILON < straightLineDistance) {
    throw new Error(`Edge ${id} violates the geographic distance invariant`)
  }

  if (cost < distanceMeters) {
    throw new Error(`Edge ${id} has cost lower than distance`)
  }

  return {
    id,
    fromNodeId: fromNode.id,
    toNodeId: toNode.id,
    distanceMeters,
    edgeType,
    cost,
  }
}

function toDatasetNode(node: RoutingNode): RoutingDatasetNode {
  return [node.id, node.longitude, node.latitude]
}

function toDatasetEdge(edge: RoutingEdge): RoutingDatasetEdge {
  return [
    edge.id,
    edge.fromNodeId,
    edge.toNodeId,
    edge.distanceMeters,
    edge.edgeType,
    edge.cost,
  ]
}

function countEdgeTypes(edges: readonly RoutingEdge[]) {
  const counts = { path: 0, track: 0, road: 0 }

  for (const edge of edges) {
    if (edge.edgeType !== 'virtual') {
      counts[edge.edgeType] += 1
    }
  }

  return counts
}

function countWeaklyConnectedComponents(
  nodes: readonly RoutingNode[],
  edges: readonly RoutingEdge[],
) {
  const neighbors = new Map(
    nodes.map((node) => [node.id, new Set<string>()]),
  )

  for (const edge of edges) {
    neighbors.get(edge.fromNodeId)?.add(edge.toNodeId)
    neighbors.get(edge.toNodeId)?.add(edge.fromNodeId)
  }

  const visited = new Set<string>()
  let componentCount = 0

  for (const node of nodes) {
    if (visited.has(node.id)) {
      continue
    }

    componentCount += 1
    const pendingNodeIds = [node.id]

    while (pendingNodeIds.length > 0) {
      const currentNodeId = pendingNodeIds.pop()

      if (!currentNodeId || visited.has(currentNodeId)) {
        continue
      }

      visited.add(currentNodeId)

      for (const neighborId of neighbors.get(currentNodeId) ?? []) {
        if (!visited.has(neighborId)) {
          pendingNodeIds.push(neighborId)
        }
      }
    }
  }

  return componentCount
}

function formatByteSize(byteSize: number) {
  return `${byteSize.toLocaleString('nb-NO')} bytes (${(byteSize / 1024).toFixed(1)} KiB)`
}
