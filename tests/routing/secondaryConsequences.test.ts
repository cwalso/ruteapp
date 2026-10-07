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

describe('secondary backbone consequence diagnostics', () => {
  it('reports ordinary and virtual topology after the secondary policy change', () => {
    const osmGraph = loadRoutingDataset(dataset)
    const osmComponents = findWeaklyConnectedComponents(osmGraph)
    const ordinaryGraph = addFkbOrdinaryRoutingSupplement(osmGraph, supplement)
    const ordinaryComponents = findWeaklyConnectedComponents(ordinaryGraph)
    const virtualResult = createGraphWithVirtualConnections(
      ordinaryGraph,
      virtualConnectionConfig,
    )

    console.info('SECONDARY_CONSEQUENCES', JSON.stringify({
      osmNodes: osmGraph.nodes.size,
      osmEdges: osmGraph.edges.length,
      osmComponents: osmComponents.componentIds.length,
      ordinaryNodes: ordinaryGraph.nodes.size,
      ordinaryEdges: ordinaryGraph.edges.length,
      ordinaryComponents: ordinaryComponents.componentIds.length,
      virtualCandidates: virtualResult.candidates.length,
      componentsBeforeVirtual: virtualResult.componentCountBefore,
      componentsAfterVirtual: virtualResult.componentCountAfter,
      connectableComponents: virtualResult.connectableComponentCount,
      virtualDistancesMeters: virtualResult.candidates
        .map(({ distanceMeters }) => Number(distanceMeters.toFixed(3)))
        .sort((a, b) => a - b),
    }))

    expect(osmComponents.componentIds.length).toBe(16)
    expect(ordinaryComponents.componentIds.length).toBeLessThanOrEqual(16)
    expect(virtualResult.componentCountBefore).toBe(
      ordinaryComponents.componentIds.length,
    )
  })

  it('keeps the two established route cases semantically valid', () => {
    const osmGraph = loadRoutingDataset(dataset)
    const ordinaryGraph = addFkbOrdinaryRoutingSupplement(osmGraph, supplement)
    const virtualResult = createGraphWithVirtualConnections(
      ordinaryGraph,
      virtualConnectionConfig,
    )

    const ornkjellhaugan = routeWaypoints(
      [
        ordinaryGraph.nodes.get('8332025315')!,
        ordinaryGraph.nodes.get('3079323663')!,
      ],
      virtualResult.graph,
      dataset.metadata.bounds,
      100,
      virtualResult.snapGraph,
    )
    const fkbCorridor = routeWaypoints(
      [
        { latitude: 62.79126, longitude: 9.59762 },
        { latitude: 62.79442, longitude: 9.61702 },
      ],
      ordinaryGraph,
      dataset.metadata.bounds,
      100,
    )

    console.info('SECONDARY_ROUTE_CASES', JSON.stringify({
      ornkjellhaugan:
        ornkjellhaugan.status === 'routed'
          ? {
              distanceMeters: Number(
                ornkjellhaugan.route.totalDistanceMeters.toFixed(3),
              ),
              virtualEdgeCount: ornkjellhaugan.route.virtualEdgeCount,
              virtualDistanceMeters: Number(
                ornkjellhaugan.route.virtualDistanceMeters.toFixed(3),
              ),
              edgeTypeCounts: ornkjellhaugan.diagnostics.edgeTypeCounts,
            }
          : { status: ornkjellhaugan.status },
      fkbCorridor:
        fkbCorridor.status === 'routed'
          ? {
              distanceMeters: Number(
                fkbCorridor.route.totalDistanceMeters.toFixed(3),
              ),
              virtualEdgeCount: fkbCorridor.route.virtualEdgeCount,
              edgeTypeCounts: fkbCorridor.diagnostics.edgeTypeCounts,
              usesFkb: fkbCorridor.route.edges.some(({ id }) =>
                id.startsWith('fkb:'),
              ),
            }
          : { status: fkbCorridor.status },
    }))

    expect(ornkjellhaugan.status).toBe('routed')
    expect(fkbCorridor.status).toBe('routed')
  })
})
