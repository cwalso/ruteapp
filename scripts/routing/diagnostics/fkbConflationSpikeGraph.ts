import { findNearestRoutingEdgePoint } from '../../../src/routing/nearestRoutingEdgePoint.ts'
import { createRoutingGraph } from '../../../src/routing/routingGraph.ts'
import type {
  EdgeType,
  RoutingEdge,
  RoutingGraph,
  RoutingNode,
} from '../../../src/routing/routingTypes.ts'
import { calculateGeographicDistanceMeters } from '../../../src/utils/geographicDistance.ts'

export type FkbCoordinate = readonly [longitude: number, latitude: number]

export type FkbSpikeSourceObject = {
  source: 'fkb'
  sourceId: string
  sourceIdIsStable: false
  objectType: string
  typeVeg: string
  geometry: {
    type: 'LineString'
    coordinates: readonly FkbCoordinate[]
  }
}

export type SpikeEdgeProvenance = {
  source: 'fkb'
  sourceId: string
  sourceIdIsStable: false
  objectType: string
  typeVeg: string
  kind: 'source' | 'conflation'
}

export type FkbConflationPoint = {
  sourceId: string
  osmNodeId: string
  osmPosition: RoutingNode
  fkbPosition: RoutingNode
  distanceMeters: number
}

export type ImportedFkbObject = FkbSpikeSourceObject & {
  importedGeometry: {
    type: 'LineString'
    coordinates: readonly FkbCoordinate[]
  }
}

export type FkbConflationSpikeResult = {
  graph: RoutingGraph
  edgeProvenance: ReadonlyMap<string, SpikeEdgeProvenance>
  importedObjects: readonly ImportedFkbObject[]
  conflationPoints: readonly FkbConflationPoint[]
  skippedExactDuplicateSegments: number
}

export type RouteSourceCounts = {
  osm: Record<Exclude<EdgeType, 'virtual'>, number>
  fkb: { path: number }
  virtual: number
}

const CONNECTIONS = [
  {
    sourceId: 'traktorveg_sti.1524706',
    osmNodeId: '8332065102',
  },
  {
    sourceId: 'traktorveg_sti.1524755',
    osmNodeId: '13276455322',
  },
] as const

const POSITION_TOLERANCE = 1e-12

export function buildFkbConflationSpikeGraph(
  osmGraph: RoutingGraph,
  sourceObjects: readonly FkbSpikeSourceObject[],
  conflationToleranceMeters: number,
): FkbConflationSpikeResult {
  if (!(conflationToleranceMeters > 0)) {
    throw new Error('Conflation tolerance must be greater than zero')
  }

  const sourceObjectsById = new Map(
    sourceObjects.map((sourceObject) => [sourceObject.sourceId, sourceObject]),
  )
  const importedObjects: ImportedFkbObject[] = []
  const conflationMatches: Array<{
    sourceObject: FkbSpikeSourceObject
    osmNode: RoutingNode
    importedCoordinates: readonly FkbCoordinate[]
  }> = []

  for (const connection of CONNECTIONS) {
    const sourceObject = sourceObjectsById.get(connection.sourceId)
    const osmNode = osmGraph.nodes.get(connection.osmNodeId)

    if (!sourceObject) {
      throw new Error(`Missing FKB spike object: ${connection.sourceId}`)
    }

    if (!osmNode) {
      throw new Error(`Missing OSM conflation node: ${connection.osmNodeId}`)
    }

    validateSourceObject(sourceObject)
    const importedCoordinates = clipGeometryAtOsmConnection(
      sourceObject,
      osmNode,
      conflationToleranceMeters,
    )

    importedObjects.push({
      ...sourceObject,
      importedGeometry: {
        type: 'LineString',
        coordinates: importedCoordinates,
      },
    })
    conflationMatches.push({ sourceObject, osmNode, importedCoordinates })
  }

  validateSharedFkbEndpoint(importedObjects)

  const nodes = new Map(osmGraph.nodes)
  const edges = [...osmGraph.edges]
  const edgeProvenance = new Map<string, SpikeEdgeProvenance>()
  const existingPhysicalSegments = collectPhysicalSegmentKeys(osmGraph)
  const addedPhysicalSegments = new Set<string>()
  let skippedExactDuplicateSegments = 0

  for (const importedObject of importedObjects) {
    const coordinates = importedObject.importedGeometry.coordinates

    for (const coordinate of coordinates) {
      const node = toFkbNode(coordinate)
      nodes.set(node.id, node)
    }

    for (let index = 1; index < coordinates.length; index += 1) {
      const fromNode = toFkbNode(coordinates[index - 1])
      const toNode = toFkbNode(coordinates[index])
      const physicalSegmentKey = createPhysicalSegmentKey(fromNode, toNode)

      if (
        existingPhysicalSegments.has(physicalSegmentKey) ||
        addedPhysicalSegments.has(physicalSegmentKey)
      ) {
        skippedExactDuplicateSegments += 1
        continue
      }

      addedPhysicalSegments.add(physicalSegmentKey)
      const baseId = `fkb:${importedObject.sourceId}:${index}`
      const forwardEdge = createPathEdge(`${baseId}:f`, fromNode, toNode)
      const reverseEdge = createPathEdge(`${baseId}:r`, toNode, fromNode)
      edges.push(forwardEdge, reverseEdge)

      const provenance: SpikeEdgeProvenance = {
        source: 'fkb',
        sourceId: importedObject.sourceId,
        sourceIdIsStable: false,
        objectType: importedObject.objectType,
        typeVeg: importedObject.typeVeg,
        kind: 'source',
      }
      edgeProvenance.set(forwardEdge.id, provenance)
      edgeProvenance.set(reverseEdge.id, provenance)
    }
  }

  const conflationPoints: FkbConflationPoint[] = []

  for (const match of conflationMatches) {
    const fkbNode = toFkbNode(match.importedCoordinates.at(-1)!)
    const distanceMeters = calculateGeographicDistanceMeters(
      match.osmNode,
      fkbNode,
    )

    if (distanceMeters > conflationToleranceMeters) {
      throw new Error(
        `FKB object ${match.sourceObject.sourceId} is ${distanceMeters.toFixed(3)} m from OSM node ${match.osmNode.id}`,
      )
    }

    const baseId = `fkb-conflation:${match.sourceObject.sourceId}`
    const toFkbEdge = createPathEdge(
      `${baseId}:to-fkb`,
      match.osmNode,
      fkbNode,
    )
    const toOsmEdge = createPathEdge(
      `${baseId}:to-osm`,
      fkbNode,
      match.osmNode,
    )
    edges.push(toFkbEdge, toOsmEdge)

    const provenance: SpikeEdgeProvenance = {
      source: 'fkb',
      sourceId: match.sourceObject.sourceId,
      sourceIdIsStable: false,
      objectType: match.sourceObject.objectType,
      typeVeg: match.sourceObject.typeVeg,
      kind: 'conflation',
    }
    edgeProvenance.set(toFkbEdge.id, provenance)
    edgeProvenance.set(toOsmEdge.id, provenance)
    conflationPoints.push({
      sourceId: match.sourceObject.sourceId,
      osmNodeId: match.osmNode.id,
      osmPosition: match.osmNode,
      fkbPosition: fkbNode,
      distanceMeters,
    })
  }

  return {
    graph: createRoutingGraph([...nodes.values()], edges),
    edgeProvenance,
    importedObjects,
    conflationPoints,
    skippedExactDuplicateSegments,
  }
}

export function countRouteEdgesBySource(
  edges: readonly RoutingEdge[],
  edgeProvenance: ReadonlyMap<string, SpikeEdgeProvenance>,
): RouteSourceCounts {
  const counts: RouteSourceCounts = {
    osm: { path: 0, track: 0, road: 0 },
    fkb: { path: 0 },
    virtual: 0,
  }

  for (const edge of edges) {
    if (edge.edgeType === 'virtual') {
      counts.virtual += 1
      continue
    }

    if (getSpikeEdgeProvenance(edge.id, edgeProvenance)) {
      counts.fkb.path += 1
    } else {
      counts.osm[edge.edgeType] += 1
    }
  }

  return counts
}

export function getSpikeEdgeProvenance(
  edgeId: string,
  edgeProvenance: ReadonlyMap<string, SpikeEdgeProvenance>,
) {
  const sourceEdgeId = edgeId.replace(/:route-split:\d+(?::\d+)?$/, '')
  return edgeProvenance.get(sourceEdgeId)
}

function clipGeometryAtOsmConnection(
  sourceObject: FkbSpikeSourceObject,
  osmNode: RoutingNode,
  conflationToleranceMeters: number,
) {
  const coordinates = sourceObject.geometry.coordinates
  const temporaryNodes = coordinates.map((coordinate, index) => ({
    id: `match-node:${index}`,
    longitude: coordinate[0],
    latitude: coordinate[1],
  }))
  const temporaryEdges = temporaryNodes.slice(1).map((toNode, index) =>
    createPathEdge(`match-edge:${index}`, temporaryNodes[index], toNode),
  )
  const temporaryGraph = createRoutingGraph(temporaryNodes, temporaryEdges)
  const nearestPoint = findNearestRoutingEdgePoint(
    temporaryGraph,
    osmNode,
    conflationToleranceMeters,
  )

  if (!nearestPoint) {
    throw new Error(
      `FKB object ${sourceObject.sourceId} has no OSM connection within ${conflationToleranceMeters} m`,
    )
  }

  const segmentIndex = Number(nearestPoint.edge.id.split(':').at(-1))
  const position = nearestPoint.positionAlongEdge

  if (position <= POSITION_TOLERANCE) {
    return coordinates.slice(0, segmentIndex + 1)
  }

  if (position >= 1 - POSITION_TOLERANCE) {
    return coordinates.slice(0, segmentIndex + 2)
  }

  return [
    ...coordinates.slice(0, segmentIndex + 1),
    [
      nearestPoint.snappedPosition.longitude,
      nearestPoint.snappedPosition.latitude,
    ] as const,
  ]
}

function validateSourceObject(sourceObject: FkbSpikeSourceObject) {
  if (
    sourceObject.source !== 'fkb' ||
    sourceObject.objectType !== 'Veglenke' ||
    sourceObject.typeVeg.toLowerCase() !== 'sti' ||
    sourceObject.geometry.type !== 'LineString' ||
    sourceObject.geometry.coordinates.length < 2
  ) {
    throw new Error(`Unsupported FKB spike object: ${sourceObject.sourceId}`)
  }
}

function validateSharedFkbEndpoint(
  importedObjects: readonly ImportedFkbObject[],
) {
  const [firstObject, ...remainingObjects] = importedObjects
  const sharedCoordinate = firstObject?.importedGeometry.coordinates[0]

  if (
    !sharedCoordinate ||
    remainingObjects.some(
      (sourceObject) =>
        coordinateKey(sourceObject.importedGeometry.coordinates[0]) !==
        coordinateKey(sharedCoordinate),
    )
  ) {
    throw new Error('Selected FKB objects do not share the expected endpoint')
  }
}

function createPathEdge(
  id: string,
  fromNode: RoutingNode,
  toNode: RoutingNode,
): RoutingEdge {
  const distanceMeters = calculateGeographicDistanceMeters(fromNode, toNode)

  return {
    id,
    fromNodeId: fromNode.id,
    toNodeId: toNode.id,
    distanceMeters,
    edgeType: 'path',
    cost: distanceMeters,
  }
}

function toFkbNode(coordinate: FkbCoordinate): RoutingNode {
  return {
    id: `fkb-node:${coordinateKey(coordinate)}`,
    longitude: coordinate[0],
    latitude: coordinate[1],
  }
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

function createPhysicalSegmentKey(
  first: RoutingNode,
  second: RoutingNode,
) {
  return [coordinateKey(toCoordinate(first)), coordinateKey(toCoordinate(second))]
    .sort()
    .join('|')
}

function toCoordinate(node: RoutingNode): FkbCoordinate {
  return [node.longitude, node.latitude]
}

function coordinateKey(coordinate: FkbCoordinate) {
  return `${coordinate[0].toFixed(12)},${coordinate[1].toFixed(12)}`
}
