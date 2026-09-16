import {
  type CompilerError,
  type ElementNode,
  NodeTypes,
  type ParserOptions,
  type RootNode,
  createRoot,
  findDir,
} from '@vue/compiler-core'
import * as CompilerDOM from '@vue/compiler-dom'

interface TemplateParser {
  parse(template: string, options: ParserOptions): RootNode
}

export function resolveTemplateAST(
  inAST: RootNode | undefined,
  options: {
    compiler?: TemplateParser
    compilerOptions?: ParserOptions
    ssr?: boolean
    onError: (error: CompilerError) => void
  },
): RootNode | undefined {
  if (!inAST?.transformed) {
    return inAST
  }

  // Parse the full SFC source to preserve template locations relative to it.
  const { compiler = CompilerDOM, compilerOptions, ssr, onError } = options
  const newAST = (ssr ? CompilerDOM : compiler).parse(inAST.source, {
    prefixIdentifiers: true,
    ...compilerOptions,
    parseMode: 'sfc',
    onError,
  })
  const template = newAST.children.find(
    node => node.type === NodeTypes.ELEMENT && node.tag === 'template',
  ) as ElementNode
  return createTemplateRoot(template, inAST.source)
}

export function createTemplateRoot(
  template: ElementNode,
  source: string,
): RootNode {
  const match = findDir(template, 'match', true)
  return createRoot(
    match ? [{ ...template, props: [match] }] : template.children,
    source,
  )
}
