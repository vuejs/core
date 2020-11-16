import { parse, SFCScriptCompileOptions, compileScript } from '../src'
import { parse as babelParse } from '@babel/parser'
import { babelParserDefaultPlugins } from '@vue/shared'

export function compileSFCScript(
  src: string,
  options?: Partial<SFCScriptCompileOptions>
) {
  const { descriptor } = parse(src)
  return compileScript(descriptor, {
    ...options,
    id: 'xxxxxxxx'
  })
}

export function assertCode(code: string) {
  // parse the generated code to make sure it is valid
  try {
    babelParse(code, {
      sourceType: 'module',
      plugins: [...babelParserDefaultPlugins, 'typescript']
    })
  } catch (e) {
    console.log(code)
    throw e
  }
  expect(code).toMatchSnapshot()
}
