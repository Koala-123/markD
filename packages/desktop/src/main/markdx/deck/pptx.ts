import { createStoredZip, type ZipEntry } from './zip'

const EMU_PER_PIXEL = 9525
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const relationships = (items: Array<[id: string, type: string, target: string]>): string =>
  `${XML}<Relationships xmlns="${PKG_REL}">${items
    .map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`)
    .join('')}</Relationships>`

const THEME = `${XML}<a:theme xmlns:a="${NS_A}" name="markDX"><a:themeElements>
<a:clrScheme name="markDX"><a:dk1><a:srgbClr val="14141F"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="14141F"/></a:dk2><a:lt2><a:srgbClr val="F6F1E7"/></a:lt2><a:accent1><a:srgbClr val="FF5A36"/></a:accent1><a:accent2><a:srgbClr val="0F766E"/></a:accent2><a:accent3><a:srgbClr val="B8381C"/></a:accent3><a:accent4><a:srgbClr val="26263A"/></a:accent4><a:accent5><a:srgbClr val="6B6658"/></a:accent5><a:accent6><a:srgbClr val="A8A294"/></a:accent6><a:hlink><a:srgbClr val="B8381C"/></a:hlink><a:folHlink><a:srgbClr val="6B6658"/></a:folHlink></a:clrScheme>
<a:fontScheme name="markDX"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
<a:fmtScheme name="markDX"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
</a:themeElements></a:theme>`

const emptyTree = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree>'

export interface PptxSlide {
  /** PNG bytes of the whole slide. */
  png: Buffer
  /** Spoken description, set as the picture's alt text. */
  description: string
}

/**
 * A PowerPoint file where every slide is one full-bleed picture of the slide.
 * The text is not editable in PowerPoint (it is an image), but each picture
 * carries the slide's title as alt text so screen readers have something to
 * read. Sizes are in pixels at 96 dpi.
 */
export const buildPptx = (slides: PptxSlide[], width: number, height: number, title: string): Buffer => {
  const cx = width * EMU_PER_PIXEL
  const cy = height * EMU_PER_PIXEL
  const files: ZipEntry[] = []
  const add = (name: string, content: string | Buffer): void => {
    files.push({ name, data: typeof content === 'string' ? Buffer.from(content, 'utf8') : content })
  }

  add(
    '[Content_Types].xml',
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="png" ContentType="image/png"/>' +
      '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
      '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
      '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
      '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      slides
        .map(
          (_, i) =>
            `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
        )
        .join('') +
      '</Types>'
  )
  add(
    '_rels/.rels',
    relationships([
      ['rId1', 'officeDocument', 'ppt/presentation.xml'],
    ]).replace(
      '</Relationships>',
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'
    )
  )
  add(
    'docProps/core.xml',
    `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(title)}</dc:title></cp:coreProperties>`
  )
  add(
    'ppt/presentation.xml',
    `${XML}<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">` +
      '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
      `<p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('')}</p:sldIdLst>` +
      `<p:sldSz cx="${cx}" cy="${cy}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`
  )
  add(
    'ppt/_rels/presentation.xml.rels',
    relationships([
      ['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'],
      ...slides.map((_, i): [string, string, string] => [`rId${i + 2}`, 'slide', `slides/slide${i + 1}.xml`])
    ])
  )
  add(
    'ppt/slideMasters/slideMaster1.xml',
    `${XML}<p:sldMaster xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld>${emptyTree}</p:cSld>` +
      '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
      '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>'
  )
  add(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    relationships([
      ['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'],
      ['rId2', 'theme', '../theme/theme1.xml']
    ])
  )
  add(
    'ppt/slideLayouts/slideLayout1.xml',
    `${XML}<p:sldLayout xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" type="blank"><p:cSld name="Blank">${emptyTree}</p:cSld></p:sldLayout>`
  )
  add(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    relationships([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']])
  )
  add('ppt/theme/theme1.xml', THEME)

  slides.forEach((slide, i) => {
    const n = i + 1
    add(
      `ppt/slides/slide${n}.xml`,
      `${XML}<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree>` +
        '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
        `<p:pic><p:nvPicPr><p:cNvPr id="2" name="Slide ${n}" descr="${escapeXml(slide.description)}"/>` +
        '<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>' +
        '<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>' +
        `<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>` +
        '</p:spTree></p:cSld></p:sld>'
    )
    add(
      `ppt/slides/_rels/slide${n}.xml.rels`,
      relationships([
        ['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'],
        ['rId2', 'image', `../media/image${n}.png`]
      ])
    )
    add(`ppt/media/image${n}.png`, slide.png)
  })

  return createStoredZip(files)
}
