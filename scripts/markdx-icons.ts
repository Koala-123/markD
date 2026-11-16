/**
 * Regenerates every app icon from brand/markdx-icon.svg.
 *
 *   pnpm exec tsx scripts/markdx-icons.ts
 *
 * The outputs are committed, so this only needs re-running when the SVG
 * changes. `sharp` is resolved from the hoisted root node_modules: it is a
 * transitive dependency of the workspace, not a declared one. The .icns step
 * needs macOS `iconutil` and is skipped elsewhere.
 */
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const desktop = path.join(root, 'packages/desktop')
const svg = fs.readFileSync(path.join(root, 'brand/markdx-icon.svg'))

const png = (size: number): Promise<Buffer> => sharp(svg).resize(size, size).png().toBuffer()

// macOS draws no mask of its own: the artwork has to sit inside Apple's icon
// grid, an 824px body on a 1024px transparent canvas, or it looks oversized
// next to other apps in the Dock.
const macPng = (size: number): Promise<Buffer> => {
  const body = Math.round((size * 824) / 1024)
  const before = Math.floor((size - body) / 2)
  const after = size - body - before
  return sharp(svg)
    .resize(body, body)
    .extend({
      top: before,
      left: before,
      bottom: after,
      right: after,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer()
}

// ICO container with PNG-encoded entries (read by Windows Vista and later).
const ico = async(sizes: number[]): Promise<Buffer> => {
  const images = await Promise.all(sizes.map(png))
  const directory = Buffer.alloc(6 + 16 * sizes.length)
  directory.writeUInt16LE(1, 2) // resource type: icon
  directory.writeUInt16LE(sizes.length, 4)
  let offset = directory.length
  images.forEach((image, i) => {
    const entry = 6 + 16 * i
    directory.writeUInt8(sizes[i] % 256, entry) // width; 256 is stored as 0
    directory.writeUInt8(sizes[i] % 256, entry + 1) // height
    directory.writeUInt16LE(1, entry + 4) // colour planes
    directory.writeUInt16LE(32, entry + 6) // bits per pixel
    directory.writeUInt32LE(image.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += image.length
  })
  return Buffer.concat([directory, ...images])
}

const icns = async(): Promise<Buffer | null> => {
  if (process.platform !== 'darwin') return null
  const iconset = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'markdx-')), 'icon.iconset')
  fs.mkdirSync(iconset)
  for (const size of [16, 32, 128, 256, 512]) {
    fs.writeFileSync(path.join(iconset, `icon_${size}x${size}.png`), await macPng(size))
    fs.writeFileSync(path.join(iconset, `icon_${size}x${size}@2x.png`), await macPng(size * 2))
  }
  const out = path.join(path.dirname(iconset), 'icon.icns')
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', out])
  return fs.readFileSync(out)
}

const main = async(): Promise<void> => {
  const icoSizes = [16, 24, 32, 48, 64, 128, 256]
  const outputs: Record<string, Buffer | null> = {
    'static/icon.png': await png(256),
    'static/logo-96px.png': await png(96),
    'static/logo-small.png': await png(1024),
    'static/icon.ico': await ico(icoSizes),
    'static/icon.icns': await icns(),
    'build/icons/icon.png': await png(1024),
    'build/icons/icon.ico': await ico(icoSizes),
    'build/icons/icon.icns': await icns(),
    'src/renderer/src/assets/images/logo.png': await png(150)
  }
  for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) {
    outputs[`build/icons/${size}x${size}/markdx.png`] = await png(size)
  }

  for (const [file, data] of Object.entries(outputs)) {
    if (!data) {
      console.log(`skipped ${file} (needs macOS iconutil)`)
      continue
    }
    fs.mkdirSync(path.dirname(path.join(desktop, file)), { recursive: true })
    fs.writeFileSync(path.join(desktop, file), data)
    console.log(`wrote   ${file} (${data.length} bytes)`)
  }
}

main()
