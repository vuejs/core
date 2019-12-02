import {
  parse as baseParse,
  TextModes,
  NodeTypes,
  TextNode,
  ElementNode,
  SourceLocation
} from '@vue/compiler-core'
import { RawSourceMap, SourceMapGenerator } from 'source-map'
import LRUCache from 'lru-cache'
import { generateCodeFrame } from '@vue/shared'

export interface SFCParseOptions {
  needMap?: boolean
  filename?: string
  sourceRoot?: string
  pad?: boolean | 'line' | 'space'
}

export interface SFCBlock {
  type: string
  content: string
  attrs: Record<string, string | true>
  loc: SourceLocation
  map?: RawSourceMap
  lang?: string
  src?: string
}

export interface SFCTemplateBlock extends SFCBlock {
  type: 'template'
  functional?: boolean
}

export interface SFCScriptBlock extends SFCBlock {
  type: 'script'
}

export interface SFCStyleBlock extends SFCBlock {
  type: 'style'
  scoped?: boolean
  module?: string | boolean
}

export interface SFCDescriptor {
  filename: string
  template: SFCTemplateBlock | null
  script: SFCScriptBlock | null
  styles: SFCStyleBlock[]
  customBlocks: SFCBlock[]
}

const SFC_CACHE_MAX_SIZE = 500
const sourceToSFC = new LRUCache<string, SFCDescriptor>(SFC_CACHE_MAX_SIZE)
export function parse(
  source: string,
  {
    needMap = true,
    filename = 'component.vue',
    sourceRoot = '',
    pad = 'line'
  }: SFCParseOptions = {}
): SFCDescriptor {
  const sourceKey = source + needMap + filename + sourceRoot + pad
  const cache = sourceToSFC.get(sourceKey)
  if (cache) {
    return cache
  }

  const sfc: SFCDescriptor = {
    filename,
    template: null,
    script: null,
    styles: [],
    customBlocks: []
  }

  const ast = baseParse(source, {
    isNativeTag: () => true,
    getTextMode: () => TextModes.RAWTEXT
  })

  ast.children.forEach(node => {
    if (node.type !== NodeTypes.ELEMENT) {
      return
    }
    if (!node.children.length) {
      return
    }
    switch (node.tag) {
      case 'template':
        if (!sfc.template) {
          sfc.template = createBlock(node, source, pad) as SFCTemplateBlock
        } else {
          warnDuplicateBlock(source, filename, node)
        }
        break
      case 'script':
        if (!sfc.script) {
          sfc.script = createBlock(node, source, pad) as SFCScriptBlock
        } else {
          warnDuplicateBlock(source, filename, node)
        }
        break
      case 'style':
        sfc.styles.push(createBlock(node, source, pad) as SFCStyleBlock)
        break
      default:
        sfc.customBlocks.push(createBlock(node, source, pad))
        break
    }
  })

  if (needMap) {
    if (sfc.script && !sfc.script.src) {
      sfc.script.map = generateSourceMap(
        filename,
        source,
        sfc.script.content,
        sourceRoot,
        pad
      )
    }
    if (sfc.styles) {
      sfc.styles.forEach(style => {
        if (!style.src) {
          style.map = generateSourceMap(
            filename,
            source,
            style.content,
            sourceRoot,
            pad
          )
        }
      })
    }
  }
  sourceToSFC.set(sourceKey, sfc)

  return sfc
}

function warnDuplicateBlock(
  source: string,
  filename: string,
  node: ElementNode
) {
  const codeFrame = generateCodeFrame(
    source,
    node.loc.start.offset,
    node.loc.end.offset
  )
  const location = `${filename}:${node.loc.start.line}:${node.loc.start.column}`
  console.warn(
    `Single file component can contain only one ${
      node.tag
    } element (${location}):\n\n${codeFrame}`
  )
}

function createBlock(
  node: ElementNode,
  source: string,
  pad: SFCParseOptions['pad']
): SFCBlock {
  const type = node.tag
  const text = node.children[0] as TextNode
  const attrs: Record<string, string | true> = {}
  const block: SFCBlock = {
    type,
    content: text.content,
    loc: text.loc,
    attrs
  }
  if (node.tag !== 'template' && pad) {
    block.content = padContent(source, block, pad) + block.content
  }
  node.props.forEach(p => {
    if (p.type === NodeTypes.ATTRIBUTE) {
      attrs[p.name] = p.value ? p.value.content || true : true
      if (p.name === 'lang') {
        block.lang = p.value && p.value.content
      } else if (p.name === 'src') {
        block.src = p.value && p.value.content
      } else if (type === 'style') {
        if (p.name === 'scoped') {
          ;(block as SFCStyleBlock).scoped = true
        } else if (p.name === 'module') {
          ;(block as SFCStyleBlock).module = attrs[p.name]
        }
      } else if (type === 'template' && p.name === 'functional') {
        ;(block as SFCTemplateBlock).functional = true
      }
    }
  })
  return block
}

const splitRE = /\r?\n/g
const emptyRE = /^(?:\/\/)?\s*$/
const replaceRE = /./g

function generateSourceMap(
  filename: string,
  source: string,
  generated: string,
  sourceRoot: string,
  pad?: SFCParseOptions['pad']
): RawSourceMap {
  const map = new SourceMapGenerator({
    file: filename.replace(/\\/g, '/'),
    sourceRoot: sourceRoot.replace(/\\/g, '/')
  })
  let offset = 0
  if (!pad) {
    offset =
      source
        .split(generated)
        .shift()!
        .split(splitRE).length - 1
  }
  map.setSourceContent(filename, source)
  generated.split(splitRE).forEach((line, index) => {
    if (!emptyRE.test(line)) {
      map.addMapping({
        source: filename,
        original: {
          line: index + 1 + offset,
          column: 0
        },
        generated: {
          line: index + 1,
          column: 0
        }
      })
    }
  })
  return JSON.parse(map.toString())
}

function padContent(
  content: string,
  block: SFCBlock,
  pad: SFCParseOptions['pad']
): string {
  content = content.slice(0, block.loc.start.offset)
  if (pad === 'space') {
    return content.replace(replaceRE, ' ')
  } else {
    const offset = content.split(splitRE).length
    const padChar = block.type === 'script' && !block.lang ? '//\n' : '\n'
    return Array(offset).join(padChar)
  }
}
