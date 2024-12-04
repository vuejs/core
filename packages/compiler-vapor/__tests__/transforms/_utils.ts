import type { RootNode } from '@vue/compiler-dom'
import {
  type CompilerOptions,
  type RootIRNode,
  generate,
  parse,
  transform,
} from '../../src'

export function makeCompile(options: CompilerOptions = {}) {
  return (
    template: string,
    overrideOptions: CompilerOptions = {},
  ): {
    ast: RootNode
    ir: RootIRNode
    code: string
    helpers: Set<string>
    vaporHelpers: Set<string>
  } => {
    const ast = parse(template, {
      prefixIdentifiers: true,
      ...options,
      ...overrideOptions,
    })
    const ir = transform(ast, {
      prefixIdentifiers: true,
      ...options,
      ...overrideOptions,
    })
    const { code, helpers, vaporHelpers } = generate(ir, {
      prefixIdentifiers: true,
      ...options,
      ...overrideOptions,
    })
    return { ast, ir, code, helpers, vaporHelpers }
  }
}
