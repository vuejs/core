import { parse, SFCScriptCompileOptions, compileScript } from '../src'
import { parse as babelParse } from '@babel/parser'

export const mockId = 'xxxxxxxx'

export function compileSFCScript(
  src: string,
  options?: Partial<SFCScriptCompileOptions>
) {
  const { descriptor } = parse(src)
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
