import { calculateGeographicDistanceMeters } from '../../src/utils/geographicDistance.ts'
import type { RoutingArea } from './routingAreas.ts'
import {
  AUDIT_ADDITIONAL_HIGHWAY_EDGE_TYPES,
  AUDIT_EXPANDED_HIGHWAY_EDGE_TYPES,
  CURRENT_HIGHWAY_EDGE_TYPES,
  classifyFootAccess,
  isWalkable,
  type OrdinaryEdgeType,
} from './osmWalkingPolicy.ts'

export type OsmNode = {
  type: 'node'
  id: number
  lat: number
  lon: number
}

export type OsmWay = {
  type: 'way'
  id: number
  nodes: number[]
  tags?: Record<string, string>
}

export type OverpassResponse = {
  osm3s?: {
    timestamp_osm_base?: string
  }
  elements: Array<OsmNode | OsmWay>
}

export type HighwayClassStats = {
  highway: string
  policyRole: 'current' | 'audit-addition' | 'observed-only'
  ways: number
  passingCurrentAccessFilter: number
  explicitFootAllowed: number
  explicitFootRestricted: number
  generalAccessRestricted: number
  implicitOrUnknown: number
}

export type HighwayPolicyMetrics = {
  ways: number
  nodes: number
  physicalSegments: number
  totalDistanceMeters: number
  components: number
  largestComponentNodes: number
  waysByHighway: Record<string, number>
}

export type HighwayCoverageReport = {
  area: string
  bounds: RoutingArea['bounds']
  snapshotTimestamp: string | null
  observedHighways: HighwayClassStats[]
  currentPolicy: HighwayPolicyMetrics
  expandedAuditPolicy: HighwayPolicyMetrics
  delta: {
    addedWays: number
    addedNodes: number
    addedPhysicalSegments: number
    addedDistanceMeters: number
    componentDelta: number
    baselineComponentsJoined: number
    expandedComponentsJoiningBaseline: number
  }
  note: string
}

type PolicyGraph = {
  metrics: HighwayPolicyMetrics
  componentByNodeId: Map<number, number>
}

export function analyzeHighwayCoverage(
  rawData: OverpassResponse,
  area: RoutingArea,
): HighwayCoverageReport {
  const osmNodes = new Map(
    rawData.elements
      .filter((element): element is OsmNode => element.type === 'node')
      .map((node) => [node.id, node]),
  )
  const osmWays = rawData.elements.filter(
    (element): element is OsmWay => element.type === 'way',
  )
  const current = buildPolicyGraph(
    osmWays,
    osmNodes,
    area,
    CURRENT_HIGHWAY_EDGE_TYPES,
  )
  const expanded = buildPolicyGraph(
    osmWays,
    osmNodes,
    area,
    AUDIT_EXPANDED_HIGHWAY_EDGE_TYPES,
  )
  const mergeStats = calculateBaselineComponentMerges(
    current.componentByNodeId,
    expanded.componentByNodeId,
  )

  return {
    area: area.name,
    bounds: area.bounds,
    snapshotTimestamp: rawData.osm3s?.timestamp_osm_base ?? null,
    observedHighways: summarizeObservedHighways(osmWays),
    currentPolicy: current.metrics,
    expandedAuditPolicy: expanded.metrics,
    delta: {
      addedWays: expanded.metrics.ways - current.metrics.ways,
      addedNodes: expanded.metrics.nodes - current.metrics.nodes,
      addedPhysicalSegments:
        expanded.metrics.physicalSegments - current.metrics.physicalSegments,
      addedDistanceMeters:
        expanded.metrics.totalDistanceMeters -
        current.metrics.totalDistanceMeters,
      componentDelta:
        expanded.metrics.components - current.metrics.components,
      ...mergeStats,
    },
    note:
      'Expanded audit policy is topology analysis only. It does not approve the additional highway classes for final pedestrian routing.',
  }
}

function summarizeObservedHighways(
  ways: readonly OsmWay[],
): HighwayClassStats[] {
  const stats = new Map<string, HighwayClassStats>()

  for (const way of ways) {
    const tags = way.tags ?? {}
    const highway = tags.highway

    if (!highway) {
      continue
    }

    const current =
      stats.get(highway) ??
      createHighwayClassStats(highway, getPolicyRole(highway))
    current.ways += 1

    if (isWalkable(tags)) {
      current.passingCurrentAccessFilter += 1
    }

    const classification = classifyFootAccess(tags)
    if (classification === 'explicit-allowed') {
      current.explicitFootAllowed += 1
    } else if (classification === 'explicit-restricted') {
      current.explicitFootRestricted += 1
    } else if (classification === 'general-restricted') {
      current.generalAccessRestricted += 1
    } else {
      current.implicitOrUnknown += 1
    }

    stats.set(highway, current)
  }

  return [...stats.values()].sort(
    (left, right) =>
      right.ways - left.ways || left.highway.localeCompare(right.highway),
  )
}

function createHighwayClassStats(
  highway: string,
  policyRole: HighwayClassStats['policyRole'],
): HighwayClassStats {
  return {
    highway,
    policyRole,
    ways: 0,
    passingCurrentAccessFilter: 0,
    explicitFootAllowed: 0,
    explicitFootRestricted: 0,
    generalAccessRestricted: 0,
    implicitOrUnknown: 0,
  }
}

function getPolicyRole(highway: string): HighwayClassStats['policyRole'] {
  if (CURRENT_HIGHWAY_EDGE_TYPES[highway]) {
    return 'current'
  }

  if (AUDIT_ADDITIONAL_HIGHWAY_EDGE_TYPES[highway]) {
    return 'audit-addition'
  }

  return 'observed-only'
}

function buildPolicyGraph(
  ways: readonly OsmWay[],
  nodes: ReadonlyMap<number, OsmNode>,
  area: RoutingArea,
  policy: Readonly<Record<string, OrdinaryEdgeType>>,
): PolicyGraph {
  const adjacency = new Map<number, Set<number>>()
  const includedWayIds = new Set<number>()
  const waysByHighway: Record<string, number> = {}
  let physicalSegments = 0
  let totalDistanceMeters = 0

  for (const way of ways) {
    const tags = way.tags ?? {}
    const highway = tags.highway

    if (!highway || !policy[highway] || !isWalkable(tags)) {
      continue
    }

    let includedWay = false

    for (let index = 1; index < way.nodes.length; index += 1) {
      const fromNode = getOsmNode(nodes, way.nodes[index - 1], way.id)
      const toNode = getOsmNode(nodes, way.nodes[index], way.id)

      if (!isInsideBounds(fromNode, area.bounds) || !isInsideBounds(toNode, area.bounds)) {
        continue
      }

      addNeighbor(adjacency, fromNode.id, toNode.id)
      addNeighbor(adjacency, toNode.id, fromNode.id)
      physicalSegments += 1
      totalDistanceMeters += calculateGeographicDistanceMeters(
        { longitude: fromNode.lon, latitude: fromNode.lat },
        { longitude: toNode.lon, latitude: toNode.lat },
      )
      includedWay = true
    }

    if (includedWay) {
      includedWayIds.add(way.id)
      waysByHighway[highway] = (waysByHighway[highway] ?? 0) + 1
    }
  }

  const components = identifyComponents(adjacency)
  const largestComponentNodes = components.componentSizes.reduce(
    (largest, size) => Math.max(largest, size),
    0,
  )

  return {
    metrics: {
      ways: includedWayIds.size,
      nodes: adjacency.size,
      physicalSegments,
      totalDistanceMeters,
      components: components.componentSizes.length,
      largestComponentNodes,
      waysByHighway,
    },
    componentByNodeId: components.componentByNodeId,
  }
}

function identifyComponents(adjacency: ReadonlyMap<number, ReadonlySet<number>>) {
  const componentByNodeId = new Map<number, number>()
  const componentSizes: number[] = []

  for (const nodeId of adjacency.keys()) {
    if (componentByNodeId.has(nodeId)) {
      continue
    }

    const componentId = componentSizes.length
    const pending = [nodeId]
    let size = 0

    while (pending.length > 0) {
      const currentNodeId = pending.pop()

      if (currentNodeId === undefined || componentByNodeId.has(currentNodeId)) {
        continue
      }

      componentByNodeId.set(currentNodeId, componentId)
      size += 1

      for (const neighborId of adjacency.get(currentNodeId) ?? []) {
        if (!componentByNodeId.has(neighborId)) {
          pending.push(neighborId)
        }
      }
    }

    componentSizes.push(size)
  }

  return { componentByNodeId, componentSizes }
}

function calculateBaselineComponentMerges(
  baseline: ReadonlyMap<number, number>,
  expanded: ReadonlyMap<number, number>,
) {
  const baselineComponentsByExpanded = new Map<number, Set<number>>()

  for (const [nodeId, baselineComponentId] of baseline) {
    const expandedComponentId = expanded.get(nodeId)

    if (expandedComponentId === undefined) {
      continue
    }

    const baselineComponents =
      baselineComponentsByExpanded.get(expandedComponentId) ?? new Set<number>()
    baselineComponents.add(baselineComponentId)
    baselineComponentsByExpanded.set(expandedComponentId, baselineComponents)
  }

  let baselineComponentsJoined = 0
  let expandedComponentsJoiningBaseline = 0

  for (const baselineComponents of baselineComponentsByExpanded.values()) {
    if (baselineComponents.size > 1) {
      expandedComponentsJoiningBaseline += 1
      baselineComponentsJoined += baselineComponents.size - 1
    }
  }

  return {
    baselineComponentsJoined,
    expandedComponentsJoiningBaseline,
  }
}

function addNeighbor(
  adjacency: Map<number, Set<number>>,
  fromNodeId: number,
  toNodeId: number,
) {
  const neighbors = adjacency.get(fromNodeId) ?? new Set<number>()
  neighbors.add(toNodeId)
  adjacency.set(fromNodeId, neighbors)
}

function isInsideBounds(
  node: OsmNode,
  bounds: RoutingArea['bounds'],
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
