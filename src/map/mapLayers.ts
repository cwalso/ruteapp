import type { MapOptions } from 'maplibre-gl'

type MapStyle = Exclude<MapOptions['style'], string | null | undefined>
type MapSource = MapStyle['sources'][string]
type MapLayer = MapStyle['layers'][number]

const KARTVERKET_ATTRIBUTION = '© Kartverket'
const KARTVERKET_WMTS_BASE_URL =
  'https://cache.kartverket.no/v1/wmts/1.0.0'
const KARTVERKET_WMTS_MAX_ZOOM = 18

export type MapLayerCategory = 'background' | 'thematic'

export type MapLayerConfig = {
  name: string
  category: MapLayerCategory
  source?: {
    id: string
    definition: MapSource
  }
  layer: MapLayer
}

export const kartverketToporaster = {
  name: 'Kartverket toporaster',
  category: 'background',
  source: {
    id: 'kartverket-toporaster-source',
    definition: {
      type: 'raster',
      tiles: [
        `${KARTVERKET_WMTS_BASE_URL}/toporaster/default/webmercator/{z}/{y}/{x}.png`,
      ],
      tileSize: 256,
      maxzoom: KARTVERKET_WMTS_MAX_ZOOM,
      attribution: KARTVERKET_ATTRIBUTION,
    },
  },
  layer: {
    id: 'kartverket-toporaster',
    type: 'raster',
    source: 'kartverket-toporaster-source',
  },
} satisfies MapLayerConfig

export const kartverketTopo = {
  name: 'Kartverket Topografisk norgeskart',
  category: 'background',
  source: {
    id: 'kartverket-topo-source',
    definition: {
      type: 'raster',
      tiles: [
        `${KARTVERKET_WMTS_BASE_URL}/topo/default/webmercator/{z}/{y}/{x}.png`,
      ],
      tileSize: 256,
      maxzoom: KARTVERKET_WMTS_MAX_ZOOM,
      attribution: KARTVERKET_ATTRIBUTION,
    },
  },
  layer: {
    id: 'kartverket-topo',
    type: 'raster',
    source: 'kartverket-topo-source',
  },
} satisfies MapLayerConfig

export const kartverketTopoGraatone = {
  name: 'Kartverket Topografisk gråtonekart',
  category: 'background',
  source: {
    id: 'kartverket-topograatone-source',
    definition: {
      type: 'raster',
      tiles: [
        `${KARTVERKET_WMTS_BASE_URL}/topograatone/default/webmercator/{z}/{y}/{x}.png`,
      ],
      tileSize: 256,
      maxzoom: KARTVERKET_WMTS_MAX_ZOOM,
      attribution: KARTVERKET_ATTRIBUTION,
    },
  },
  layer: {
    id: 'kartverket-topograatone',
    type: 'raster',
    source: 'kartverket-topograatone-source',
  },
} satisfies MapLayerConfig

export const kartverketFotrute = {
  name: 'Kartverket Turrutebase – Fotrute',
  category: 'thematic',
  source: {
    id: 'kartverket-fotrute-source',
    definition: {
      type: 'raster',
      tiles: [
        'https://wms.geonorge.no/skwms1/wms.friluftsruter2?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=Fotrute&STYLES=&FORMAT=image%2Fpng&TRANSPARENT=TRUE&SRS=EPSG%3A3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256',
      ],
      tileSize: 256,
      attribution: KARTVERKET_ATTRIBUTION,
    },
  },
  layer: {
    id: 'kartverket-fotrute',
    type: 'raster',
    source: 'kartverket-fotrute-source',
  },
} satisfies MapLayerConfig
