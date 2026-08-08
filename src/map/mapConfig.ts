import type { MapOptions } from 'maplibre-gl'

const NERSKOGEN_CENTER: [number, number] = [9.6012, 62.7802]

export const mapConfig = {
  center: NERSKOGEN_CENTER,
  zoom: 12.5,
} satisfies Pick<MapOptions, 'center' | 'zoom'>
