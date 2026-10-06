import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getRoutePointRole } from '../features/route-planning/routePlanning'
import type { RoutePoint, RoutePointPosition } from '../types/routePoint'
import type { VirtualConnectionCandidate } from '../routing/virtualConnections'
import { mapConfig } from './mapConfig'
import {
  addMapProfileLayers,
  defaultMapProfile,
  mapProfiles,
  type MapProfile,
} from './mapProfiles'
import {
  restoreRoutePlanningLine,
  syncRoutePlanningLine,
} from './routePlanningLayer'
import {
  restoreRouteResultLine,
  syncRouteResultLine,
  type RouteResultSegment,
} from './routeResultLayer'
import {
  restoreRouteSnapDebugLayer,
  syncRouteSnapDebugLayer,
  type RouteSnapDebugConnection,
} from './routeSnapDebugLayer'
import {
  inspectVirtualCandidateAtPoint,
  restoreVirtualCandidateDebugLayer,
  syncVirtualCandidateDebugLayer,
} from './virtualCandidateDebugLayer'
import type { RoutableNetworkGeoJson } from './routableNetworkData'
import {
  restoreRoutableNetworkLayer,
  syncRoutableNetworkLayer,
} from './routableNetworkLayer'
import {
  emptySameComponentShortcutDebugData,
  findSameComponentShortcutById,
  includeSelectedSameComponentShortcut,
  loadSameComponentShortcutDebugData,
  selectSameComponentShortcutDebugData,
  type SameComponentShortcutDebugData,
  type SameComponentShortcutDebugFeature,
  type SameComponentShortcutDisplayLimit,
} from './sameComponentShortcutDebugData'
import {
  inspectSameComponentShortcutAtPoint,
  restoreSameComponentShortcutDebugLayer,
  showSameComponentShortcutPopup,
  syncSameComponentShortcutDebugLayer,
} from './sameComponentShortcutDebugLayer'
import './MapView.css'

setWorkerUrl(workerUrl)

const knownShortcutReferenceCandidateId =
  'same-component-shortcut:1446990760:1:f:1.000000:896319498:8:f:1.000000'

type MapViewProps = {
  routePoints: readonly RoutePoint[]
  planningHelperPoints: readonly RoutePoint[]
  routeSegments: readonly RouteResultSegment[]
  snapDebugConnections: readonly RouteSnapDebugConnection[]
  virtualCandidates: readonly VirtualConnectionCandidate[]
  routableNetworkData: RoutableNetworkGeoJson
  onAddPoint: (position: RoutePointPosition) => void
  onMovePoint: (pointId: string, position: RoutePointPosition) => void
  onRemovePoint: (pointId: string) => void
}

function MapView({
  routePoints,
  planningHelperPoints,
  routeSegments,
  snapDebugConnections,
  virtualCandidates,
  routableNetworkData,
  onAddPoint,
  onMovePoint,
  onRemovePoint,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap>(null)
  const routeMarkersRef = useRef(new globalThis.Map<string, Marker>())
  const planningHelperPointsRef = useRef(planningHelperPoints)
  const routeSegmentsRef = useRef(routeSegments)
  const snapDebugConnectionsRef = useRef(snapDebugConnections)
  const virtualCandidatesRef = useRef(virtualCandidates)
  const routableNetworkDataRef = useRef(routableNetworkData)
  const shortcutDebugDataRef = useRef<SameComponentShortcutDebugData>(
    emptySameComponentShortcutDebugData,
  )
  const selectedShortcutFeatureRef =
    useRef<SameComponentShortcutDebugFeature | undefined>(undefined)
  const onAddPointRef = useRef(onAddPoint)
  const onMovePointRef = useRef(onMovePoint)
  const onRemovePointRef = useRef(onRemovePoint)
  const activeProfileRef = useRef<MapProfile>(defaultMapProfile)
  const [activeProfileId, setActiveProfileId] = useState(defaultMapProfile.id)
  const [shortcutDebugData, setShortcutDebugData] =
    useState<SameComponentShortcutDebugData>(
      emptySameComponentShortcutDebugData,
    )
  const [shortcutDebugStatus, setShortcutDebugStatus] = useState<
    'loading' | 'loaded' | 'error'
  >('loading')
  const [shortcutDebugEnabled, setShortcutDebugEnabled] = useState(true)
  const [shortcutDisplayLimit, setShortcutDisplayLimit] =
    useState<SameComponentShortcutDisplayLimit>(20)
  const [minimumShortcutRatio, setMinimumShortcutRatio] = useState(5)
  const [maximumShortcutDistance, setMaximumShortcutDistance] = useState(200)
  const [selectedShortcutCandidateId, setSelectedShortcutCandidateId] =
    useState<string>()
  const [shortcutSearchValue, setShortcutSearchValue] = useState('')
  const [shortcutLookupMessage, setShortcutLookupMessage] = useState<string>()
  const visibleShortcutDebugData = useMemo(() => {
    if (!import.meta.env.DEV || !shortcutDebugEnabled) {
      return emptySameComponentShortcutDebugData
    }

    return selectSameComponentShortcutDebugData(shortcutDebugData, {
      limit: shortcutDisplayLimit,
      minimumDetourRatio: minimumShortcutRatio,
      maximumDirectDistanceMeters: maximumShortcutDistance,
    })
  }, [
    shortcutDebugData,
    shortcutDebugEnabled,
    shortcutDisplayLimit,
    minimumShortcutRatio,
    maximumShortcutDistance,
  ])
  const selectedShortcutFeature = useMemo(
    () =>
      selectedShortcutCandidateId
        ? findSameComponentShortcutById(
            shortcutDebugData,
            selectedShortcutCandidateId,
          )
        : undefined,
    [shortcutDebugData, selectedShortcutCandidateId],
  )
  const displayedSelectedShortcutFeature = shortcutDebugEnabled
    ? selectedShortcutFeature
    : undefined
  const renderedShortcutDebugData = useMemo(
    () =>
      includeSelectedSameComponentShortcut(
        visibleShortcutDebugData,
        displayedSelectedShortcutFeature,
      ),
    [displayedSelectedShortcutFeature, visibleShortcutDebugData],
  )
  const selectedShortcutIndex = selectedShortcutFeature
    ? visibleShortcutDebugData.features.findIndex(
        ({ properties }) =>
          properties.candidateId ===
          selectedShortcutFeature.properties.candidateId,
      )
    : -1

  useEffect(() => {
    planningHelperPointsRef.current = planningHelperPoints
    routeSegmentsRef.current = routeSegments
    snapDebugConnectionsRef.current = snapDebugConnections
    virtualCandidatesRef.current = virtualCandidates
    routableNetworkDataRef.current = routableNetworkData
    onAddPointRef.current = onAddPoint
    onMovePointRef.current = onMovePoint
    onRemovePointRef.current = onRemovePoint
  }, [
    routePoints,
    planningHelperPoints,
    routeSegments,
    snapDebugConnections,
    virtualCandidates,
    routableNetworkData,
    onAddPoint,
    onMovePoint,
    onRemovePoint,
  ])

  useEffect(() => {
    shortcutDebugDataRef.current = renderedShortcutDebugData
    selectedShortcutFeatureRef.current = displayedSelectedShortcutFeature
  }, [displayedSelectedShortcutFeature, renderedShortcutDebugData])

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }

    const startedAt = performance.now()
    const selected = selectSameComponentShortcutDebugData(shortcutDebugData, {
      limit: shortcutDisplayLimit,
      minimumDetourRatio: minimumShortcutRatio,
      maximumDirectDistanceMeters: maximumShortcutDistance,
    })

    console.debug('[RuteApp] Shortcut-filter', {
      candidates: selected.features.length,
      durationMilliseconds: performance.now() - startedAt,
    })
  }, [
    shortcutDebugData,
    shortcutDisplayLimit,
    minimumShortcutRatio,
    maximumShortcutDistance,
  ])

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }

    const controller = new AbortController()
    const startedAt = performance.now()

    loadSameComponentShortcutDebugData(controller.signal)
      .then((data) => {
        setShortcutDebugData(data)
        setShortcutDebugStatus('loaded')
        console.debug('[RuteApp] Shortcut-data lastet', {
          candidates: data.features.length,
          durationMilliseconds: performance.now() - startedAt,
        })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setShortcutDebugStatus('error')
          console.warn('[RuteApp] Shortcut-data kunne ikke lastes', error)
        }
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const container = mapContainerRef.current
    const routeMarkers = routeMarkersRef.current

    if (!container) {
      return
    }

    const map = new MapLibreMap({
      container,
      ...mapConfig,
      style: activeProfileRef.current.style,
      attributionControl: {},
    })

    mapRef.current = map

    map.on('style.load', () => {
      addMapProfileLayers(map, activeProfileRef.current)

      if (activeProfileRef.current.showRoutableNetwork) {
        restoreRoutableNetworkLayer(map, routableNetworkDataRef.current)
      }

      restoreRoutePlanningLine(map, planningHelperPointsRef.current)

      if (import.meta.env.DEV) {
        restoreVirtualCandidateDebugLayer(
          map,
          virtualCandidatesRef.current,
        )
        restoreSameComponentShortcutDebugLayer(
          map,
          shortcutDebugDataRef.current,
          selectedShortcutFeatureRef.current,
        )
      }

      restoreRouteResultLine(map, routeSegmentsRef.current)

      if (import.meta.env.DEV) {
        restoreRouteSnapDebugLayer(map, snapDebugConnectionsRef.current)
      }
    })

    let mapWasDragged = false
    let resetDragStateTimer: ReturnType<typeof setTimeout> | undefined

    map.on('dragstart', () => {
      clearTimeout(resetDragStateTimer)
      mapWasDragged = true
    })

    map.on('dragend', () => {
      resetDragStateTimer = setTimeout(() => {
        mapWasDragged = false
      }, 0)
    })

    map.on('click', ({ lngLat, originalEvent, point }) => {
      if (mapWasDragged || originalEvent.button !== 0) {
        return
      }

      if (
        import.meta.env.DEV &&
        inspectSameComponentShortcutAtPoint(map, point)
      ) {
        return
      }

      if (
        import.meta.env.DEV &&
        inspectVirtualCandidateAtPoint(map, point)
      ) {
        return
      }

      onAddPointRef.current({
        longitude: lngLat.lng,
        latitude: lngLat.lat,
      })
    })

    map.addControl(new NavigationControl(), 'top-right')

    return () => {
      clearTimeout(resetDragStateTimer)
      routeMarkers.forEach((marker) => marker.remove())
      routeMarkers.clear()
      mapRef.current = null
      map.remove()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current

    if (map && activeProfileRef.current.showRoutableNetwork) {
      syncRoutableNetworkLayer(map, routableNetworkData)
    }
  }, [routableNetworkData])

  useEffect(() => {
    const map = mapRef.current

    if (!map) {
      return
    }

    const currentPointIds = new Set(routePoints.map(({ id }) => id))

    routeMarkersRef.current.forEach((marker, pointId) => {
      if (!currentPointIds.has(pointId)) {
        marker.remove()
        routeMarkersRef.current.delete(pointId)
      }
    })

    routePoints.forEach((point, index) => {
      const role = getRoutePointRole(index, routePoints.length)
      let marker = routeMarkersRef.current.get(point.id)

      if (!marker) {
        const element = document.createElement('button')
        element.type = 'button'
        element.className = 'route-marker'
        element.addEventListener('click', (event) => event.stopPropagation())
        element.addEventListener('contextmenu', (event) => {
          event.preventDefault()
          event.stopPropagation()
          onRemovePointRef.current(point.id)
        })

        const newMarker = new Marker({ element, draggable: true })
          .setLngLat([point.longitude, point.latitude])
          .addTo(map)

        newMarker.on('drag', () => {
          const { lng, lat } = newMarker.getLngLat()
          onMovePointRef.current(point.id, {
            longitude: lng,
            latitude: lat,
          })
        })

        routeMarkersRef.current.set(point.id, newMarker)
        marker = newMarker
      }

      const element = marker.getElement()
      element.dataset.role = role.kind
      element.textContent = role.label
      element.title = `${getRoleName(role.kind)} – dra for å flytte. Fjern punktet i ruteoversikten.`
      element.setAttribute('aria-label', element.title)
      marker.setLngLat([point.longitude, point.latitude])
    })
  }, [routePoints])

  useEffect(() => {
    const map = mapRef.current

    if (map) {
      syncRoutePlanningLine(map, planningHelperPoints)
    }
  }, [planningHelperPoints])

  useEffect(() => {
    const map = mapRef.current

    if (import.meta.env.DEV && map) {
      syncVirtualCandidateDebugLayer(map, virtualCandidates)
    }
  }, [virtualCandidates])

  useEffect(() => {
    const map = mapRef.current

    if (!import.meta.env.DEV || !map) {
      return
    }

    const startedAt = performance.now()
    const syncDurationMilliseconds = syncSameComponentShortcutDebugLayer(
      map,
      renderedShortcutDebugData,
      displayedSelectedShortcutFeature,
    )

    map.once('render', () => {
      console.debug('[RuteApp] Shortcut-kartlag rendret', {
        candidates: renderedShortcutDebugData.features.length,
        syncDurationMilliseconds,
        firstRenderDurationMilliseconds: performance.now() - startedAt,
      })
    })
  }, [displayedSelectedShortcutFeature, renderedShortcutDebugData])

  useEffect(() => {
    const map = mapRef.current

    if (map) {
      syncRouteResultLine(map, routeSegments)
    }
  }, [routeSegments])

  useEffect(() => {
    const map = mapRef.current

    if (import.meta.env.DEV && map) {
      syncRouteSnapDebugLayer(map, snapDebugConnections)
    }
  }, [snapDebugConnections])

  const handleProfileChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const profile = mapProfiles.find(({ id }) => id === event.target.value)

    if (!profile || !mapRef.current) {
      return
    }

    activeProfileRef.current = profile
    setActiveProfileId(profile.id)
    mapRef.current.setStyle(profile.style, { diff: false })
  }

  const handleShortcutDisplayLimitChange = (
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    const value = event.target.value
    setShortcutDisplayLimit(value === 'all' ? 'all' : Number(value) as 20 | 50 | 100)
  }

  const focusShortcutCandidate = (
    feature: SameComponentShortcutDebugFeature,
  ) => {
    const map = mapRef.current

    if (!map) {
      return
    }

    setShortcutDebugEnabled(true)
    setSelectedShortcutCandidateId(feature.properties.candidateId)
    setShortcutSearchValue(feature.properties.shortcutId)
    setShortcutLookupMessage(undefined)
    shortcutDebugDataRef.current = includeSelectedSameComponentShortcut(
      shortcutDebugDataRef.current,
      feature,
    )
    selectedShortcutFeatureRef.current = feature

    const routingProfile = mapProfiles.find(({ id }) => id === 'ruteapp-routing')

    if (routingProfile && activeProfileRef.current.id !== routingProfile.id) {
      activeProfileRef.current = routingProfile
      setActiveProfileId(routingProfile.id)
      map.setStyle(routingProfile.style, { diff: false })
    }

    const [from, to] = feature.geometry.coordinates
    map.fitBounds([from, to], {
      padding: 100,
      maxZoom: 16,
      duration: 600,
    })
    showSameComponentShortcutPopup(map, feature)
  }

  const handleShortcutLookup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const feature = findSameComponentShortcutById(
      shortcutDebugData,
      shortcutSearchValue,
    )

    if (!feature) {
      setShortcutLookupMessage('Kandidat ikke funnet')
      return
    }

    focusShortcutCandidate(feature)
  }

  const handleShortcutNavigation = (direction: -1 | 1) => {
    const candidates = visibleShortcutDebugData.features

    if (candidates.length === 0) {
      return
    }

    const currentIndex = selectedShortcutFeature
      ? candidates.findIndex(
          ({ properties }) =>
            properties.candidateId ===
            selectedShortcutFeature.properties.candidateId,
        )
      : -1
    const nextIndex =
      currentIndex < 0
        ? direction > 0
          ? 0
          : candidates.length - 1
        : (currentIndex + direction + candidates.length) % candidates.length

    focusShortcutCandidate(candidates[nextIndex])
  }

  const handleZoomToShortcutReference = () => {
    const feature = findSameComponentShortcutById(
      shortcutDebugData,
      knownShortcutReferenceCandidateId,
    )

    if (feature) {
      focusShortcutCandidate(feature)
    }
  }

  return (
    <div className="map-view-shell">
      <div
        ref={mapContainerRef}
        className="map-view"
        role="region"
        aria-label="Interaktivt topografisk kart"
      />

      <label className="map-profile-control">
        <span>Kartprofil</span>
        <select value={activeProfileId} onChange={handleProfileChange}>
          {mapProfiles.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>

      {import.meta.env.DEV ? (
        <fieldset className="shortcut-debug-control">
          <legend>Same-component shortcuts</legend>

          <label className="shortcut-debug-toggle">
            <input
              type="checkbox"
              checked={shortcutDebugEnabled}
              onChange={(event) =>
                setShortcutDebugEnabled(event.target.checked)
              }
            />
            Vis kandidater
          </label>

          <label>
            <span>Antall</span>
            <select
              value={shortcutDisplayLimit}
              disabled={!shortcutDebugEnabled}
              onChange={handleShortcutDisplayLimitChange}
            >
              <option value={20}>Topp 20</option>
              <option value={50}>Topp 50</option>
              <option value={100}>Topp 100</option>
              <option value="all">Alle</option>
            </select>
          </label>

          <label>
            <span>Minimum ratio</span>
            <input
              type="number"
              min="0"
              step="1"
              value={minimumShortcutRatio}
              disabled={!shortcutDebugEnabled}
              onChange={(event) =>
                setMinimumShortcutRatio(Number(event.target.value))
              }
            />
          </label>

          <label>
            <span>Maks direkte (m)</span>
            <input
              type="number"
              min="0"
              step="10"
              value={maximumShortcutDistance}
              disabled={!shortcutDebugEnabled}
              onChange={(event) =>
                setMaximumShortcutDistance(Number(event.target.value))
              }
            />
          </label>

          <form
            className="shortcut-debug-search"
            onSubmit={handleShortcutLookup}
          >
            <label htmlFor="shortcut-candidate-id">Kandidat-ID</label>
            <div>
              <input
                id="shortcut-candidate-id"
                type="text"
                value={shortcutSearchValue}
                placeholder="SC-XXXXXXXX"
                autoComplete="off"
                disabled={shortcutDebugStatus !== 'loaded'}
                onChange={(event) => {
                  setShortcutSearchValue(event.target.value)
                  setShortcutLookupMessage(undefined)
                }}
              />
              <button type="submit" disabled={shortcutDebugStatus !== 'loaded'}>
                Finn
              </button>
            </div>
          </form>

          <div className="shortcut-debug-navigation">
            <button
              type="button"
              disabled={visibleShortcutDebugData.features.length === 0}
              onClick={() => handleShortcutNavigation(-1)}
            >
              Forrige
            </button>
            <button
              type="button"
              disabled={visibleShortcutDebugData.features.length === 0}
              onClick={() => handleShortcutNavigation(1)}
            >
              Neste
            </button>
          </div>

          {shortcutLookupMessage ? (
            <small className="shortcut-debug-message" role="status">
              {shortcutLookupMessage}
            </small>
          ) : selectedShortcutFeature ? (
            <small className="shortcut-debug-selection">
              {selectedShortcutIndex >= 0
                ? `Kandidat ${selectedShortcutIndex + 1} av ${visibleShortcutDebugData.features.length}`
                : 'Valgt kandidat er utenfor gjeldende filter'}
            </small>
          ) : null}

          <button
            type="button"
            disabled={shortcutDebugStatus !== 'loaded'}
            onClick={handleZoomToShortcutReference}
          >
            Zoom til referansecase
          </button>

          <small>
            {shortcutDebugStatus === 'loaded'
              ? `Viser ${visibleShortcutDebugData.features.length} av ${shortcutDebugData.features.length}`
              : shortcutDebugStatus === 'error'
                ? 'Kandidatdata mangler – kjør diagnostikkscriptet.'
                : 'Laster kandidatdata…'}
          </small>
        </fieldset>
      ) : null}
    </div>
  )
}

function getRoleName(role: 'start' | 'via' | 'end') {
  if (role === 'start') {
    return 'Startpunkt A'
  }

  if (role === 'end') {
    return 'Målpunkt B'
  }

  return 'Mellompunkt'
}

export default MapView
