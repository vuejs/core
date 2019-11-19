import {
  parse as baseParse,
  TextModes,
  NodeTypes,
  TextNode,
  ElementNode,
  SourceLocation
} from '@vue/compiler-core'
import { RawSourceMap } from 'source-map'
import LRUCache from 'lru-cache'
import { generateCodeFrame } from '@vue/shared'

export interface SFCParseOptions {
  needMap?: boolean
  filename?: string
  sourceRoot?: string
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
    sourceRoot = ''
  }: SFCParseOptions = {}
): SFCDescriptor {
  const sourceKey = source + needMap + filename + sourceRoot
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
          sfc.template = createBlock(node) as SFCTemplateBlock
        } else {
          warnDuplicateBlock(source, filename, node)
        }
        break
      case 'script':
        if (!sfc.script) {
          sfc.script = createBlock(node) as SFCScriptBlock
        } else {
          warnDuplicateBlock(source, filename, node)
        }
        break
      case 'style':
        sfc.styles.push(createBlock(node) as SFCStyleBlock)
        break
      default:
        sfc.customBlocks.push(createBlock(node))
        break
    }
  })

  if (needMap) {
    // TODO source map
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

function createBlock(node: ElementNode): SFCBlock {
  const type = node.tag
  const text = node.children[0] as TextNode
  const attrs: Record<string, string | true> = {}
  const block: SFCBlock = {
    type,
    content: text.content,
    loc: text.loc,
    attrs
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
