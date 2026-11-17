import { crc32 } from 'zlib'

export interface ZipEntry {
  name: string
  data: Buffer
}

// A fixed, valid DOS date/time (1980-01-01 00:00). Zips written here are
// reproducible: the same input gives the same bytes.
const DOS_TIME = 0
const DOS_DATE = (0 << 9) | (1 << 5) | 1

/**
 * Writes a ZIP with every entry stored, not compressed. PNG data is already
 * compressed, and the XML parts are small, so this saves a dependency and
 * costs a few kilobytes. Limits: no ZIP64, so under 4 GiB and 65,535 entries.
 */
export const createStoredZip = (entries: ZipEntry[]): Buffer => {
  const chunks: Buffer[] = []
  const directory: Buffer[] = []
  let offset = 0

  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8')
    const checksum = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0x0800, 6) // flags: UTF-8 names
    local.writeUInt16LE(0, 8) // method: stored
    local.writeUInt16LE(DOS_TIME, 10)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    local.writeUInt16LE(0, 28)
    chunks.push(local, nameBytes, data)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4) // version made by
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(DOS_TIME, 12)
    central.writeUInt16LE(DOS_DATE, 14)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    directory.push(central, nameBytes)

    offset += local.length + nameBytes.length + data.length
  }

  const directoryBytes = Buffer.concat(directory)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directoryBytes.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...chunks, directoryBytes, end])
}
