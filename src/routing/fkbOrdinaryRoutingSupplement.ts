import { findNearestRoutingEdgePoint } from './nearestRoutingEdgePoint'
import { createRoutingGraph } from './routingGraph'
import {
  createRoutingGraphWithEdgeSnaps,
  type IndexedRoutingEdgeSnap,
} from './routingSnapGraph'
import type {
  EdgeType,
  RoutingEdge,
  RoutingGraph,
  RoutingNode,
} from './routingTypes'
import { calculateGeographicDistanceMeters } from '../utils/geographicDistance'

export type FkbOrdinaryRoutingFeature = {
  sourceId: string
  typeVeg: 'sti' | 'traktorveg'
  geometry: {
    type: 'LineString'
    coordinates: readonly (readonly [number, number])[]
  }
}

export type FkbOrdinaryRoutingSupplement = {
  source: string
  capturedAt: string
  purpose: string
  features: readonly FkbOrdinaryRoutingFeature[]
}

type ConflationDefinition = {
  pointIndex: number
  coordinate: readonly [longitude: number, latitude: number]
  edgeType: Exclude<EdgeType, 'virtual'>
  physicalNodeIds: readonly [string, string]
}

const conflationToleranceMeters = 1

const CONFLATIONS: readonly ConflationDefinition[] = [
  {
    pointIndex: 0,
    coordinate: [9.606142802645653, 62.79114155543388],
    edgeType: 'road',
    physicalNodeIds: ['13793243381', '13793243380'],
  },
  {
    pointIndex: 1,
    coordinate: [9.615342513805501, 62.79500171550888],
    edgeType: 'path',
    physicalNodeIds: ['3194355266', '3194355267'],
  },
  {
    pointIndex: 2,
    coordinate: [9.60367195, 62.790589032],
    edgeType: 'road',
    physicalNodeIds: ['6925364879', '6925364880'],
  },
  {
    pointIndex: 3,
    coordinate: [9.594461254, 62.796360783],
    edgeType: 'road',
    physicalNodeIds: ['6925388482', '6925388483'],
  },
  {
    pointIndex: 4,
    coordinate: [9.62013958, 62.794450429],
    edgeType: 'road',
    physicalNodeIds: ['3194355263', '6925389286'],
  },
  {
    pointIndex: 5,
    coordinate: [9.595635215, 62.795109177],
    edgeType: 'road',
    physicalNodeIds: ['6925388907', '6925388908'],
  },
  {
    pointIndex: 6,
    coordinate: [9.595529395, 62.793135242],
    edgeType: 'road',
    physicalNodeIds: ['6925364924', '6925364925'],
  },
  {
    pointIndex: 7,
    coordinate: [9.608456515, 62.796564644],
    edgeType: 'path',
    physicalNodeIds: ['3194355286', '3194355285'],
  },
  {
    pointIndex: 8,
    coordinate: [9.611204011, 62.795893551],
    edgeType: 'path',
    physicalNodeIds: ['3194355275', '3194355272'],
  },
  {
    pointIndex: 9,
    coordinate: [9.6072286, 62.796976554],
    edgeType: 'path',
    physicalNodeIds: ['3194355296', '3194355290'],
  },
]

export function addFkbOrdinaryRoutingSupplement(
  graph: RoutingGraph,
  supplement: FkbOrdinaryRoutingSupplement,
) {
  validateSupplement(supplement)

  const indexedSnaps: IndexedRoutingEdgeSnap[] = CONFLATIONS.map(
    (definition) => ({
      pointIndex: definition.pointIndex,
      snap: findConflationSnap(graph, definition),
    }),
  )
  const splitResult = createRoutingGraphWithEdgeSnaps(graph, indexedSnaps)
  const nodes = new Map(splitResult.graph.nodes)
  const edges: RoutingEdge[] = [...splitResult.graph.edges]

  for (const feature of supplement.features) {
    const edgeType: Exclude<EdgeType, 'virtual'> =
      feature.typeVeg === 'sti' ? 'path' : 'track'

    for (const coordinate of feature.geometry.coordinates) {
      const node = createFkbNode(coordinate)
      nodes.set(node.id, node)
    }

    for (
      let coordinateIndex = 1;
      coordinateIndex < feature.geometry.coordinates.length;
      coordinateIndex += 1
    ) {
      const fromNode = createFkbNode(
        feature.geometry.coordinates[coordinateIndex - 1],
      )
      const toNode = createFkbNode(feature.geometry.coordinates[coordinateIndex])
      const distanceMeters = calculateGeographicDistanceMeters(
        fromNode,
        toNode,
      )
      const edgeBaseId = `fkb:${feature.sourceId}:${coordinateIndex}`

      edges.push(
        {
          id: `${edgeBaseId}:f`,
          fromNodeId: fromNode.id,
          toNodeId: toNode.id,
          distanceMeters,
          edgeType,
          cost: distanceMeters,
        },
        {
          id: `${edgeBaseId}:r`,
          fromNodeId: toNode.id,
          toNodeId: fromNode.id,
          distanceMeters,
          edgeType,
          cost: distanceMeters,
        },
      )
    }
  }

  for (const definition of CONFLATIONS) {
    const resolved = splitResult.resolvedSnaps.find(
      ({ pointIndex }) => pointIndex === definition.pointIndex,
    )

    if (!resolved) {
      throw new Error(
        `Could not resolve FKB conflation point ${definition.pointIndex}`,
      )
    }

    const fkbNode = createFkbNode(definition.coordinate)
    const distanceMeters = calculateGeographicDistanceMeters(
      resolved.node,
      fkbNode,
    )
    const edgeBaseId = `fkb-conflation:${definition.pointIndex}`

    edges.push(
      {
        id: `${edgeBaseId}:to-fkb`,
        fromNodeId: resolved.node.id,
        toNodeId: fkbNode.id,
        distanceMeters,
        edgeType: 'path',
        cost: distanceMeters,
      },
      {
        id: `${edgeBaseId}:to-osm`,
        fromNodeId: fkbNode.id,
        toNodeId: resolved.node.id,
        distanceMeters,
        edgeType: 'path',
        cost: distanceMeters,
      },
    )
  }

  return createRoutingGraph([...nodes.values()], edges)
}

function findConflationSnap(
  graph: RoutingGraph,
  definition: ConflationDefinition,
) {
  const expectedNodeIds = new Set(definition.physicalNodeIds)
  const matchingEdges = graph.edges.filter(
    (edge) =>
      edge.edgeType === definition.edgeType &&
      expectedNodeIds.has(edge.fromNodeId) &&
      expectedNodeIds.has(edge.toNodeId),
  )
  const matchingNodeIds = new Set(
    matchingEdges.flatMap(({ fromNodeId, toNodeId }) => [
      fromNodeId,
      toNodeId,
    ]),
  )

  if (matchingEdges.length === 0 || matchingNodeIds.size !== 2) {
    throw new Error(
      `Could not find expected OSM edge for FKB conflation point ${definition.pointIndex}`,
    )
  }

  const edgeGraph = createRoutingGraph(
    [...matchingNodeIds].map((nodeId) => {
      const node = graph.nodes.get(nodeId)

      if (!node) {
        throw new Error(`Missing OSM conflation node: ${nodeId}`)
      }

      return node
    }),
    matchingEdges,
  )
  const snap = findNearestRoutingEdgePoint(
    edgeGraph,
    toPosition(definition.coordinate),
    conflationToleranceMeters,
  )

  if (!snap) {
    throw new Error(
      `FKB conflation point ${definition.pointIndex} is outside the verified tolerance`,
    )
  }

  return snap
}

function createFkbNode(
  coordinate: readonly [longitude: number, latitude: number],
): RoutingNode {
  return {
    id: `fkb-node:${coordinateKey(coordinate)}`,
    longitude: coordinate[0],
    latitude: coordinate[1],
  }
}

function coordinateKey(
  coordinate: readonly [longitude: number, latitude: number],
) {
  return `${coordinate[0].toFixed(12)},${coordinate[1].toFixed(12)}`
}

function toPosition(
  coordinate: readonly [longitude: number, latitude: number],
) {
  return {
    longitude: coordinate[0],
    latitude: coordinate[1],
  }
}

function validateSupplement(supplement: FkbOrdinaryRoutingSupplement) {
  if (supplement.features.length === 0) {
    throw new Error('FKB ordinary routing supplement cannot be empty')
  }

  for (const feature of supplement.features) {
    if (
      !['sti', 'traktorveg'].includes(feature.typeVeg) ||
      feature.geometry.type !== 'LineString' ||
      feature.geometry.coordinates.length < 2
    ) {
      throw new Error(`Unsupported FKB routing feature: ${feature.sourceId}`)
    }
  }
}
