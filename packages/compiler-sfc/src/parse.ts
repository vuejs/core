import {
  parse as baseParse,
  TextModes,
  NodeTypes,
  TextNode,
  ElementNode,
  SourceLocation
} from '@vue/compiler-core'
import { RawSourceMap } from 'source-map'

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

export function parse(
  source: string,
  {
    needMap = true,
    filename = 'component.vue',
    sourceRoot = ''
  }: SFCParseOptions = {}
): SFCDescriptor {
  // TODO check cache

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
    switch (node.tag) {
      case 'template':
        if (!sfc.template) {
          sfc.template = createBlock(node) as SFCTemplateBlock
        } else {
          // TODO warn duplicate template
        }
        break
      case 'script':
        if (!sfc.script) {
          sfc.script = createBlock(node) as SFCScriptBlock
        } else {
          // TODO warn duplicate script
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
  // TODO set cache

  return sfc
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
