import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  addFkbOrdinaryRoutingSupplement,
  type FkbOrdinaryRoutingSupplement,
} from '../../src/routing/fkbOrdinaryRoutingSupplement'
import {
  loadRoutingDataset,
  parseRoutingDataset,
} from '../../src/routing/routingDataset'
import { routeWaypoints } from '../../src/routing/routeWaypoints'
import { virtualConnectionConfig } from '../../src/routing/virtualConnectionConfig'
import {
  createGraphWithVirtualConnections,
  findWeaklyConnectedComponents,
} from '../../src/routing/virtualConnections'

const datasetPath = new URL(
  '../../public/data/routing/nerskogen.json',
  import.meta.url,
)
const supplementPath = new URL(
  '../../public/data/routing/nerskogen-fkb-corridor.json',
  import.meta.url,
)
const dataset = parseRoutingDataset(
  JSON.parse(readFileSync(datasetPath, 'utf8')),
)
const supplement = JSON.parse(
  readFileSync(supplementPath, 'utf8'),
) as FkbOrdinaryRoutingSupplement

const ornkjellhauganRoutePoints = [
  { latitude: 62.769041, longitude: 9.554678 },
  { latitude: 62.7706953, longitude: 9.5515531 },
] as const
const ornkjellhauganCandidateEdgeIds = new Set([
  '896319493:3:f',
  '303552729:1:f',
])

describe('secondary backbone consequences', () => {
  it('reduces ordinary fragmentation before virtual connections are generated', () => {
    const osmGraph = loadRoutingDataset(dataset)
    const osmComponents = findWeaklyConnectedComponents(osmGraph)
    const ordinaryGraph = addFkbOrdinaryRoutingSupplement(osmGraph, supplement)
    const ordinaryComponents = findWeaklyConnectedComponents(ordinaryGraph)
    const virtualResult = createGraphWithVirtualConnections(
      ordinaryGraph,
      virtualConnectionConfig,
    )

    expect(osmComponents.componentIds).toHaveLength(16)
    expect(ordinaryComponents.componentIds).toHaveLength(16)
    expect(virtualResult.candidates).toHaveLength(14)
    expect(virtualResult.componentCountBefore).toBe(16)
    expect(virtualResult.componentCountAfter).toBe(3)
    expect(virtualResult.connectableComponentCount).toBe(15)
  })

  it('keeps the established FKB corridor ordinary and free of virtual edges', () => {
    const osmGraph = loadRoutingDataset(dataset)
    const ordinaryGraph = addFkbOrdinaryRoutingSupplement(osmGraph, supplement)
    const result = routeWaypoints(
      [
        { latitude: 62.79126, longitude: 9.59762 },
        { latitude: 62.79442, longitude: 9.61702 },
      ],
      ordinaryGraph,
      dataset.metadata.bounds,
      100,
    )

    expect(result.status).toBe('routed')
    if (result.status !== 'routed') {
      throw new Error('Expected the FKB corridor case to be routed')
    }

    expect(result.route.totalDistanceMeters).toBeCloseTo(1476.024, 3)
    expect(result.route.virtualEdgeCount).toBe(0)
    expect(
      result.route.edges.some(({ id }) => id.startsWith('fkb:')),
    ).toBe(true)
  })

  it('documents the unresolved Ørnkjellhaugan component-gap regression', () => {
    const osmGraph = loadRoutingDataset(dataset)
    const ordinaryGraph = addFkbOrdinaryRoutingSupplement(osmGraph, supplement)
    const virtualResult = createGraphWithVirtualConnections(
      ordinaryGraph,
      virtualConnectionConfig,
    )
    const originalCandidate = virtualResult.candidates.find(({ from, to }) => {
      const edgeIds = new Set([from.edgeId, to.edgeId])

      return [...ornkjellhauganCandidateEdgeIds].every((edgeId) =>
        edgeIds.has(edgeId),
      )
    })
    const result = routeWaypoints(
      ornkjellhauganRoutePoints,
      virtualResult.graph,
      dataset.metadata.bounds,
      100,
      virtualResult.snapGraph,
    )

    expect(originalCandidate).toBeUndefined()
    expect(result.status).toBe('routed')
    if (result.status !== 'routed') {
      throw new Error('Expected Ørnkjellhaugan to remain routable')
    }

    expect(result.route.virtualEdgeCount).toBe(1)
    expect(result.route.virtualDistanceMeters).toBeCloseTo(72.873, 3)
    expect(result.route.totalDistanceMeters).toBeGreaterThan(2_000)
  })

  it.todo(
    'restores the local 126.3 m Ørnkjellhaugan component-gap candidate without reintroducing obsolete component-gap noise',
  )
})
