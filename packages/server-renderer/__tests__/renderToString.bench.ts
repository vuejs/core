import { describe } from 'vite-plus/test'
import { test } from '../../../scripts/bench'
import { createSSRApp, h } from 'vue'

import { renderToString as _renderToString } from '../src/renderToString'

// move to local const to avoid import access overhead
// https://github.com/vitest-dev/vitest/issues/6903
const renderToString = _renderToString

const Primitive = {
  props: { as: { type: String, default: 'div' } },
  setup(props: any, { attrs, slots }: any) {
    return () => h(props.as, attrs, { default: slots.default })
  },
}

const App = {
  components: { Primitive },
  data: () => ({ items: Array.from({ length: 100 }, (_, i) => i) }),
  template: `<Primitive as="ul">
    <Primitive v-for="i in items" as="li" :key="i" class="item">
      <span>{{ i }}</span>
      <Primitive as="a" href="#">link <b>{{ i }}</b></Primitive>
    </Primitive>
  </Primitive>`,
}

describe('renderToString', () => {
  test('render function components passing slots to elements', async ({
    benchmark,
  }) => {
    await benchmark(async () => {
      await renderToString(createSSRApp(App))
    })
  })
})
