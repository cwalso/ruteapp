import type { SameComponentShortcutConfig } from './sameComponentShortcutCandidates'

export const sameComponentShortcutConfig = {
  minimumDirectDistanceMeters: 10,
  maximumDirectDistanceMeters: 200,
  minimumOrdinaryNetworkDistanceMeters: 500,
  minimumDetourRatio: 5,
  deduplicationRadiusMeters: 30,
} satisfies SameComponentShortcutConfig
