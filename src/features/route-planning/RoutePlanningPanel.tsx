import type { RoutePoint } from '../../types/routePoint'
import { formatDistance } from './routePlanning'

type RoutePlanningPanelProps = {
  routePoints: readonly RoutePoint[]
  distanceMeters: number
  onClear: () => void
}

function formatCoordinate(point: RoutePoint) {
  return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`
}

function RoutePlanningPanel({
  routePoints,
  distanceMeters,
  onClear,
}: RoutePlanningPanelProps) {
  const startPoint = routePoints[0]
  const endPoint =
    routePoints.length > 1 ? routePoints[routePoints.length - 1] : undefined
  const viaPointCount = Math.max(0, routePoints.length - 2)

  return (
    <aside className="route-panel" aria-labelledby="route-panel-title">
      <span className="panel-label">Ruteplanlegging</span>
      <h2 id="route-panel-title">Planlegg ruten</h2>
      <p className="route-panel-help">
        Klikk i kartet for å legge til punkt. Dra punkt for å flytte.
        Høyreklikk for å fjerne.
      </p>

      <div className="route-points" aria-label="Valgte rutepunkter">
        <div className="route-point">
          <span className="point-marker" aria-hidden="true">
            A
          </span>
          <div>
            <span>Startpunkt A</span>
            <strong>
              {startPoint ? formatCoordinate(startPoint) : 'Ikke valgt'}
            </strong>
          </div>
        </div>

        {endPoint && (
          <div className="route-point">
            <span
              className="point-marker point-marker--end"
              aria-hidden="true"
            >
              B
            </span>
            <div>
              <span>Målpunkt B</span>
              <strong>{formatCoordinate(endPoint)}</strong>
            </div>
          </div>
        )}
      </div>

      <dl className="route-summary">
        {viaPointCount > 0 && (
          <div>
            <dt>Mellompunkter</dt>
            <dd>{viaPointCount}</dd>
          </div>
        )}
        <div>
          <dt>Foreløpig avstand</dt>
          <dd>{formatDistance(distanceMeters)}</dd>
        </div>
      </dl>

      <p className="route-disclaimer">
        Linjen viser direkte avstand mellom punktene, ikke en beregnet
        fotturrute.
      </p>

      {routePoints.length > 0 && (
        <button className="clear-route-button" type="button" onClick={onClear}>
          Tøm rute
        </button>
      )}
    </aside>
  )
}

export default RoutePlanningPanel
