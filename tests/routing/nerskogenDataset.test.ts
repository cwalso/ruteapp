import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import { findRoute } from '../../src/routing/aStar'
import { findNearestRoutingEdgePoint } from '../../src/routing/nearestRoutingEdgePoint'
import {
  createRoutableMapSegments,
  createRoutableNetworkGeoJson,
} from '../../src/map/routableNetworkData'
import {
  loadRoutingDataset,
  parseRoutingDataset,
  type RuteAppRoutingDataset,
} from '../../src/routing/routingDataset'
import { routeWaypoints } from '../../src/routing/routeWaypoints'
import type { RoutingGraph } from '../../src/routing/routingTypes'
import { virtualConnectionConfig } from '../../src/routing/virtualConnectionConfig'
import { createGraphWithVirtualConnections } from '../../src/routing/virtualConnections'
import { calculateGeographicDistanceMeters } from '../../src/utils/geographicDistance'

const datasetPath = new URL(
  '../../public/data/routing/nerskogen.json',
  import.meta.url,
)
const dataset: RuteAppRoutingDataset = parseRoutingDataset(
  JSON.parse(readFileSync(datasetPath, 'utf8')),
)
const graph = loadRoutingDataset(dataset)
const westernCoveragePoint = {
  latitude: 62.8028,
  longitude: 9.52499,
}
const ornkjellhauganGoldenRoute = {
  startNodeId: '8332025315',
  targetNodeId: '3079323663',
}
let virtualConnectionResult: ReturnType<
  typeof createGraphWithVirtualConnections
> | undefined

describe('Nerskogen OSM routing dataset', () => {
  it('loads valid routing nodes and non-virtual edges', () => {
    expect(dataset.metadata.area).toBe('Nerskogen')
    expect(dataset.metadata.source).toBe('© OpenStreetMap contributors')
    expect(graph.nodes.size).toBeGreaterThan(0)
    expect(graph.edges.length).toBeGreaterThan(0)

    for (const edge of graph.edges) {
      const fromNode = graph.nodes.get(edge.fromNodeId)
      const toNode = graph.nodes.get(edge.toNodeId)

      if (!fromNode || !toNode) {
        throw new Error(`Generated edge references an unknown node: ${edge.id}`)
      }

      expect(edge.edgeType).not.toBe('virtual')
      expect(edge.cost).toBeGreaterThanOrEqual(edge.distanceMeters)
      expect(edge.distanceMeters + 1e-9).toBeGreaterThanOrEqual(
        calculateGeographicDistanceMeters(fromNode, toNode),
      )
    }
  })

  it('builds a deduplicated routable map network from the same dataset', () => {
    const startedAt = performance.now()
    const segments = createRoutableMapSegments(graph)
    const data = createRoutableNetworkGeoJson(segments)
    const durationMilliseconds = performance.now() - startedAt
    const geoJsonBytes = new TextEncoder().encode(JSON.stringify(data)).length

    expect(segments.length).toBeLessThan(graph.edges.length)
    expect(data.features).toHaveLength(segments.length)
    expect(segments.every(({ edgeType }) => edgeType !== 'virtual')).toBe(true)

    console.info(
      `Routing-aware kartnett: ${graph.edges.length} directed edges -> ` +
        `${segments.length} fysiske segmenter, ` +
        `${(geoJsonBytes / 1_000_000).toFixed(2)} MB GeoJSON, ` +
        `${durationMilliseconds.toFixed(1)} ms transformasjon`,
    )
  })

  it('includes Fv. 6516 secondary as ordinary road backbone', () => {
    const fv6516Edges = graph.edges.filter(({ id }) =>
      id.startsWith('5051607:'),
    )

    expect(fv6516Edges.length).toBeGreaterThan(0)
    expect(fv6516Edges.every(({ edgeType }) => edgeType === 'road')).toBe(true)
  })

  it('routes across multiple edges in the generated OSM graph', () => {
    const [startNodeId, targetNodeId] = findMultiEdgePair(graph, 5, 500)
    const startNode = graph.nodes.get(startNodeId)
    const targetNode = graph.nodes.get(targetNodeId)

    if (!startNode || !targetNode) {
      throw new Error('Verification pair references an unknown node')
    }

    const snapStartedAt = performance.now()
    const snappedStart = findNearestRoutingEdgePoint(graph, startNode, 100)
    const snappedTarget = findNearestRoutingEdgePoint(graph, targetNode, 100)
    const snapDurationMilliseconds = performance.now() - snapStartedAt
    const routingStartedAt = performance.now()
    const result = findRoute(graph, startNodeId, targetNodeId)
    const routingDurationMilliseconds = performance.now() - routingStartedAt
    const routeStartPosition = getInteriorEdgePosition(graph, startNodeId, true)
    const routeTargetPosition = getInteriorEdgePosition(
      graph,
      targetNodeId,
      false,
    )
    const waypointRoutingStartedAt = performance.now()
    const waypointResult = routeWaypoints(
      [routeStartPosition, routeTargetPosition],
      graph,
      dataset.metadata.bounds,
      100,
    )
    const waypointRoutingDurationMilliseconds =
      performance.now() - waypointRoutingStartedAt

    expect(snappedStart?.distanceMeters).toBeCloseTo(0)
    expect(snappedTarget?.distanceMeters).toBeCloseTo(0)
    expect(result).not.toBeNull()
    expect(result?.edges.length).toBeGreaterThan(1)
    expect(result?.totalDistanceMeters).toBeGreaterThan(0)
    expect(result?.totalCost).toBeGreaterThan(0)
    expect(result?.nodeIds[0]).toBe(startNodeId)
    expect(result?.nodeIds.at(-1)).toBe(targetNodeId)
    expect(waypointResult.status).toBe('routed')

    result?.edges.forEach((edge, index) => {
      expect(edge.fromNodeId).toBe(result.nodeIds[index])
      expect(edge.toNodeId).toBe(result.nodeIds[index + 1])
    })

    console.info(
      `Verifisert OSM-rute ${startNodeId} -> ${targetNodeId}: ` +
        `${result?.edges.length} edges, ${result?.totalDistanceMeters.toFixed(1)} m, ` +
        `to lineære edge-snap ${snapDurationMilliseconds.toFixed(1)} ms, ` +
        `A* ${routingDurationMilliseconds.toFixed(1)} ms, ` +
        `edge-snap + avledet graf + routing ${waypointRoutingDurationMilliseconds.toFixed(1)} ms`,
    )
  })

  it('covers and snaps the western manual test point beyond the old bbox', () => {
    expect(dataset.metadata.bounds).toEqual({
      south: 62.735,
      west: 9.5,
      north: 62.825,
      east: 9.69,
    })
    const snap = findNearestRoutingEdgePoint(
      graph,
      westernCoveragePoint,
      100,
    )

    expect(snap).toBeDefined()
    expect(snap?.distanceMeters).toBeLessThanOrEqual(100)

    console.info(
      `Vestlig testpunkt snapper til ${snap?.edge.id} (${snap?.edge.edgeType}) ` +
        `${snap?.distanceMeters.toFixed(1)} m unna`,
    )
  })

  it('keeps Ørnkjellhaugan as a golden route with one explicit virtual connection', () => {
    virtualConnectionResult ??= createGraphWithVirtualConnections(
      graph,
      virtualConnectionConfig,
    )
    const startNode = graph.nodes.get(ornkjellhauganGoldenRoute.startNodeId)
    const targetNode = graph.nodes.get(ornkjellhauganGoldenRoute.targetNodeId)

    expect(startNode).toBeDefined()
    expect(targetNode).toBeDefined()

    const result = routeWaypoints(
      [startNode!, targetNode!],
      virtualConnectionResult.graph,
      dataset.metadata.bounds,
      100,
      virtualConnectionResult.snapGraph,
    )

    expect(result.status).toBe('routed')
    if (result.status !== 'routed') {
      throw new Error('Expected Ørnkjellhaugan golden route to be routed')
    }

    const virtualEdgeIndexes = result.route.edges.flatMap((edge, index) =>
      edge.edgeType === 'virtual' ? [index] : [],
    )
    const firstVirtualEdgeIndex = virtualEdgeIndexes[0]
    const lastVirtualEdgeIndex = virtualEdgeIndexes.at(-1)!

    expect(virtualEdgeIndexes).toHaveLength(1)
    expect(result.route.virtualEdgeCount).toBe(1)
    expect(result.route.virtualDistanceMeters).toBeGreaterThan(0)
    expect(result.route.virtualDistanceMeters).toBeLessThanOrEqual(
      virtualConnectionConfig.maxVirtualDistanceMeters,
    )
    expect(
      result.route.edges
        .slice(0, firstVirtualEdgeIndex)
        .some(({ edgeType }) => edgeType !== 'virtual'),
    ).toBe(true)
    expect(
      result.route.edges
        .slice(lastVirtualEdgeIndex + 1)
        .some(({ edgeType }) => edgeType !== 'virtual'),
    ).toBe(true)
    console.info(
      `Ørnkjellhaugan golden route: ${result.route.totalDistanceMeters.toFixed(1)} m, ` +
        `${result.route.virtualEdgeCount} virtual edge, ` +
        `${result.route.virtualDistanceMeters.toFixed(1)} m virtual distanse`,
    )
  })

  it('uses the secondary road backbone to shorten the local ordinary route south of Ørnkjellhaugen', () => {
    const result = routeWaypoints(
      [
        { latitude: 62.76968, longitude: 9.55381 },
        { latitude: 62.76532, longitude: 9.55131 },
      ],
      graph,
      dataset.metadata.bounds,
      100,
    )

    expect(result.status).toBe('routed')

    if (result.status === 'routed') {
      expect(result.snappedPoints).toHaveLength(2)
      expect(result.snappedPoints[0]).toMatchObject({
        edgeId: '896319493:3:f',
        edgeType: 'road',
        fromNodeId: '8332025315',
        toNodeId: '8332065094',
      })
      expect(result.snappedPoints[0].distanceMeters).toBeCloseTo(
        54.025964,
        5,
      )
      expect(result.snappedPoints[1]).toMatchObject({
        edgeId: '1446990767:29:f',
        edgeType: 'path',
        fromNodeId: '13276455433',
        toNodeId: '13276455432',
      })
      expect(result.snappedPoints[1].distanceMeters).toBeCloseTo(
        18.48476,
        5,
      )
      expect(result.route.totalDistanceMeters).toBeCloseTo(2911.676922, 5)
      expect(result.route.edges).toHaveLength(235)
      expect(result.diagnostics.edgeTypeCounts).toEqual({
        path: 45,
        track: 0,
        road: 190,
        virtual: 0,
      })
    }
  })

  it('documents the missing local connection in the generated dataset', () => {
    const serviceEndpoint = graph.nodes.get('8332065102')
    const pathEndpoint = graph.nodes.get('13276455322')

    expect(serviceEndpoint).toBeDefined()
    expect(pathEndpoint).toBeDefined()
    expect(
      calculateGeographicDistanceMeters(serviceEndpoint!, pathEndpoint!),
    ).toBeCloseTo(85.375964, 5)
    expect(
      graph.edges.some(
        ({ fromNodeId, toNodeId }) =>
          (fromNodeId === serviceEndpoint!.id &&
            toNodeId === pathEndpoint!.id) ||
          (fromNodeId === pathEndpoint!.id &&
            toNodeId === serviceEndpoint!.id),
      ),
    ).toBe(false)
  })

  it('does not reinterpret the known FKB path gap as a virtual connection', () => {
    virtualConnectionResult ??= createGraphWithVirtualConnections(
      graph,
      virtualConnectionConfig,
    )
    const knownGapNodeIds = new Set(['8332065102', '13276455322'])

    expect(
      virtualConnectionResult.candidates.some(
        ({ from, to }) =>
          knownGapNodeIds.has(from.nodeId) && knownGapNodeIds.has(to.nodeId),
      ),
    ).toBe(false)
  })
})

function getInteriorEdgePosition(
  routingGraph: RoutingGraph,
  nodeId: string,
  useOutgoingEdge: boolean,
) {
  const edge = useOutgoingEdge
    ? routingGraph.outgoingEdges.get(nodeId)?.[0]
    : routingGraph.edges.find(({ toNodeId }) => toNodeId === nodeId)

  if (!edge) {
    throw new Error(`Verification node has no suitable edge: ${nodeId}`)
  }

  const fromNode = routingGraph.nodes.get(edge.fromNodeId)
  const toNode = routingGraph.nodes.get(edge.toNodeId)

  if (!fromNode || !toNode) {
    throw new Error(`Verification edge references an unknown node: ${edge.id}`)
  }

  return {
    longitude: (fromNode.longitude + toNode.longitude) / 2,
    latitude: (fromNode.latitude + toNode.latitude) / 2,
  }
}

function findMultiEdgePair(
  routingGraph: RoutingGraph,
  minimumHopCount: number,
  minimumStraightLineDistanceMeters: number,
): [string, string] {
  const sortedNodeIds = [...routingGraph.nodes.keys()].sort()

  for (const startNodeId of sortedNodeIds) {
    const hopCounts = new Map([[startNodeId, 0]])
    const pendingNodeIds = [startNodeId]

    for (let queueIndex = 0; queueIndex < pendingNodeIds.length; queueIndex += 1) {
      const currentNodeId = pendingNodeIds[queueIndex]
      const currentHopCount = hopCounts.get(currentNodeId) ?? 0

      for (const edge of routingGraph.outgoingEdges.get(currentNodeId) ?? []) {
        if (hopCounts.has(edge.toNodeId)) {
          continue
        }

        const nextHopCount = currentHopCount + 1
        hopCounts.set(edge.toNodeId, nextHopCount)

        const startNode = routingGraph.nodes.get(startNodeId)
        const targetNode = routingGraph.nodes.get(edge.toNodeId)

        if (
          startNode &&
          targetNode &&
          nextHopCount >= minimumHopCount &&
          calculateGeographicDistanceMeters(startNode, targetNode) >=
            minimumStraightLineDistanceMeters
        ) {
          return [startNodeId, edge.toNodeId]
        }

        pendingNodeIds.push(edge.toNodeId)
      }
    }
  }

  throw new Error('Generated dataset has no connected multi-edge route')
}
