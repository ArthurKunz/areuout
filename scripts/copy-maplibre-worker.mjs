// Copies maplibre's web worker into public/maplibre/ before every dev and build run.
// Turbopack emits the worker as a hashed asset without its sibling
// maplibre-gl-shared.mjs, so the worker fails on its first import and no tile ever
// loads. Serving both files side by side from public/ is maplibre's documented fix
// for Next.js; components/shell/ShellMap.tsx points setWorkerUrl at the copy.
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const dist = path.join(path.dirname(createRequire(import.meta.url).resolve('maplibre-gl/package.json')), 'dist')
const dest = path.join(process.cwd(), 'public', 'maplibre')

mkdirSync(dest, { recursive: true })
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(path.join(dist, file), path.join(dest, file))
}
