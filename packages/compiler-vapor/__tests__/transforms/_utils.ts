import { type CompilerOptions, generate, parse, transform } from '../../src'

export function makeCompile(options: CompilerOptions = {}) {
  return (template: string, overrideOptions: CompilerOptions = {}) => {
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
