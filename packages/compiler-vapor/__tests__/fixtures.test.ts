import * as CompilerVapor from '../src'
import { parse, compileScript } from '@vue/compiler-sfc'
import source from './fixtures/counter.vue?raw'

test('fixtures', async () => {
  const { descriptor } = parse(source, { compiler: CompilerVapor })
  const script = compileScript(descriptor, {
    id: 'counter.vue',
    inlineTemplate: true,
    templateOptions: { compiler: CompilerVapor },
  })
  expect(script.content).matchSnapshot()
})
