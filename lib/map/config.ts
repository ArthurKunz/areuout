// Everything the map loads from outside the repo. The style itself lives in
// lib/map/style.json (OpenFreeMap 'Dark', recoloured to the mockups); only tiles,
// glyphs and sprite come from OpenFreeMap at runtime. If OpenFreeMap fails or gets
// limited, swapping these URLs for another source (MapTiler, Stadia, self-hosted) is
// the whole fallback — see the vault note 'Party Map' section 14.
export const TILE_SOURCE_URL = 'https://tiles.openfreemap.org/planet'
export const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'
export const SPRITE_URL = 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm'

// Leipzig and its surroundings, Brehna in the north to Lucka in the south, as in the
// mockup 'Redesign Explore 01 Collapsed'. South-west then north-east corner. The map
// always starts here, never on the user's location.
export const LEIPZIG_BOUNDS: [[number, number], [number, number]] = [
  [12.2, 51.1],
  [12.56, 51.56],
]
