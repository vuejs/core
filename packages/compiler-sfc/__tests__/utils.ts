import {
  parse,
  SFCScriptCompileOptions,
  compileScript,
  SFCParseOptions
} from '../src'
import { parse as babelParse } from '@babel/parser'

export const mockId = 'xxxxxxxx'

export function compileSFCScript(
  src: string,
  options?: Partial<SFCScriptCompileOptions>,
  parseOptions?: SFCParseOptions
) {
  const { descriptor } = parse(src, parseOptions)
  return compileScript(descriptor, {
    ...options,
    id: mockId
  })
}

export function assertCode(code: string) {
  // parse the generated code to make sure it is valid
  try {
    babelParse(code, {
      sourceType: 'module',
      plugins: ['typescript']
    })
  } catch (e: any) {
    console.log(code)
    throw e
  }
  expect(code).toMatchSnapshot()
}
