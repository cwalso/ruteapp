import type { MapOptions } from 'maplibre-gl'

const KARTVERKET_TILE_URL =
  'https://cache.kartverket.no/v1/wmts/1.0.0/toporaster/default/webmercator/{z}/{y}/{x}.png'

const KARTVERKET_ATTRIBUTION = '© Kartverket'

export const mapConfig = {
  center: [10.4, 63.43] as [number, number],
  zoom: 9,
  style: {
    version: 8,
    sources: {
      kartverketToporaster: {
        type: 'raster',
        tiles: [KARTVERKET_TILE_URL],
        tileSize: 256,
        attribution: KARTVERKET_ATTRIBUTION,
      },
    },
    layers: [
      {
        id: 'kartverket-toporaster',
        type: 'raster',
        source: 'kartverketToporaster',
      },
    ],
  },
} satisfies Pick<MapOptions, 'center' | 'zoom' | 'style'>
