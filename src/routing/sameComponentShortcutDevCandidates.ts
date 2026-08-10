import type { SameComponentShortcutCandidate } from './sameComponentShortcutCandidates'

/**
 * Small precomputed development fixture. These four records were copied from
 * the offline diagnostic output after manual review; the expensive candidate
 * generator is never run by the browser.
 */
export const sameComponentShortcutDevCandidates = [
  {
    candidateId:
      'same-component-shortcut:1446990760:1:f:1.000000:896319498:8:f:1.000000',
    componentId: '10101761308',
    fromEdgeId: '1446990760:1:f',
    toEdgeId: '896319498:8:f',
    fromEdgeType: 'path',
    toEdgeType: 'road',
    fromCoordinate: { longitude: 9.5536718, latitude: 62.7676604 },
    toCoordinate: { longitude: 9.554025, latitude: 62.768411 },
    fromPositionAlongEdge: 1,
    toPositionAlongEdge: 1,
    directDistanceMeters: 85.3759635583369,
    ordinaryNetworkDistanceMeters: 5053.4481759573455,
    networkCost: 5053.4481759573455,
    detourRatio: 59.19052582644474,
  },
  {
    candidateId:
      'same-component-shortcut:313417840:16:f:0.479781:313455450:13:f:0.000000',
    componentId: '10004160051',
    fromEdgeId: '313417840:16:f',
    toEdgeId: '313455450:13:f',
    fromEdgeType: 'path',
    toEdgeType: 'path',
    fromCoordinate: {
      longitude: 9.59255579306355,
      latitude: 62.80356487869224,
    },
    toCoordinate: { longitude: 9.592808, latitude: 62.8032139 },
    fromPositionAlongEdge: 0.479781,
    toPositionAlongEdge: 0,
    directDistanceMeters: 41.07799934213633,
    ordinaryNetworkDistanceMeters: 3695.861370392125,
    networkCost: 3695.861370392125,
    detourRatio: 89.97179584160136,
  },
  {
    candidateId:
      'same-component-shortcut:313417840:15:f:1.000000:313455450:14:f:0.000000',
    componentId: '10004160051',
    fromEdgeId: '313417840:15:f',
    toEdgeId: '313455450:14:f',
    fromEdgeType: 'path',
    toEdgeType: 'path',
    fromCoordinate: { longitude: 9.5915667, latitude: 62.8034162 },
    toCoordinate: { longitude: 9.5924923, latitude: 62.8031258 },
    fromPositionAlongEdge: 1,
    toPositionAlongEdge: 0,
    directDistanceMeters: 57.05699075745069,
    ordinaryNetworkDistanceMeters: 3661.7445252434068,
    networkCost: 3661.7445252434068,
    detourRatio: 64.17696546264568,
  },
  {
    candidateId:
      'same-component-shortcut:1467835568:1:f:1.000000:739632975:2:f:0.474119',
    componentId: '10004160051',
    fromEdgeId: '1467835568:1:f',
    toEdgeId: '739632975:2:f',
    fromEdgeType: 'road',
    toEdgeType: 'road',
    fromCoordinate: { longitude: 9.6032752, latitude: 62.7817504 },
    toCoordinate: {
      longitude: 9.603852359436265,
      latitude: 62.78197269095832,
    },
    fromPositionAlongEdge: 1,
    toPositionAlongEdge: 0.474119,
    directDistanceMeters: 38.374254153368526,
    ordinaryNetworkDistanceMeters: 2597.7663856632453,
    networkCost: 2597.7663856632453,
    detourRatio: 67.69555377626045,
  },
] as const satisfies readonly SameComponentShortcutCandidate[]
