import { findNearestRoutingEdgePoint } from './nearestRoutingEdgePoint'
import { createRoutingGraph } from './routingGraph'
import {
  createRoutingGraphWithEdgeSnaps,
  type IndexedRoutingEdgeSnap,
} from './routingSnapGraph'
import { isSameComponentShortcutDevAllowed } from './sameComponentShortcutDevAllowlist'
import type { SameComponentShortcutCandidate } from './sameComponentShortcutCandidates'
import type { RoutingEdge, RoutingGraph } from './routingTypes'

export type MaterializedSameComponentShortcut =
  SameComponentShortcutCandidate & {
    virtualOrigin: 'same-component-shortcut'
    virtualConnectionId: string
    virtualEdgeIds: readonly [string, string]
    fromNodeId: string
    toNodeId: string
    cost: number
  }

export type SameComponentShortcutGraphResult = {
  graph: RoutingGraph
  snapGraph: RoutingGraph
  candidates: readonly MaterializedSameComponentShortcut[]
}

const endpointMatchToleranceMeters = 0.25

export function createGraphWithApprovedSameComponentShortcuts(
  ordinaryGraph: RoutingGraph,
  baseGraph: RoutingGraph,
  baseSnapGraph: RoutingGraph,
  candidates: readonly SameComponentShortcutCandidate[],
  virtualCostMultiplier: number,
): SameComponentShortcutGraphResult {
  validateCostMultiplier(virtualCostMultiplier)

  const approvedCandidates = candidates.filter(({ candidateId }) =>
    isSameComponentShortcutDevAllowed(candidateId),
  )

  if (approvedCandidates.length === 0) {
    return { graph: baseGraph, snapGraph: baseSnapGraph, candidates: [] }
  }

  const edgeSnaps: IndexedRoutingEdgeSnap[] = approvedCandidates.flatMap(
    (candidate, candidateIndex) => [
      createEndpointSnap(
        ordinaryGraph,
        baseSnapGraph,
        candidateIndex * 2,
        candidate.fromEdgeId,
        candidate.fromEdgeType,
        candidate.fromCoordinate,
      ),
      createEndpointSnap(
        ordinaryGraph,
        baseSnapGraph,
        candidateIndex * 2 + 1,
        candidate.toEdgeId,
        candidate.toEdgeType,
        candidate.toCoordinate,
      ),
    ],
  )
  const routeSplitResult = createRoutingGraphWithEdgeSnaps(
    baseGraph,
    edgeSnaps,
  )
  const snapSplitResult = createRoutingGraphWithEdgeSnaps(
    baseSnapGraph,
    edgeSnaps,
  )
  const virtualEdges: RoutingEdge[] = []
  const materializedCandidates = approvedCandidates.map(
    (candidate, candidateIndex): MaterializedSameComponentShortcut => {
      const fromNode = getResolvedNode(
        routeSplitResult.resolvedSnaps,
        candidateIndex * 2,
      )
      const toNode = getResolvedNode(
        routeSplitResult.resolvedSnaps,
        candidateIndex * 2 + 1,
      )
      const virtualConnectionId = `dev-virtual:${candidate.candidateId}`
      const virtualEdgeIds = [
        `${virtualConnectionId}:forward`,
        `${virtualConnectionId}:reverse`,
      ] as const
      const cost = candidate.directDistanceMeters * virtualCostMultiplier

      virtualEdges.push(
        {
          id: virtualEdgeIds[0],
          fromNodeId: fromNode.id,
          toNodeId: toNode.id,
          distanceMeters: candidate.directDistanceMeters,
          edgeType: 'virtual',
          cost,
        },
        {
          id: virtualEdgeIds[1],
          fromNodeId: toNode.id,
          toNodeId: fromNode.id,
          distanceMeters: candidate.directDistanceMeters,
          edgeType: 'virtual',
          cost,
        },
      )

      return {
        ...candidate,
        virtualOrigin: 'same-component-shortcut',
        virtualConnectionId,
        virtualEdgeIds,
        fromNodeId: fromNode.id,
        toNodeId: toNode.id,
        cost,
      }
    },
  )

  return {
    graph: createRoutingGraph(
      [...routeSplitResult.graph.nodes.values()],
      [...routeSplitResult.graph.edges, ...virtualEdges],
    ),
    snapGraph: snapSplitResult.graph,
    candidates: materializedCandidates,
  }
}

function createEndpointSnap(
  ordinaryGraph: RoutingGraph,
  baseSnapGraph: RoutingGraph,
  pointIndex: number,
  sourceEdgeId: string,
  expectedEdgeType: SameComponentShortcutCandidate['fromEdgeType'],
  coordinate: SameComponentShortcutCandidate['fromCoordinate'],
): IndexedRoutingEdgeSnap {
  const sourceEdge = ordinaryGraph.edges.find(({ id }) => id === sourceEdgeId)

  if (!sourceEdge || sourceEdge.edgeType !== expectedEdgeType) {
    throw new Error(`Shortcut references an unknown ordinary edge: ${sourceEdgeId}`)
  }

  const matchingEdges = baseSnapGraph.edges.filter(
    (edge) =>
      edge.edgeType === expectedEdgeType &&
      (edge.id === sourceEdgeId || edge.id.startsWith(`${sourceEdgeId}:route-split:`)),
  )

  if (matchingEdges.length === 0) {
    throw new Error(`Shortcut source edge is missing from the derived graph: ${sourceEdgeId}`)
  }

  const matchingNodeIds = new Set(
    matchingEdges.flatMap(({ fromNodeId, toNodeId }) => [
      fromNodeId,
      toNodeId,
    ]),
  )
  const sourceEdgeGraph = createRoutingGraph(
    [...matchingNodeIds].map((nodeId) => {
      const node = baseSnapGraph.nodes.get(nodeId)

      if (!node) {
        throw new Error(`Shortcut source edge references an unknown node: ${nodeId}`)
      }

      return node
    }),
    matchingEdges,
  )
  const snap = findNearestRoutingEdgePoint(
    sourceEdgeGraph,
    coordinate,
    endpointMatchToleranceMeters,
  )

  if (!snap) {
    throw new Error(`Shortcut coordinate does not match its source edge: ${sourceEdgeId}`)
  }

  return { pointIndex, snap }
}

function getResolvedNode(
  resolvedSnaps: ReturnType<
    typeof createRoutingGraphWithEdgeSnaps
  >['resolvedSnaps'],
  pointIndex: number,
) {
  const resolved = resolvedSnaps.find((snap) => snap.pointIndex === pointIndex)

  if (!resolved) {
    throw new Error('Could not resolve a same-component shortcut endpoint.')
  }

  return resolved.node
}

function validateCostMultiplier(virtualCostMultiplier: number) {
  if (
    !Number.isFinite(virtualCostMultiplier) ||
    virtualCostMultiplier <= 1
  ) {
    throw new Error('Shortcut virtual cost multiplier must be greater than one.')
  }
}
