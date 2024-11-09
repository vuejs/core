import {
  type SFCParseOptions,
  type SFCScriptBlock,
  type SFCScriptCompileOptions,
  compileScript,
  parse,
} from '../src'
import { parse as babelParse } from '@babel/parser'

export const mockId = 'xxxxxxxx'

export function compileSFCScript(
  src: string,
  options?: Partial<SFCScriptCompileOptions>,
  parseOptions?: SFCParseOptions,
): SFCScriptBlock {
  const { descriptor, errors } = parse(src, parseOptions)
  if (errors.length) {
    console.warn(errors[0])
  }
  return compileScript(descriptor, {
    ...options,
    id: mockId,
  })
}

export function assertCode(code: string): void {
  // parse the generated code to make sure it is valid
  try {
    babelParse(code, {
      sourceType: 'module',
      plugins: [
        'typescript',
        ['importAttributes', { deprecatedAssertSyntax: true }],
      ],
    })
  } catch (e: any) {
    console.log(code)
    throw e
  }
  expect(code).toMatchSnapshot()
}
