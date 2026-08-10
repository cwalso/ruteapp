import type { Map, MapOptions } from 'maplibre-gl'
import {
  kartverketFotrute,
  kartverketTopo,
  kartverketTopoGraatone,
  kartverketToporaster,
  type MapLayerConfig,
} from './mapLayers'

type MapStyle = Exclude<MapOptions['style'], string | null | undefined>

type ProfileLayer = {
  config: MapLayerConfig
  beforeLayerId?: string
}

export type MapProfile = {
  id: string
  name: string
  style: MapStyle
  layers: readonly ProfileLayer[]
  showRoutableNetwork?: boolean
}

const createEmptyStyle = (profileId: string) =>
  ({
    version: 8,
    metadata: {
      'ruteapp:profile': profileId,
    },
    sources: {},
    layers: [],
  }) satisfies MapStyle

export const mapProfiles: readonly MapProfile[] = [
  {
    id: 'kartverket',
    name: 'Kartverket Turkart',
    style: createEmptyStyle('kartverket'),
    layers: [
      { config: kartverketToporaster },
      { config: kartverketFotrute },
    ],
  },
  {
    id: 'kartverket-topo',
    name: 'Kartverket Topo',
    style: createEmptyStyle('kartverket-topo'),
    layers: [
      { config: kartverketTopo },
      { config: kartverketFotrute },
    ],
  },
  {
    id: 'kartverket-topograatone',
    name: 'Kartverket Topo gråtone',
    style: createEmptyStyle('kartverket-topograatone'),
    layers: [
      { config: kartverketTopoGraatone },
      { config: kartverketFotrute },
    ],
  },
  {
    id: 'ruteapp-routing',
    name: 'RuteApp Routing',
    style: createEmptyStyle('ruteapp-routing'),
    layers: [{ config: kartverketTopo }],
    showRoutableNetwork: true,
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
