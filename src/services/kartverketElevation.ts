import type {
  ElevationSampleLocation,
  ElevationService,
} from '../elevation/elevationTypes'

const KARTVERKET_ELEVATION_ENDPOINT =
  'https://ws.geonorge.no/hoydedata/v1/punkt'
const KARTVERKET_COORDINATE_SYSTEM = '4326'
const MAX_POINTS_PER_REQUEST = 50
const coordinateTolerance = 1e-7

type FetchFunction = (
  input: string,
  init?: RequestInit,
) => Promise<Response>

type KartverketElevationPoint = {
  x: number
  y: number
  z: number
}

export class KartverketElevationService implements ElevationService {
  private readonly elevationCache = new Map<string, number>()
  private readonly fetchFunction: FetchFunction

  constructor(fetchFunction: FetchFunction = fetch) {
    // Keep the browser's global fetch as a plain function call. Calling a
    // stored native fetch as `this.fetchFunction(...)` gives it this service
    // instance as receiver and causes "Illegal invocation" in Chromium.
    this.fetchFunction = (input, init) => fetchFunction(input, init)
  }

  async getElevations(
    locations: readonly ElevationSampleLocation[],
    signal: AbortSignal,
  ) {
    const uniqueUncachedLocations = new Map<string, ElevationSampleLocation>()

    for (const location of locations) {
      const key = createCoordinateKey(location)

      if (!this.elevationCache.has(key)) {
        uniqueUncachedLocations.set(key, location)
      }
    }

    const uncachedLocations = [...uniqueUncachedLocations.values()]

    for (
      let startIndex = 0;
      startIndex < uncachedLocations.length;
      startIndex += MAX_POINTS_PER_REQUEST
    ) {
      signal.throwIfAborted()
      const batch = uncachedLocations.slice(
        startIndex,
        startIndex + MAX_POINTS_PER_REQUEST,
      )
      const points = await this.fetchBatch(batch, signal)
      signal.throwIfAborted()

      for (const [pointIndex, point] of points.entries()) {
        this.elevationCache.set(
          createCoordinateKey(batch[pointIndex]),
          point.z,
        )
      }
    }

    return locations.map((location) => {
      const elevation = this.elevationCache.get(createCoordinateKey(location))

      if (elevation === undefined) {
        throw new Error('Kartverket returned no elevation for a route sample')
      }

      return elevation
    })
  }

  private async fetchBatch(
    locations: readonly ElevationSampleLocation[],
    signal: AbortSignal,
  ) {
    const url = new URL(KARTVERKET_ELEVATION_ENDPOINT)
    url.searchParams.set('koordsys', KARTVERKET_COORDINATE_SYSTEM)
    url.searchParams.set(
      'punkter',
      JSON.stringify(
        locations.map(({ longitude, latitude }) => [longitude, latitude]),
      ),
    )

    if (import.meta.env.DEV) {
      console.debug('[RuteApp][Elevation] request batch', {
        pointCount: locations.length,
        coordinateSystem: Number(KARTVERKET_COORDINATE_SYSTEM),
        firstCoordinate: locations[0]
          ? [locations[0].longitude, locations[0].latitude]
          : undefined,
      })
    }

    const response = await this.fetchFunction(url.toString(), {
      headers: { Accept: 'application/json' },
      signal,
    })

    if (import.meta.env.DEV) {
      console.debug('[RuteApp][Elevation] response received', {
        status: response.status,
        pointCount: locations.length,
      })
    }

    if (!response.ok) {
      throw new Error(
        `Kartverket elevation request failed: ${response.status}`,
      )
    }

    const points = parseKartverketElevationResponse(await response.json())

    if (
      points.length !== locations.length ||
      points.some(
        (point, index) =>
          Math.abs(point.x - locations[index].longitude) >
            coordinateTolerance ||
          Math.abs(point.y - locations[index].latitude) > coordinateTolerance,
      )
    ) {
      throw new Error('Kartverket elevation response does not match the request')
    }

    return points
  }
}

export const kartverketElevationService = new KartverketElevationService()

export function parseKartverketElevationResponse(
  value: unknown,
): KartverketElevationPoint[] {
  if (!isRecord(value) || !Array.isArray(value.punkter)) {
    throw new Error('Kartverket returned an invalid elevation response')
  }

  return value.punkter.map((point) => {
    if (
      !isRecord(point) ||
      typeof point.x !== 'number' ||
      !Number.isFinite(point.x) ||
      typeof point.y !== 'number' ||
      !Number.isFinite(point.y) ||
      typeof point.z !== 'number' ||
      !Number.isFinite(point.z)
    ) {
      throw new Error('Kartverket returned an invalid elevation point')
    }

    return {
      x: point.x,
      y: point.y,
      z: point.z,
    }
  })
}

function createCoordinateKey({
  longitude,
  latitude,
}: {
  longitude: number
  latitude: number
}) {
  return `${longitude.toFixed(7)},${latitude.toFixed(7)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
