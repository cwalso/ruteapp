import type { RoutePoint } from '../../types/routePoint'
import type { WaypointRoutingResult } from '../../routing/routeWaypoints'
import ElevationProfileChart from './ElevationProfileChart'
import {
  formatDistance,
  getRoutePointRole,
} from './routePlanning'
import type { RouteElevationState } from './useRouteElevation'

export type RoutePlanningRoutingState =
  | WaypointRoutingResult
  | { status: 'loading' }
  | { status: 'loadError' }

type RoutePlanningPanelProps = {
  routePoints: readonly RoutePoint[]
  distanceMeters: number
  routingResult: RoutePlanningRoutingState
  elevationState: RouteElevationState
  virtualCandidateCount?: number
  useApprovedShortcuts: boolean
  approvedShortcutCount?: number
  onUseApprovedShortcutsChange: (enabled: boolean) => void
  onClear: () => void
}

function formatCoordinate(point: RoutePoint) {
  return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`
}

function RoutePlanningPanel({
  routePoints,
  distanceMeters,
  routingResult,
  elevationState,
  virtualCandidateCount,
  useApprovedShortcuts,
  approvedShortcutCount,
  onUseApprovedShortcutsChange,
  onClear,
}: RoutePlanningPanelProps) {
  const viaPointCount = Math.max(0, routePoints.length - 2)
  const isRouted = routingResult.status === 'routed'

  return (
    <aside className="route-panel" aria-labelledby="route-panel-title">
      <header className="route-panel__header">
        <span className="panel-label">Ruteplanlegging</span>
        <h2 id="route-panel-title">Planlegg turen</h2>
        <p className="route-panel-help">
          {getPlanningInstruction(routePoints.length)}
        </p>
      </header>

      {isRouted && (
        <RouteOverview
          routingResult={routingResult}
          elevationState={elevationState}
        />
      )}

      <RoutingStatus routingResult={routingResult} />
      <VirtualConnectionStatus routingResult={routingResult} />
      {isRouted && <ElevationStatus elevationState={elevationState} />}

      {routePoints.length > 1 && (
        <dl className="route-secondary-summary">
          <div>
            <dt>Direkte avstand</dt>
            <dd>{formatDistance(distanceMeters)}</dd>
          </div>
          {viaPointCount > 0 && (
            <div>
              <dt>Mellompunkter</dt>
              <dd>{viaPointCount}</dd>
            </div>
          )}
        </dl>
      )}

      {routePoints.length > 0 && (
        <section className="route-points-section" aria-labelledby="points-title">
          <div className="section-heading">
            <h3 id="points-title">Punkter</h3>
            <span>{routePoints.length}</span>
          </div>
          <ol className="route-points" aria-label="Valgte rutepunkter">
            {routePoints.map((point, index) => {
              const role = getRoutePointRole(index, routePoints.length)

              return (
                <li className="route-point" key={point.id}>
                  <span
                    className={`point-marker point-marker--${role.kind}`}
                    aria-hidden="true"
                  >
                    {role.label}
                  </span>
                  <div className="route-point__content">
                    <strong>{getPointName(role.kind, role.label)}</strong>
                    <span>{formatCoordinate(point)}</span>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {import.meta.env.DEV && approvedShortcutCount !== undefined && (
        <section className="development-routing-control" aria-label="Development routing">
          <label>
            <input
              type="checkbox"
              checked={useApprovedShortcuts}
              onChange={(event) =>
                onUseApprovedShortcutsChange(event.target.checked)
              }
            />
            Bruk godkjente shortcuts i routing
          </label>
          <small>
            Dev · {approvedShortcutCount} godkjente shortcuts
            {virtualCandidateCount === undefined
              ? ''
              : ` · ${virtualCandidateCount} component-gap-kandidater`}
          </small>
        </section>
      )}

      {routePoints.length > 0 && (
        <button className="clear-route-button" type="button" onClick={onClear}>
          Tøm rute
        </button>
      )}
    </aside>
  )
}

function RouteOverview({
  routingResult,
  elevationState,
}: {
  routingResult: Extract<WaypointRoutingResult, { status: 'routed' }>
  elevationState: RouteElevationState
}) {
  const elevationReady = elevationState.status === 'ready'

  return (
    <section className="route-overview" aria-labelledby="overview-title">
      <h3 id="overview-title" className="visually-hidden">
        Ruteoversikt
      </h3>
      <dl className="route-metrics">
        <div>
          <dt>Distanse</dt>
          <dd>{formatDistance(routingResult.route.totalDistanceMeters)}</dd>
        </div>
        <div>
          <dt>Estimert tid</dt>
          <dd className={!elevationReady ? 'metric-pending' : undefined}>
            {elevationReady
              ? formatWalkingTime(elevationState.estimatedWalkingTimeMinutes)
              : '—'}
          </dd>
        </div>
        <div>
          <dt>Stigning</dt>
          <dd className={!elevationReady ? 'metric-pending' : undefined}>
            <span aria-hidden="true">↑</span>{' '}
            {elevationReady
              ? formatElevation(elevationState.profile.totalAscentMeters)
              : '—'}
          </dd>
        </div>
        <div>
          <dt>Fall</dt>
          <dd className={!elevationReady ? 'metric-pending' : undefined}>
            <span aria-hidden="true">↓</span>{' '}
            {elevationReady
              ? formatElevation(elevationState.profile.totalDescentMeters)
              : '—'}
          </dd>
        </div>
      </dl>
    </section>
  )
}

function ElevationStatus({
  elevationState,
}: {
  elevationState: RouteElevationState
}) {
  if (elevationState.status === 'loading') {
    return (
      <section className="elevation-profile elevation-profile--state" aria-label="Høydeprofil">
        <h3>Høydeprofil</h3>
        <p role="status">Henter høydeprofil …</p>
      </section>
    )
  }

  if (elevationState.status === 'error') {
    return (
      <section className="elevation-profile elevation-profile--state elevation-profile--error" aria-label="Høydeprofil">
        <h3>Høydeprofil</h3>
        <p role="status">Høydeprofil kunne ikke hentes.</p>
      </section>
    )
  }

  if (elevationState.status === 'ready') {
    return <ElevationProfileChart profile={elevationState.profile} />
  }

  return null
}

function formatElevation(elevationMeters: number) {
  return `${Math.round(elevationMeters)} m`
}

function formatWalkingTime(walkingTimeMinutes: number) {
  const roundedMinutes = Math.round(walkingTimeMinutes)

  if (roundedMinutes < 60) {
    return `${roundedMinutes} min`
  }

  const hours = Math.floor(roundedMinutes / 60)
  const minutes = roundedMinutes % 60

  return minutes === 0 ? `${hours} t` : `${hours} t ${minutes} min`
}

function getPlanningInstruction(pointCount: number) {
  if (pointCount === 0) {
    return 'Klikk i kartet for å velge startpunkt.'
  }

  if (pointCount === 1) {
    return 'Startpunkt valgt. Klikk i kartet for å velge mål.'
  }

  return 'Klikk for å legge til via-punkt. Dra for å flytte, høyreklikk for å fjerne.'
}

function getPointName(kind: 'start' | 'via' | 'end', label: string) {
  if (kind === 'start') {
    return 'Start'
  }

  if (kind === 'end') {
    return 'Mål'
  }

  return `Mellompunkt ${label}`
}

function VirtualConnectionStatus({
  routingResult,
}: {
  routingResult: RoutePlanningRoutingState
}) {
  if (
    routingResult.status !== 'routed' ||
    routingResult.route.virtualEdgeCount === 0
  ) {
    return null
  }

  const count = routingResult.route.virtualEdgeCount

  return (
    <section className="virtual-connection-summary" aria-label="Terrengforbindelser">
      <p>
        <strong>
          {count} terrengforbindelse{count === 1 ? '' : 'r'}
        </strong>{' '}
        · {formatDistance(routingResult.route.virtualDistanceMeters)}
      </p>
      <p>
        Stiplet lilla del er et topologisk forslag og er ikke kontrollert for
        terreng eller sikker ferdsel.
      </p>
    </section>
  )
}

function RoutingStatus({
  routingResult,
}: {
  routingResult: RoutePlanningRoutingState
}) {
  if (routingResult.status === 'loading') {
    return <p className="routing-status">Routingdata lastes …</p>
  }

  if (routingResult.status === 'loadError') {
    return (
      <p className="routing-status routing-status--error" role="status">
        Routingdata kunne ikke lastes.
      </p>
    )
  }

  if (routingResult.status === 'outsideDataset') {
    return (
      <p className="routing-status routing-status--error" role="status">
        Dette området er ikke dekket av routingdata ennå.
      </p>
    )
  }

  if (routingResult.status === 'noNearbyNetwork') {
    return (
      <p className="routing-status routing-status--error" role="status">
        Ingen sti eller vei nær nok dette punktet.
      </p>
    )
  }

  if (routingResult.status === 'noRoute') {
    return (
      <p className="routing-status routing-status--error" role="status">
        Ingen sammenhengende rute funnet.
      </p>
    )
  }

  return null
}

export default RoutePlanningPanel
