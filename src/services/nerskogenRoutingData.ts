import {
  addFkbOrdinaryRoutingSupplement,
  type FkbOrdinaryRoutingSupplement,
} from '../routing/fkbOrdinaryRoutingSupplement'
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
  const [routingResponse, fkbResponse] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}data/routing/nerskogen.json`),
    fetch(
      `${import.meta.env.BASE_URL}data/routing/nerskogen-fkb-corridor.json`,
    ),
  ])

  if (!routingResponse.ok) {
    throw new Error(
      `Routing dataset request failed: ${routingResponse.status}`,
    )
  }

  if (!fkbResponse.ok) {
    throw new Error(
      `FKB routing supplement request failed: ${fkbResponse.status}`,
    )
  }

  const dataset = parseRoutingDataset(await routingResponse.json())
  const fkbSupplement =
    (await fkbResponse.json()) as FkbOrdinaryRoutingSupplement
  const osmGraph = loadRoutingDataset(dataset)
  const ordinaryGraph = addFkbOrdinaryRoutingSupplement(
    osmGraph,
    fkbSupplement,
  )
  const virtualConnectionResult = createGraphWithVirtualConnections(
    ordinaryGraph,
    virtualConnectionConfig,
  )
  const startedAt = performance.now()
  const shortcutResult = createGraphWithApprovedSameComponentShortcuts(
    ordinaryGraph,
    virtualConnectionResult.graph,
    virtualConnectionResult.snapGraph,
    sameComponentShortcutDevCandidates,
    virtualConnectionConfig.virtualCostMultiplier,
  )

  const approvedShortcutMaterializationMilliseconds =
    performance.now() - startedAt
  const approvedShortcutGraph = shortcutResult.graph
  const approvedShortcutSnapGraph = shortcutResult.snapGraph
  const approvedShortcutCandidates = shortcutResult.candidates

  if (import.meta.env.DEV) {
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
