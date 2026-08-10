import type { ElevationProfile } from '../../elevation/elevationTypes'
import { formatDistance } from './routePlanning'

type ElevationProfileChartProps = {
  profile: ElevationProfile
}

const chartWidth = 360
const chartHeight = 164
const chartPadding = {
  top: 14,
  right: 12,
  bottom: 30,
  left: 42,
}

function ElevationProfileChart({ profile }: ElevationProfileChartProps) {
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom
  const elevationRange = Math.max(
    1,
    profile.maxElevationMeters - profile.minElevationMeters,
  )
  const distanceRange = Math.max(1, profile.totalDistanceMeters)
  const points = profile.samples
    .map(({ distanceFromStartMeters, elevationMeters }) => {
      const x =
        chartPadding.left +
        (distanceFromStartMeters / distanceRange) * plotWidth
      const y =
        chartPadding.top +
        ((profile.maxElevationMeters - elevationMeters) / elevationRange) *
          plotHeight

      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const plotBottom = chartPadding.top + plotHeight
  const areaPoints = `${chartPadding.left},${plotBottom} ${points} ${chartPadding.left + plotWidth},${plotBottom}`
  const pointCoordinates = points.split(' ')
  const startPoint =
    pointCoordinates[0] ?? `${chartPadding.left},${plotBottom}`
  const endPoint =
    pointCoordinates[pointCoordinates.length - 1] ?? startPoint
  const [startX, startY] = startPoint.split(',').map(Number)
  const [endX, endY] = endPoint.split(',').map(Number)

  return (
    <figure className="elevation-profile">
      <figcaption>
        <span>Høydeprofil</span>
        <span>
          {Math.round(profile.minElevationMeters)}–
          {Math.round(profile.maxElevationMeters)} moh.
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label={`Høydeprofil fra ${Math.round(profile.minElevationMeters)} til ${Math.round(profile.maxElevationMeters)} meter over havet`}
      >
        <line
          className="elevation-profile__axis"
          x1={chartPadding.left}
          y1={chartPadding.top}
          x2={chartPadding.left}
          y2={chartPadding.top + plotHeight}
        />
        <line
          className="elevation-profile__axis"
          x1={chartPadding.left}
          y1={chartPadding.top + plotHeight}
          x2={chartPadding.left + plotWidth}
          y2={chartPadding.top + plotHeight}
        />
        <polygon className="elevation-profile__area" points={areaPoints} />
        <polyline className="elevation-profile__line" points={points} />
        <circle
          className="elevation-profile__point"
          cx={startX}
          cy={startY}
          r="3"
        />
        <circle
          className="elevation-profile__point elevation-profile__point--end"
          cx={endX}
          cy={endY}
          r="3"
        />
        <text
          className="elevation-profile__label"
          x={chartPadding.left - 5}
          y={chartPadding.top + 4}
          textAnchor="end"
        >
          {Math.round(profile.maxElevationMeters)} m
        </text>
        <text
          className="elevation-profile__label"
          x={chartPadding.left - 5}
          y={chartPadding.top + plotHeight}
          textAnchor="end"
        >
          {Math.round(profile.minElevationMeters)} m
        </text>
        <text
          className="elevation-profile__label"
          x={chartPadding.left}
          y={chartHeight - 5}
        >
          Start
        </text>
        <text
          className="elevation-profile__label"
          x={chartPadding.left + plotWidth}
          y={chartHeight - 5}
          textAnchor="end"
        >
          Mål · {formatDistance(profile.totalDistanceMeters)}
        </text>
      </svg>
    </figure>
  )
}

export default ElevationProfileChart
