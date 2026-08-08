import type { Map, MapOptions } from 'maplibre-gl'
import {
  kartverketFotrute,
  kartverketToporaster,
  summerHillshade,
  summerPath,
  summerTrack,
  type MapLayerConfig,
} from './mapLayers'

type MapStyle = Exclude<MapOptions['style'], null | undefined>

type ProfileLayer = {
  config: MapLayerConfig
  beforeLayerId?: string
}

export type MapProfile = {
  id: string
  name: string
  style: MapStyle
  layers: readonly ProfileLayer[]
}

const EMPTY_STYLE = {
  version: 8,
  sources: {},
  layers: [],
} satisfies MapStyle

const LABEL_LAYER_ID = 'waterway_line_label'

export const mapProfiles: readonly MapProfile[] = [
  {
    id: 'summer',
    name: 'RuteApp Sommer',
    style: 'https://tiles.openfreemap.org/styles/positron',
    layers: [
      { config: summerHillshade, beforeLayerId: 'highway_path' },
      { config: kartverketFotrute, beforeLayerId: LABEL_LAYER_ID },
      { config: summerTrack, beforeLayerId: LABEL_LAYER_ID },
      { config: summerPath, beforeLayerId: LABEL_LAYER_ID },
    ],
  },
  {
    id: 'kartverket',
    name: 'Kartverket Turkart',
    style: EMPTY_STYLE,
    layers: [
      { config: kartverketToporaster },
      { config: kartverketFotrute },
    ],
  },
]

export const defaultMapProfile = mapProfiles[0]

export function addMapProfileLayers(map: Map, profile: MapProfile) {
  for (const { config, beforeLayerId } of profile.layers) {
    if (config.source && !map.getSource(config.source.id)) {
      map.addSource(config.source.id, config.source.definition)
    }

    if (!map.getLayer(config.layer.id)) {
      const existingBeforeLayer =
        beforeLayerId && map.getLayer(beforeLayerId) ? beforeLayerId : undefined

      map.addLayer(config.layer, existingBeforeLayer)
    }
  }
}
