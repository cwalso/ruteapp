import {
  loadRoutingDataset,
  parseRoutingDataset,
  type RuteAppRoutingDataset,
} from '../routing/routingDataset'
import type { RoutingGraph } from '../routing/routingTypes'
import { sameComponentShortcutDevCandidates } from '../routing/sameComponentShortcutDevCandidates'
import {
  createGraphWithApprovedSameComponentShortcuts,
  type MaterializedSameComponentShortcut,
} from '../routing/sameComponentShortcutMaterialization'
import { virtualConnectionConfig } from '../routing/virtualConnectionConfig'
import {
  createGraphWithVirtualConnections,
  type VirtualConnectionCandidate,
} from '../routing/virtualConnections'

export type LoadedRoutingData = {
  dataset: RuteAppRoutingDataset
  ordinaryGraph: RoutingGraph
  graph: RoutingGraph
  snapGraph: RoutingGraph
  virtualConnectionCandidates: readonly VirtualConnectionCandidate[]
  approvedShortcutGraph?: RoutingGraph
  approvedShortcutSnapGraph?: RoutingGraph
  approvedShortcutCandidates: readonly MaterializedSameComponentShortcut[]
  approvedShortcutMaterializationMilliseconds?: number
}

let routingDataPromise: Promise<LoadedRoutingData> | undefined
let loadedRoutingData: LoadedRoutingData | undefined

export function loadNerskogenRoutingData() {
  routingDataPromise ??= fetchRoutingData()
  return routingDataPromise
}

export function getLoadedNerskogenRoutingData() {
  return loadedRoutingData
}

async function fetchRoutingData(): Promise<LoadedRoutingData> {
  const response = await fetch('/data/routing/nerskogen.json')

  if (!response.ok) {
    throw new Error(`Routing dataset request failed: ${response.status}`)
  }

  const dataset = parseRoutingDataset(await response.json())
  const ordinaryGraph = loadRoutingDataset(dataset)
  const virtualConnectionResult = createGraphWithVirtualConnections(
    ordinaryGraph,
    virtualConnectionConfig,
  )
  let approvedShortcutGraph: RoutingGraph | undefined
  let approvedShortcutSnapGraph: RoutingGraph | undefined
  let approvedShortcutCandidates: readonly MaterializedSameComponentShortcut[] = []
  let approvedShortcutMaterializationMilliseconds: number | undefined

  if (import.meta.env.DEV) {
    const startedAt = performance.now()
    const shortcutResult = createGraphWithApprovedSameComponentShortcuts(
      ordinaryGraph,
      virtualConnectionResult.graph,
      virtualConnectionResult.snapGraph,
      sameComponentShortcutDevCandidates,
      virtualConnectionConfig.virtualCostMultiplier,
    )

    approvedShortcutMaterializationMilliseconds = performance.now() - startedAt
    approvedShortcutGraph = shortcutResult.graph
    approvedShortcutSnapGraph = shortcutResult.snapGraph
    approvedShortcutCandidates = shortcutResult.candidates

    console.debug('[RuteApp] Godkjente shortcuts materialisert', {
      candidates: approvedShortcutCandidates.length,
      durationMilliseconds: approvedShortcutMaterializationMilliseconds,
    })
  }

  loadedRoutingData = {
    dataset,
    ordinaryGraph,
    graph: virtualConnectionResult.graph,
    snapGraph: virtualConnectionResult.snapGraph,
    virtualConnectionCandidates: virtualConnectionResult.candidates,
    approvedShortcutGraph,
    approvedShortcutSnapGraph,
    approvedShortcutCandidates,
    approvedShortcutMaterializationMilliseconds,
  }

  return loadedRoutingData
}
