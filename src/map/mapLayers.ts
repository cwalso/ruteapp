import type { MapOptions } from 'maplibre-gl'

type MapStyle = Exclude<MapOptions['style'], string | null | undefined>
type MapSource = MapStyle['sources'][string]
type MapLayer = MapStyle['layers'][number]

const KARTVERKET_ATTRIBUTION = '© Kartverket'

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
        'https://cache.kartverket.no/v1/wmts/1.0.0/toporaster/default/webmercator/{z}/{y}/{x}.png',
      ],
      tileSize: 256,
      attribution: KARTVERKET_ATTRIBUTION,
    },
  },
  layer: {
    id: 'kartverket-toporaster',
    type: 'raster',
    source: 'kartverket-toporaster-source',
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

export const summerHillshade = {
  name: 'Mapterhorn hillshade',
  category: 'thematic',
  source: {
    id: 'mapterhorn-hillshade-source',
    definition: {
      type: 'raster-dem',
      url: 'https://tiles.mapterhorn.com/tilejson.json',
    },
  },
  layer: {
    id: 'ruteapp-summer-hillshade',
    type: 'hillshade',
    source: 'mapterhorn-hillshade-source',
    paint: {
      'hillshade-exaggeration': 0.22,
      'hillshade-shadow-color': '#5f5549',
      'hillshade-highlight-color': '#ffffff',
      'hillshade-accent-color': '#776d61',
    },
  },
} satisfies MapLayerConfig

export const summerTrack = {
  name: 'Fremhevede traktorveier',
  category: 'thematic',
  layer: {
    id: 'ruteapp-summer-track',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['==', ['get', 'class'], 'track'],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#a64b37',
      'line-opacity': 0.88,
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10,
        0.8,
        13,
        1.4,
        16,
        2.2,
      ],
    },
  },
} satisfies MapLayerConfig

export const summerPath = {
  name: 'Fremhevede stier',
  category: 'thematic',
  layer: {
    id: 'ruteapp-summer-path',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['==', ['get', 'class'], 'path'],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#d13d57',
      'line-dasharray': [2, 1.5],
      'line-opacity': 0.92,
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10,
        0.7,
        13,
        1.25,
        16,
        1.9,
      ],
    },
  },
} satisfies MapLayerConfig
