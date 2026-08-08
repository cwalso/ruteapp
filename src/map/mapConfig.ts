import type { MapOptions } from 'maplibre-gl'
import { activeMapLayers } from './mapLayers'

const NERSKOGEN_CENTER: [number, number] = [9.6012, 62.7802]

export const mapConfig = {
  center: NERSKOGEN_CENTER,
  zoom: 12.5,
  style: {
    version: 8,
    sources: Object.fromEntries(
      activeMapLayers.map(({ source }) => [source.id, source.definition]),
    ),
    layers: activeMapLayers.map(({ layer }) => layer),
  },
} satisfies Pick<MapOptions, 'center' | 'zoom' | 'style'>
