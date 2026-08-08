import { useEffect, useRef, useState, type ChangeEvent } from 'react'
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
import './MapView.css'

setWorkerUrl(workerUrl)

type MapViewProps = {
  routePoints: readonly RoutePoint[]
  onAddPoint: (position: RoutePointPosition) => void
  onMovePoint: (pointId: string, position: RoutePointPosition) => void
  onRemovePoint: (pointId: string) => void
}

function MapView({
  routePoints,
  onAddPoint,
  onMovePoint,
  onRemovePoint,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap>(null)
  const routeMarkersRef = useRef(new globalThis.Map<string, Marker>())
  const routePointsRef = useRef(routePoints)
  const onAddPointRef = useRef(onAddPoint)
  const onMovePointRef = useRef(onMovePoint)
  const onRemovePointRef = useRef(onRemovePoint)
  const activeProfileRef = useRef<MapProfile>(defaultMapProfile)
  const [activeProfileId, setActiveProfileId] = useState(defaultMapProfile.id)

  useEffect(() => {
    routePointsRef.current = routePoints
    onAddPointRef.current = onAddPoint
    onMovePointRef.current = onMovePoint
    onRemovePointRef.current = onRemovePoint
  }, [routePoints, onAddPoint, onMovePoint, onRemovePoint])

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
      restoreRoutePlanningLine(map, routePointsRef.current)
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

    map.on('click', ({ lngLat, originalEvent }) => {
      if (mapWasDragged || originalEvent.button !== 0) {
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
      element.title = `${getRoleName(role.kind)} – dra for å flytte, høyreklikk for å fjerne`
      element.setAttribute('aria-label', element.title)
      marker.setLngLat([point.longitude, point.latitude])
    })

    syncRoutePlanningLine(map, routePoints)
  }, [routePoints])

  const handleProfileChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const profile = mapProfiles.find(({ id }) => id === event.target.value)

    if (!profile || !mapRef.current) {
      return
    }

    activeProfileRef.current = profile
    setActiveProfileId(profile.id)
    mapRef.current.setStyle(profile.style)
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
