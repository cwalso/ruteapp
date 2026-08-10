import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ElevationRouteSegment } from '../../elevation/elevationTypes'
import MapView from '../../map/MapView'
import {
  createRoutableMapSegments,
  createRoutableNetworkGeoJson,
} from '../../map/routableNetworkData'
import type { RouteResultSegment } from '../../map/routeResultLayer'
import type { RouteSnapDebugConnection } from '../../map/routeSnapDebugLayer'
import { routeWaypoints } from '../../routing/routeWaypoints'
import {
  getLoadedNerskogenRoutingData,
  loadNerskogenRoutingData,
} from '../../services/nerskogenRoutingData'
import type { RoutePoint, RoutePointPosition } from '../../types/routePoint'
import RoutePlanningPanel, {
  type RoutePlanningRoutingState,
} from './RoutePlanningPanel'
import { calculateRouteDistanceMeters } from './routePlanning'
import { routePlanningConfig } from './routePlanningConfig'
import { useRouteElevation } from './useRouteElevation'

function RoutePlanningFeature() {
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([])
  const [useApprovedShortcuts, setUseApprovedShortcuts] = useState(false)
  const [routingLoadStatus, setRoutingLoadStatus] = useState<
    'loading' | 'loaded' | 'error'
  >('loading')
  const nextPointIdRef = useRef(1)

  useEffect(() => {
    let isActive = true

    loadNerskogenRoutingData()
      .then(() => {
        if (isActive) {
          setRoutingLoadStatus('loaded')
        }
      })
      .catch(() => {
        if (isActive) {
          setRoutingLoadStatus('error')
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  const handleAddPoint = useCallback((position: RoutePointPosition) => {
    const pointId = `route-point-${nextPointIdRef.current}`
    nextPointIdRef.current += 1

    setRoutePoints((currentPoints) => [
      ...currentPoints,
      { id: pointId, ...position },
    ])
  }, [])

  const handleMovePoint = useCallback(
    (pointId: string, position: RoutePointPosition) => {
      setRoutePoints((currentPoints) =>
        currentPoints.map((point) =>
          point.id === pointId ? { ...point, ...position } : point,
        ),
      )
    },
    [],
  )

  const handleRemovePoint = useCallback((pointId: string) => {
    setRoutePoints((currentPoints) =>
      currentPoints.filter(({ id }) => id !== pointId),
    )
  }, [])

  const handleClearRoute = useCallback(() => {
    setRoutePoints([])
  }, [])

  const distanceMeters = useMemo(
    () => calculateRouteDistanceMeters(routePoints),
    [routePoints],
  )
  const routingResult = useMemo<RoutePlanningRoutingState>(() => {
    if (routingLoadStatus === 'loading') {
      return { status: 'loading' }
    }

    const routingData = getLoadedNerskogenRoutingData()

    if (routingLoadStatus === 'error' || !routingData) {
      return { status: 'loadError' }
    }

    const graph =
      import.meta.env.DEV && useApprovedShortcuts
        ? routingData.approvedShortcutGraph ?? routingData.graph
        : routingData.graph
    const snapGraph =
      import.meta.env.DEV && useApprovedShortcuts
        ? routingData.approvedShortcutSnapGraph ?? routingData.snapGraph
        : routingData.snapGraph

    return routeWaypoints(
      routePoints,
      graph,
      routingData.dataset.metadata.bounds,
      routePlanningConfig.maxSnapDistanceMeters,
      snapGraph,
    )
  }, [routePoints, routingLoadStatus, useApprovedShortcuts])
  const routeSegments = useMemo<RouteResultSegment[]>(
    () => {
      if (routingResult.status !== 'routed') {
        return []
      }

      return routingResult.route.edges.map((edge, edgeIndex) => ({
        edgeType: edge.edgeType,
        coordinates: [
          routingResult.routeNodes[edgeIndex],
          routingResult.routeNodes[edgeIndex + 1],
        ],
      }))
    },
    [routingResult],
  )
  const elevationRouteSegments = useMemo<ElevationRouteSegment[]>(() => {
    if (routingResult.status !== 'routed') {
      return []
    }

    return routingResult.route.edges.map((edge, edgeIndex) => ({
      from: routingResult.routeNodes[edgeIndex],
      to: routingResult.routeNodes[edgeIndex + 1],
      distanceMeters: edge.distanceMeters,
      edgeType: edge.edgeType,
    }))
  }, [routingResult])
  const elevationState = useRouteElevation(
    elevationRouteSegments,
    routingResult.status === 'routed'
      ? routingResult.route.virtualDistanceMeters
      : 0,
  )
  const virtualCandidates = useMemo(
    () => {
      if (!import.meta.env.DEV || routingLoadStatus !== 'loaded') {
        return []
      }

      return (
        getLoadedNerskogenRoutingData()?.virtualConnectionCandidates ?? []
      )
    },
    [routingLoadStatus],
  )
  const routableNetworkData = useMemo(() => {
    const routingData = getLoadedNerskogenRoutingData()
    const segments =
      routingLoadStatus === 'loaded' && routingData
        ? createRoutableMapSegments(routingData.ordinaryGraph)
        : []

    return createRoutableNetworkGeoJson(segments)
  }, [routingLoadStatus])
  const planningHelperPoints = useMemo(
    () =>
      import.meta.env.DEV || routingResult.status !== 'routed'
        ? routePoints
        : [],
    [routePoints, routingResult.status],
  )
  const snapDebugConnections = useMemo<RouteSnapDebugConnection[]>(() => {
    if (
      !import.meta.env.DEV ||
      (routingResult.status !== 'routed' &&
        routingResult.status !== 'noRoute')
    ) {
      return []
    }

    return routingResult.snappedPoints.map(
      ({ pointIndex, originalPosition, snappedPosition, distanceMeters }) => ({
        pointIndex,
        originalPosition,
        snappedPosition,
        distanceMeters,
      }),
    )
  }, [routingResult])

  useEffect(() => {
    if (!import.meta.env.DEV || routingResult.status !== 'routed') {
      return
    }

    const routingData = getLoadedNerskogenRoutingData()
    const routedEdgeIds = new Set(routingResult.route.edges.map(({ id }) => id))
    const usedApprovedShortcuts =
      routingData?.approvedShortcutCandidates.filter(({ virtualEdgeIds }) =>
        virtualEdgeIds.some((edgeId) => routedEdgeIds.has(edgeId)),
      ) ?? []
    const ordinaryResult =
      useApprovedShortcuts && usedApprovedShortcuts.length > 0 && routingData
        ? routeWaypoints(
            routePoints,
            routingData.graph,
            routingData.dataset.metadata.bounds,
            routePlanningConfig.maxSnapDistanceMeters,
            routingData.snapGraph,
          )
        : undefined
    const ordinaryDistanceMeters =
      ordinaryResult?.status === 'routed'
        ? ordinaryResult.route.totalDistanceMeters
        : undefined

    console.debug('[RuteApp] Routingdiagnostikk', {
      snappedPoints: routingResult.snappedPoints,
      routeEdgeIds: routingResult.diagnostics.routeEdgeIds,
      routeEdgeTypes: routingResult.diagnostics.routeEdgeTypes,
      edgeTypeCounts: routingResult.diagnostics.edgeTypeCounts,
      virtualEdgeCount: routingResult.route.virtualEdgeCount,
      virtualDistanceMeters: routingResult.route.virtualDistanceMeters,
      approvedShortcutsEnabled: useApprovedShortcuts,
      usedApprovedShortcuts: usedApprovedShortcuts.map((candidate) => ({
        candidateId: candidate.candidateId,
        directDistanceMeters: candidate.directDistanceMeters,
        fromEdgeId: candidate.fromEdgeId,
        toEdgeId: candidate.toEdgeId,
        virtualEdgeIds: candidate.virtualEdgeIds,
        virtualOrigin: candidate.virtualOrigin,
        routeDistanceSavedMeters:
          ordinaryDistanceMeters === undefined
            ? undefined
            : ordinaryDistanceMeters - routingResult.route.totalDistanceMeters,
      })),
    })
  }, [routePoints, routingResult, useApprovedShortcuts])

  return (
    <main className="app-main">
      <section className="map-region" aria-label="Kartområde">
        <MapView
          routePoints={routePoints}
          planningHelperPoints={planningHelperPoints}
          routeSegments={routeSegments}
          snapDebugConnections={snapDebugConnections}
          virtualCandidates={virtualCandidates}
          routableNetworkData={routableNetworkData}
          onAddPoint={handleAddPoint}
          onMovePoint={handleMovePoint}
          onRemovePoint={handleRemovePoint}
        />
      </section>

      <RoutePlanningPanel
        routePoints={routePoints}
        distanceMeters={distanceMeters}
        routingResult={routingResult}
        elevationState={elevationState}
        virtualCandidateCount={
          import.meta.env.DEV && routingLoadStatus === 'loaded'
            ? virtualCandidates.length
            : undefined
        }
        useApprovedShortcuts={useApprovedShortcuts}
        approvedShortcutCount={
          import.meta.env.DEV && routingLoadStatus === 'loaded'
            ? getLoadedNerskogenRoutingData()?.approvedShortcutCandidates
                .length
            : undefined
        }
        onUseApprovedShortcutsChange={setUseApprovedShortcuts}
        onClear={handleClearRoute}
      />
    </main>
  )
}

export default RoutePlanningFeature
