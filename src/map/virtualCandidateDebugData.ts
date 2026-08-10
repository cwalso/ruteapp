import type { VirtualConnectionCandidate } from '../routing/virtualConnections'

export type VirtualCandidateDistanceCategory =
  | '0-50'
  | '50-100'
  | '100-150'
  | '150-200'

export type VirtualCandidateDebugProperties = {
  candidateId: string
  distanceMeters: number
  distanceCategory: VirtualCandidateDistanceCategory
  componentA: string
  componentB: string
  edgeA: string
  edgeB: string
  longitudeA: number
  latitudeA: number
  longitudeB: number
  latitudeB: number
}

export function createVirtualCandidateDebugData(
  candidates: readonly VirtualConnectionCandidate[],
) {
  const candidateIds = new Set<string>()
  const features = candidates.map((candidate) => {
    const candidateId = createVirtualCandidateDebugId(candidate)

    if (candidateIds.has(candidateId)) {
      throw new Error(`Duplicate virtual candidate debug id: ${candidateId}`)
    }
    candidateIds.add(candidateId)

    const properties: VirtualCandidateDebugProperties = {
      candidateId,
      distanceMeters: candidate.distanceMeters,
      distanceCategory: getDistanceCategory(candidate.distanceMeters),
      componentA: candidate.componentIds[0],
      componentB: candidate.componentIds[1],
      edgeA: candidate.from.edgeId,
      edgeB: candidate.to.edgeId,
      longitudeA: candidate.from.position.longitude,
      latitudeA: candidate.from.position.latitude,
      longitudeB: candidate.to.position.longitude,
      latitudeB: candidate.to.position.latitude,
    }

    return {
      type: 'Feature' as const,
      id: candidateId,
      properties,
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [properties.longitudeA, properties.latitudeA],
          [properties.longitudeB, properties.latitudeB],
        ],
      },
    }
  })

  return {
    type: 'FeatureCollection' as const,
    features,
  }
}

export function createVirtualCandidateDebugId(
  candidate: VirtualConnectionCandidate,
) {
  const signature = [
    ...candidate.componentIds,
    candidate.from.edgeId,
    candidate.from.positionAlongEdge.toFixed(12),
    candidate.from.position.longitude.toFixed(12),
    candidate.from.position.latitude.toFixed(12),
    candidate.to.edgeId,
    candidate.to.positionAlongEdge.toFixed(12),
    candidate.to.position.longitude.toFixed(12),
    candidate.to.position.latitude.toFixed(12),
  ].join('\u0000')

  return `VC-${fnv1a32(signature).toString(16).padStart(8, '0').toUpperCase()}`
}

function getDistanceCategory(
  distanceMeters: number,
): VirtualCandidateDistanceCategory {
  if (distanceMeters < 50) {
    return '0-50'
  }

  if (distanceMeters < 100) {
    return '50-100'
  }

  if (distanceMeters < 150) {
    return '100-150'
  }

  return '150-200'
}

function fnv1a32(value: string) {
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}
