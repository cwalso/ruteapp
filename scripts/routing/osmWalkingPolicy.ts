import type { EdgeType } from '../../src/routing/routingTypes.ts'

export type OrdinaryEdgeType = Exclude<EdgeType, 'virtual'>

export const CURRENT_HIGHWAY_EDGE_TYPES: Readonly<
  Record<string, OrdinaryEdgeType>
> = {
  path: 'path',
  footway: 'path',
  pedestrian: 'path',
  steps: 'path',
  track: 'track',
  service: 'road',
  secondary: 'road',
  unclassified: 'road',
  residential: 'road',
  living_street: 'road',
}

export const AUDIT_ADDITIONAL_HIGHWAY_EDGE_TYPES: Readonly<
  Record<string, OrdinaryEdgeType>
> = {
  primary: 'road',
  tertiary: 'road',
  primary_link: 'road',
  secondary_link: 'road',
  tertiary_link: 'road',
  bridleway: 'path',
  cycleway: 'path',
}

export const AUDIT_EXPANDED_HIGHWAY_EDGE_TYPES: Readonly<
  Record<string, OrdinaryEdgeType>
> = {
  ...CURRENT_HIGHWAY_EDGE_TYPES,
  ...AUDIT_ADDITIONAL_HIGHWAY_EDGE_TYPES,
}

const RESTRICTED_ACCESS = new Set(['no', 'private'])
const EXPLICIT_FOOT_ACCESS = new Set(['yes', 'designated', 'permissive'])
const FORWARD_FOOT_ONEWAY = new Set(['yes', 'true', '1'])

export type FootAccessClassification =
  | 'explicit-allowed'
  | 'explicit-restricted'
  | 'general-restricted'
  | 'implicit-or-unknown'

export function isWalkable(tags: Readonly<Record<string, string>>) {
  const footAccess = tags.foot?.toLowerCase()
  const generalAccess = tags.access?.toLowerCase()

  if (footAccess && RESTRICTED_ACCESS.has(footAccess)) {
    return false
  }

  return !(
    generalAccess &&
    RESTRICTED_ACCESS.has(generalAccess) &&
    (!footAccess || !EXPLICIT_FOOT_ACCESS.has(footAccess))
  )
}

export function classifyFootAccess(
  tags: Readonly<Record<string, string>>,
): FootAccessClassification {
  const footAccess = tags.foot?.toLowerCase()
  const generalAccess = tags.access?.toLowerCase()

  if (footAccess && RESTRICTED_ACCESS.has(footAccess)) {
    return 'explicit-restricted'
  }

  if (footAccess && EXPLICIT_FOOT_ACCESS.has(footAccess)) {
    return 'explicit-allowed'
  }

  if (generalAccess && RESTRICTED_ACCESS.has(generalAccess)) {
    return 'general-restricted'
  }

  return 'implicit-or-unknown'
}

export function getFootDirection(onewayFoot: string | undefined) {
  const normalizedValue = onewayFoot?.toLowerCase()

  if (normalizedValue === '-1') {
    return 'reverse' as const
  }

  if (normalizedValue && FORWARD_FOOT_ONEWAY.has(normalizedValue)) {
    return 'forward' as const
  }

  return 'both' as const
}
