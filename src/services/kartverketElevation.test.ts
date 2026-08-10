import { describe, expect, it, vi } from 'vitest'
import type { ElevationSampleLocation } from '../elevation/elevationTypes'
import {
  KartverketElevationService,
  parseKartverketElevationResponse,
} from './kartverketElevation'

describe('KartverketElevationService', () => {
  it('calls a stored browser-style fetch function without the service as receiver', async () => {
    function receiverSensitiveFetch(this: unknown, input: string) {
      if (this !== undefined) {
        return Promise.reject(new TypeError('Illegal invocation'))
      }

      const coordinates = JSON.parse(
        new URL(input).searchParams.get('punkter') ?? '[]',
      ) as [number, number][]

      return Promise.resolve(
        Response.json({
          koordsys: 4326,
          punkter: coordinates.map(([x, y]) => ({ x, y, z: 725 })),
        }),
      )
    }
    const service = new KartverketElevationService(receiverSensitiveFetch)

    await expect(
      service.getElevations(
        [location(0)],
        new AbortController().signal,
      ),
    ).resolves.toEqual([725])
  })

  it('batches at most 50 points and caches completed samples', async () => {
    const fetchFunction = vi.fn(async (input: string) => {
      const coordinates = JSON.parse(
        new URL(input).searchParams.get('punkter') ?? '[]',
      ) as [number, number][]

      return Response.json({
        koordsys: 4326,
        punkter: coordinates.map(([x, y]) => ({ x, y, z: 700 + x })),
      })
    })
    const service = new KartverketElevationService(fetchFunction)
    const locations = Array.from({ length: 51 }, (_, index) =>
      location(index / 10_000),
    )
    const signal = new AbortController().signal

    const firstResult = await service.getElevations(locations, signal)
    const secondResult = await service.getElevations(locations, signal)

    expect(fetchFunction).toHaveBeenCalledTimes(2)
    expect(firstResult).toHaveLength(51)
    expect(secondResult).toEqual(firstResult)

    const firstRequestUrl = new URL(fetchFunction.mock.calls[0][0])
    const secondRequestUrl = new URL(fetchFunction.mock.calls[1][0])
    const firstRequestCoordinates = JSON.parse(
      firstRequestUrl.searchParams.get('punkter') ?? '[]',
    ) as [number, number][]
    const secondRequestCoordinates = JSON.parse(
      secondRequestUrl.searchParams.get('punkter') ?? '[]',
    ) as [number, number][]

    expect(firstRequestUrl.searchParams.get('koordsys')).toBe('4326')
    expect(firstRequestCoordinates).toHaveLength(50)
    expect(firstRequestCoordinates[0]).toEqual([9.6, 62.78])
    expect(secondRequestCoordinates).toHaveLength(1)
  })

  it('rejects missing and invalid heights in an API response', () => {
    expect(() => parseKartverketElevationResponse({ punkter: [{}] })).toThrow(
      'invalid elevation point',
    )
    expect(() => parseKartverketElevationResponse({})).toThrow(
      'invalid elevation response',
    )
  })
})

function location(longitudeOffset: number): ElevationSampleLocation {
  return {
    longitude: 9.6 + longitudeOffset,
    latitude: 62.78,
    distanceFromStartMeters: longitudeOffset * 100_000,
  }
}
