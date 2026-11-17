import { describe, expect, it } from 'vitest'
import { crc32 } from 'zlib'
import { createStoredZip } from '../../../src/main/markdx/deck/zip'
import { buildPptx } from '../../../src/main/markdx/deck/pptx'

// A 1x1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

// Reads entries back from the zip's central directory.
const readZip = (zip: Buffer): Array<{ name: string; data: Buffer; crc: number }> => {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  const count = zip.readUInt16LE(end + 10)
  let at = zip.readUInt32LE(end + 16)
  const entries = []
  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(at)).toBe(0x02014b50)
    const crc = zip.readUInt32LE(at + 16)
    const size = zip.readUInt32LE(at + 20)
    const nameLength = zip.readUInt16LE(at + 28)
    const local = zip.readUInt32LE(at + 42)
    const name = zip.subarray(at + 46, at + 46 + nameLength).toString('utf8')
    const dataStart = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
    entries.push({ name, data: zip.subarray(dataStart, dataStart + size), crc })
    at += 46 + nameLength
  }
  return entries
}

describe('createStoredZip', () => {
  it('round-trips names and bytes, with matching checksums', () => {
    const zip = createStoredZip([
      { name: 'a.txt', data: Buffer.from('hello') },
      { name: 'dir/ü.bin', data: Buffer.from([0, 1, 2, 255]) }
    ])
    const entries = readZip(zip)
    expect(entries.map((e) => e.name)).toEqual(['a.txt', 'dir/ü.bin'])
    expect(entries[0].data.toString()).toBe('hello')
    for (const entry of entries) expect(crc32(entry.data)).toBe(entry.crc)
  })

  it('is reproducible', () => {
    const input = [{ name: 'x', data: Buffer.from('1') }]
    expect(createStoredZip(input).equals(createStoredZip(input))).toBe(true)
  })

  it('writes an empty archive', () => {
    expect(readZip(createStoredZip([]))).toEqual([])
  })
})

describe('buildPptx', () => {
  const pptx = buildPptx(
    [
      { png: PNG, description: 'First <slide> & "more"' },
      { png: PNG, description: 'Second' }
    ],
    1280,
    720,
    'My talk'
  )
  const entries = readZip(pptx)
  const text = (name: string): string => (entries.find((e) => e.name === name)?.data ?? Buffer.alloc(0)).toString('utf8')

  it('has one slide part and one picture per slide', () => {
    const names = entries.map((e) => e.name)
    expect(names).toContain('ppt/slides/slide1.xml')
    expect(names).toContain('ppt/slides/slide2.xml')
    expect(names).toContain('ppt/media/image2.png')
    expect(entries.find((e) => e.name === 'ppt/media/image1.png')?.data.equals(PNG)).toBe(true)
  })

  it('sizes the slides in EMU from the pixel size', () => {
    expect(text('ppt/presentation.xml')).toContain('<p:sldSz cx="12192000" cy="6858000"/>')
  })

  it('escapes text into XML attributes', () => {
    expect(text('ppt/slides/slide1.xml')).toContain('descr="First &lt;slide&gt; &amp; &quot;more&quot;"')
  })

  it('declares a content type for every slide', () => {
    expect(text('[Content_Types].xml')).toContain('/ppt/slides/slide2.xml')
  })
})
