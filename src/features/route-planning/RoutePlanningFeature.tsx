import { useCallback, useMemo, useRef, useState } from 'react'
import MapView from '../../map/MapView'
import type { RoutePoint, RoutePointPosition } from '../../types/routePoint'
import RoutePlanningPanel from './RoutePlanningPanel'
import { calculateRouteDistanceMeters } from './routePlanning'

function RoutePlanningFeature() {
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([])
  const nextPointIdRef = useRef(1)

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

  return (
    <main className="app-main">
      <section className="map-region" aria-label="Kartområde">
        <MapView
          routePoints={routePoints}
          onAddPoint={handleAddPoint}
          onMovePoint={handleMovePoint}
          onRemovePoint={handleRemovePoint}
        />
      </section>

      <RoutePlanningPanel
        routePoints={routePoints}
        distanceMeters={distanceMeters}
        onClear={handleClearRoute}
      />
    </main>
  )
}

export default RoutePlanningFeature
