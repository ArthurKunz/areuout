'use client'

// Google/Material's balloon-pin outline: a circle (centred at 12,9, radius 7)
// that curves smoothly into a point at (12,22) — one continuous path, not a
// circle plus a separate triangle, so there is no seam between the two.
const PIN_PATH = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z'
const CIRCLE_CENTER = { x: 12, y: 9 }
const CIRCLE_RADIUS = 7
const PATH_WIDTH = 14 // x: 5 to 19
const PATH_HEIGHT = 20 // y: 2 to 22
const BORDER_WIDTH = 2.5
const ACTIVE_CIRCLE_SIZE = 75

// A party's marker on the map: 45x45 circle normally, a 75px balloon pin with
// a smooth tail once that party is the selected one.
export default function PartyMapPin({
  imageUrl,
  alt,
  active = false,
}: {
  imageUrl: string
  alt: string
  active?: boolean
}) {
  if (!active) {
    return (
      <div className='h-[45px] w-[45px] shrink-0 overflow-hidden rounded-full border-[2.5px] border-pin-border'>
        <img src={imageUrl} alt={alt} className='h-full w-full object-cover' />
      </div>
    )
  }

  const scale = ACTIVE_CIRCLE_SIZE / PATH_WIDTH
  const height = PATH_HEIGHT * scale
  const innerRadius = CIRCLE_RADIUS - BORDER_WIDTH / scale

  return (
    <svg
      width={ACTIVE_CIRCLE_SIZE}
      height={height}
      viewBox='5 2 14 20'
      role='img'
      aria-label={alt}
      className='shrink-0'
    >
      <defs>
        <clipPath id='party-pin-photo'>
          <circle cx={CIRCLE_CENTER.x} cy={CIRCLE_CENTER.y} r={innerRadius} />
        </clipPath>
      </defs>
      <path d={PIN_PATH} className='fill-pin-border' />
      <image
        href={imageUrl}
        x={CIRCLE_CENTER.x - innerRadius}
        y={CIRCLE_CENTER.y - innerRadius}
        width={innerRadius * 2}
        height={innerRadius * 2}
        clipPath='url(#party-pin-photo)'
        preserveAspectRatio='xMidYMid slice'
      />
    </svg>
  )
}
