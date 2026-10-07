import { describe, expect, it } from 'vitest'
import type { RoutePoint } from '../../types/routePoint'
import { insertRoutePointBeforeEnd } from './routePlanning'

function point(id: string): RoutePoint {
  return {
    id,
    longitude: 9.6,
    latitude: 62.78,
  }
}

describe('insertRoutePointBeforeEnd', () => {
  it('adds the first two points as A and B', () => {
    const a = point('a')
    const b = point('b')

    expect(insertRoutePointBeforeEnd([], a)).toEqual([a])
    expect(insertRoutePointBeforeEnd([a], b)).toEqual([a, b])
  })

  it('keeps B fixed and inserts later clicks before it', () => {
    const a = point('a')
    const b = point('b')
    const via1 = point('via-1')
    const via2 = point('via-2')

    const withVia1 = insertRoutePointBeforeEnd([a, b], via1)
    const withVia2 = insertRoutePointBeforeEnd(withVia1, via2)

    expect(withVia1.map(({ id }) => id)).toEqual(['a', 'via-1', 'b'])
    expect(withVia2.map(({ id }) => id)).toEqual([
      'a',
      'via-1',
      'via-2',
      'b',
    ])
  })
})
