import { createRoutingGraph } from './routingGraph'
import type {
  EdgeType,
  RoutingEdge,
  RoutingNode,
} from './routingTypes'

export type RoutingDatasetBounds = {
  south: number
  west: number
  north: number
  east: number
}

export type RuteAppRoutingDataset = {
  metadata: {
    area: string
    bounds: RoutingDatasetBounds
    generatedAt: string
    source: string
  }
  nodes: readonly RoutingDatasetNode[]
  edges: readonly RoutingDatasetEdge[]
}

const EDGE_TYPES: ReadonlySet<EdgeType> = new Set([
  'path',
  'track',
  'road',
  'virtual',
])

export function parseRoutingDataset(value: unknown): RuteAppRoutingDataset {
  if (!isRecord(value) || !isRecord(value.metadata)) {
    throw new Error('Routing dataset metadata is missing')
  }

  const { metadata } = value

  if (
    typeof metadata.area !== 'string' ||
    typeof metadata.generatedAt !== 'string' ||
    typeof metadata.source !== 'string' ||
    !isRoutingDatasetBounds(metadata.bounds) ||
    !Array.isArray(value.nodes) ||
    !value.nodes.every(isRoutingDatasetNode) ||
    !Array.isArray(value.edges) ||
    !value.edges.every(isRoutingDatasetEdge)
  ) {
    throw new Error('Routing dataset has an invalid structure')
  }

  return value as RuteAppRoutingDataset
}

export function loadRoutingDataset(dataset: RuteAppRoutingDataset) {
  const nodes: RoutingNode[] = dataset.nodes.map(
    ([id, longitude, latitude]) => ({ id, longitude, latitude }),
  )
  const edges: RoutingEdge[] = dataset.edges.map(
    ([id, fromNodeId, toNodeId, distanceMeters, edgeType, cost]) => ({
      id,
      fromNodeId,
      toNodeId,
      distanceMeters,
      edgeType,
      cost,
    }),
  )

  return createRoutingGraph(nodes, edges)
}

export type RoutingDatasetNode = readonly [
  id: string,
  longitude: number,
  latitude: number,
]

export type RoutingDatasetEdge = readonly [
  id: string,
  fromNodeId: string,
  toNodeId: string,
  distanceMeters: number,
  edgeType: EdgeType,
  cost: number,
]

function isRoutingDatasetBounds(value: unknown) {
  return (
    isRecord(value) &&
    isFiniteNumber(value.south) &&
    isFiniteNumber(value.west) &&
    isFiniteNumber(value.north) &&
    isFiniteNumber(value.east)
  )
}

function isRoutingDatasetNode(value: unknown): value is RoutingDatasetNode {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    typeof value[0] === 'string' &&
    isFiniteNumber(value[1]) &&
    isFiniteNumber(value[2])
  )
}

function isRoutingDatasetEdge(value: unknown): value is RoutingDatasetEdge {
  return (
    Array.isArray(value) &&
    value.length === 6 &&
    typeof value[0] === 'string' &&
    typeof value[1] === 'string' &&
    typeof value[2] === 'string' &&
    isFiniteNumber(value[3]) &&
    typeof value[4] === 'string' &&
    EDGE_TYPES.has(value[4] as EdgeType) &&
    isFiniteNumber(value[5])
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
