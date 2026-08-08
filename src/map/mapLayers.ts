import type { MapOptions } from 'maplibre-gl'

type MapStyle = Exclude<MapOptions['style'], string | null | undefined>
type MapSource = MapStyle['sources'][string]
type MapLayer = MapStyle['layers'][number]

export type MapLayerCategory = 'background' | 'thematic'

export type MapLayerConfig = {
  name: string
  category: MapLayerCategory
  source: {
    id: string
    definition: MapSource
  }
  layer: MapLayer
}

const kartverketToporaster = {
  name: 'Kartverket toporaster',
  category: 'background',
  source: {
    id: 'kartverket-toporaster-source',
    definition: {
      type: 'raster',
      tiles: [
        'https://cache.kartverket.no/v1/wmts/1.0.0/toporaster/default/webmercator/{z}/{y}/{x}.png',
      ],
      tileSize: 256,
      attribution: '© Kartverket',
    },
  },
  layer: {
    id: 'kartverket-toporaster',
    type: 'raster',
    source: 'kartverket-toporaster-source',
  },
} satisfies MapLayerConfig

export const activeMapLayers: readonly MapLayerConfig[] = [
  kartverketToporaster,
]
