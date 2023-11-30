import * as CompilerVapor from '../src'
import { parse, compileScript } from '@vue/compiler-sfc'
import source from './fixtures/counter.vue?raw'

test('fixtures', async () => {
  const { descriptor } = parse(source, { compiler: CompilerVapor as any })
  const script = compileScript(descriptor, {
    id: 'counter.vue',
    inlineTemplate: true,
    templateOptions: { compiler: CompilerVapor as any },
  })
  expect(script.content).matchSnapshot()
})
