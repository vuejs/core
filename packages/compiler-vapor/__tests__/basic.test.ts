import * as CompilerVapor from '../src'
// import * as CompilerDOM from '@vue/compiler-dom'
import { parse, compileScript } from '@vue/compiler-sfc'
import source from './fixtures/counter.vue?raw'

test('basic', async () => {
  const { descriptor } = parse(source, { compiler: CompilerVapor })
  const script = compileScript(descriptor, {
    id: 'counter.vue',
    inlineTemplate: true,
    templateOptions: { compiler: CompilerVapor }
  })
  expect(script.content).matchSnapshot()
})
