import { findNearestRoutingEdgePoint } from '../../../src/routing/nearestRoutingEdgePoint.ts'
import { createRoutingGraph } from '../../../src/routing/routingGraph.ts'
import { createRoutingGraphWithEdgeSnaps } from '../../../src/routing/routingSnapGraph.ts'
import type {
  EdgeType,
  RoutingEdge,
  RoutingGraph,
  RoutingNode,
} from '../../../src/routing/routingTypes.ts'
import { calculateGeographicDistanceMeters } from '../../../src/utils/geographicDistance.ts'
import type {
  FkbCoordinate,
  FkbSpikeSourceObject,
} from './fkbConflationSpikeGraph.ts'

export type SupportedFkbType = 'sti' | 'traktorveg'

export type FkbValidationEdgeProvenance = {
  source: 'fkb'
  sourceId: string
  sourceIdIsStable: false
  objectType: string
  typeVeg: SupportedFkbType
  kind: 'source' | 'conflation'
}

export type FkbValidationConflationPoint = {
  endpoint: 'start' | 'end'
  sourceId: string
  osmEdgeId: string
  osmEdgeType: EdgeType
  osmFromNodeId: string
  osmToNodeId: string
  osmPosition: RoutingNode
  fkbPosition: RoutingNode
  distanceMeters: number
}

export type FkbValidationGraphResult = {
  graph: RoutingGraph
  edgeProvenance: ReadonlyMap<string, FkbValidationEdgeProvenance>
  conflationPoints: readonly FkbValidationConflationPoint[]
  skippedExactDuplicateSegments: number
}

export type FkbValidationRouteSourceCounts = {
  osm: Record<Exclude<EdgeType, 'virtual'>, number>
  fkb: Record<Exclude<EdgeType, 'virtual'>, number>
  virtual: number
}

const POSITION_PRECISION = 12

export function buildFkbValidationGraph(
  osmGraph: RoutingGraph,
  sourceObject: FkbSpikeSourceObject,
  conflationToleranceMeters: number,
): FkbValidationGraphResult {
  const typeVeg = validateSourceObject(sourceObject)
  const edgeType = mapFkbTypeToEdgeType(typeVeg)
  const coordinates = sourceObject.geometry.coordinates
  const endpointCoordinates = [coordinates[0], coordinates.at(-1)!] as const
  const endpointNames = ['start', 'end'] as const
  const endpointSnaps = endpointCoordinates.map((coordinate, pointIndex) => {
    const snap = findNearestRoutingEdgePoint(
      osmGraph,
      toPosition(coordinate),
      conflationToleranceMeters,
    )

    if (!snap) {
      throw new Error(
        `FKB object ${sourceObject.sourceId} has no OSM connection within ${conflationToleranceMeters} m at its ${endpointNames[pointIndex]} endpoint`,
      )
    }

    return { pointIndex, snap }
  })
  const { graph: splitOsmGraph, resolvedSnaps } =
    createRoutingGraphWithEdgeSnaps(osmGraph, endpointSnaps)
  const nodes = new Map(splitOsmGraph.nodes)
  const edges = [...splitOsmGraph.edges]
  const edgeProvenance = new Map<
    string,
    FkbValidationEdgeProvenance
  >()
  const existingPhysicalSegments = collectPhysicalSegmentKeys(splitOsmGraph)
  const addedPhysicalSegments = new Set<string>()
  let skippedExactDuplicateSegments = 0

  for (const coordinate of coordinates) {
    const node = toFkbNode(sourceObject.sourceId, coordinate)
    nodes.set(node.id, node)
  }

  for (let index = 1; index < coordinates.length; index += 1) {
    const fromNode = toFkbNode(sourceObject.sourceId, coordinates[index - 1])
    const toNode = toFkbNode(sourceObject.sourceId, coordinates[index])
    const physicalSegmentKey = createPhysicalSegmentKey(fromNode, toNode)

    if (
      existingPhysicalSegments.has(physicalSegmentKey) ||
      addedPhysicalSegments.has(physicalSegmentKey)
    ) {
      skippedExactDuplicateSegments += 1
      continue
    }

    addedPhysicalSegments.add(physicalSegmentKey)
    const baseId = `fkb-validation:${sourceObject.sourceId}:${index}`
    const forwardEdge = createEdge(`${baseId}:f`, fromNode, toNode, edgeType)
    const reverseEdge = createEdge(`${baseId}:r`, toNode, fromNode, edgeType)
    const provenance = createProvenance(sourceObject, typeVeg, 'source')
    edges.push(forwardEdge, reverseEdge)
    edgeProvenance.set(forwardEdge.id, provenance)
    edgeProvenance.set(reverseEdge.id, provenance)
  }

  const conflationPoints = resolvedSnaps.map(
    ({ pointIndex, node: osmNode, snap }): FkbValidationConflationPoint => {
      const endpoint = endpointNames[pointIndex]
      const fkbNode = toFkbNode(
        sourceObject.sourceId,
        endpointCoordinates[pointIndex],
      )
      const distanceMeters = calculateGeographicDistanceMeters(
        osmNode,
        fkbNode,
      )
      const baseId =
        `fkb-validation-conflation:${sourceObject.sourceId}:${endpoint}`
      const toFkbEdge = createEdge(
        `${baseId}:to-fkb`,
        osmNode,
        fkbNode,
        edgeType,
      )
      const toOsmEdge = createEdge(
        `${baseId}:to-osm`,
        fkbNode,
        osmNode,
        edgeType,
      )
      const provenance = createProvenance(
        sourceObject,
        typeVeg,
        'conflation',
      )
      edges.push(toFkbEdge, toOsmEdge)
      edgeProvenance.set(toFkbEdge.id, provenance)
      edgeProvenance.set(toOsmEdge.id, provenance)

      return {
        endpoint,
        sourceId: sourceObject.sourceId,
        osmEdgeId: snap.edge.id,
        osmEdgeType: snap.edge.edgeType,
        osmFromNodeId: snap.edge.fromNodeId,
        osmToNodeId: snap.edge.toNodeId,
        osmPosition: osmNode,
        fkbPosition: fkbNode,
        distanceMeters,
      }
    },
  )

  return {
    graph: createRoutingGraph([...nodes.values()], edges),
    edgeProvenance,
    conflationPoints,
    skippedExactDuplicateSegments,
  }
}

export function countValidationRouteEdgesBySource(
  edges: readonly RoutingEdge[],
  edgeProvenance: ReadonlyMap<string, FkbValidationEdgeProvenance>,
): FkbValidationRouteSourceCounts {
  const counts: FkbValidationRouteSourceCounts = {
    osm: { path: 0, track: 0, road: 0 },
    fkb: { path: 0, track: 0, road: 0 },
    virtual: 0,
  }

  for (const edge of edges) {
    if (edge.edgeType === 'virtual') {
      counts.virtual += 1
      continue
    }

    if (getFkbValidationEdgeProvenance(edge.id, edgeProvenance)) {
      counts.fkb[edge.edgeType] += 1
    } else {
      counts.osm[edge.edgeType] += 1
    }
  }

  return counts
}

export function getFkbValidationEdgeProvenance(
  edgeId: string,
  edgeProvenance: ReadonlyMap<string, FkbValidationEdgeProvenance>,
) {
  const sourceEdgeId = edgeId.replace(/:route-split:\d+(?::\d+)?$/, '')
  return edgeProvenance.get(sourceEdgeId)
}

function validateSourceObject(
  sourceObject: FkbSpikeSourceObject,
): SupportedFkbType {
  const typeVeg = sourceObject.typeVeg.toLowerCase()

  if (
    sourceObject.source !== 'fkb' ||
    sourceObject.objectType !== 'Veglenke' ||
    sourceObject.geometry.type !== 'LineString' ||
    sourceObject.geometry.coordinates.length < 2 ||
    (typeVeg !== 'sti' && typeVeg !== 'traktorveg')
  ) {
    throw new Error(`Unsupported FKB validation object: ${sourceObject.sourceId}`)
  }

  return typeVeg
}

function mapFkbTypeToEdgeType(typeVeg: SupportedFkbType): 'path' | 'track' {
  return typeVeg === 'sti' ? 'path' : 'track'
}

function createProvenance(
  sourceObject: FkbSpikeSourceObject,
  typeVeg: SupportedFkbType,
  kind: FkbValidationEdgeProvenance['kind'],
): FkbValidationEdgeProvenance {
  return {
    source: 'fkb',
    sourceId: sourceObject.sourceId,
    sourceIdIsStable: false,
    objectType: sourceObject.objectType,
    typeVeg,
    kind,
  }
}

function createEdge(
  id: string,
  fromNode: RoutingNode,
  toNode: RoutingNode,
  edgeType: 'path' | 'track',
): RoutingEdge {
  const distanceMeters = calculateGeographicDistanceMeters(fromNode, toNode)

  return {
    id,
    fromNodeId: fromNode.id,
    toNodeId: toNode.id,
    distanceMeters,
    edgeType,
    cost: distanceMeters,
  }
}

function toFkbNode(
  sourceId: string,
  coordinate: FkbCoordinate,
): RoutingNode {
  return {
    id: `fkb-validation-node:${sourceId}:${coordinateKey(coordinate)}`,
    longitude: coordinate[0],
    latitude: coordinate[1],
  }
}

function toPosition(coordinate: FkbCoordinate) {
  return { longitude: coordinate[0], latitude: coordinate[1] }
}

function collectPhysicalSegmentKeys(graph: RoutingGraph) {
  const keys = new Set<string>()

  for (const edge of graph.edges) {
    const fromNode = graph.nodes.get(edge.fromNodeId)
    const toNode = graph.nodes.get(edge.toNodeId)

    if (fromNode && toNode) {
      keys.add(createPhysicalSegmentKey(fromNode, toNode))
    }
  }

  return keys
}

function createPhysicalSegmentKey(first: RoutingNode, second: RoutingNode) {
  return [coordinateKey(toCoordinate(first)), coordinateKey(toCoordinate(second))]
    .sort()
    .join('|')
}

function toCoordinate(node: RoutingNode): FkbCoordinate {
  return [node.longitude, node.latitude]
}

function coordinateKey(coordinate: FkbCoordinate) {
  return `${coordinate[0].toFixed(POSITION_PRECISION)},${coordinate[1].toFixed(POSITION_PRECISION)}`
}
