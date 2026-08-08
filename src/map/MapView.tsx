import { useEffect, useRef } from 'react'
import { Map, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { mapConfig } from './mapConfig'
import './MapView.css'

setWorkerUrl(workerUrl)

function MapView() {
  const mapContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = mapContainerRef.current

    if (!container) {
      return
    }

    const map = new Map({
      container,
      ...mapConfig,
      attributionControl: {},
    })

    map.addControl(new NavigationControl(), 'top-right')

    return () => {
      map.remove()
    }
  }, [])

  return (
    <div
      ref={mapContainerRef}
      className="map-view"
      role="region"
      aria-label="Interaktivt topografisk kart"
    />
  )
}

export default MapView
