import { TransitionGroup, createApp, h } from 'vue'
import { hyphenate, isOn } from '@vue/shared'
import { renderToString } from '../src/renderToString'

// Use the runtime declaration to cover every non-event TransitionGroup prop.
const propNames = Object.keys(
  (TransitionGroup as unknown as { props: object }).props,
).filter(key => key !== 'tag' && !isOn(key))

describe('ssr: TransitionGroup', () => {
  test.each(['camelCase', 'kebab-case'])('%s props', async casing => {
    const names = propNames.map(key =>
      casing === 'kebab-case' ? hyphenate(key) : key,
    )
    const bindings = names.map(key => `${key}="test"`).join(' ')
    expect(
      await renderToString(
        createApp({
          template: `<TransitionGroup tag="ul" ${bindings} mode="x" id="list"><li key="1">one</li></TransitionGroup>`,
        }),
      ),
    ).toBe('<ul mode="x" id="list"><li>one</li></ul>')
  })

  test.each(['camelCase', 'kebab-case'])('bound %s props', async casing => {
    const names = propNames.map(key =>
      casing === 'kebab-case' ? hyphenate(key) : key,
    )
    const bindings = names.map(key => `:${key}="value"`).join(' ')
    expect(
      await renderToString(
        createApp({
          data: () => ({ value: 'test', mode: 'x' }),
          template: `<TransitionGroup tag="ul" ${bindings} :mode="mode" class="list"/>`,
        }),
      ),
    ).toBe('<ul mode="x" class="list"></ul>')
  })

  test.each(['tag="ul"', ':tag="tag"'])('object v-bind with %s', async tag => {
    const props = {
      name: 'list',
      appear: true,
      css: false,
      duration: { enter: 300, leave: 200 },
      'move-class': 'move',
      'enter-from-class': 'enter',
      mode: 'x',
      id: 'list',
      class: ['bound'],
      style: { color: 'red' },
      'data-test': 'value',
      'aria-label': 'items',
    }
    const html = await renderToString(
      createApp({
        data: () => ({ tag: 'ul', props }),
        template: `<TransitionGroup ${tag} v-bind="props" class="static"><li key="1">one</li></TransitionGroup>`,
      }),
    )
    expect(html).toBe(
      '<ul mode="x" id="list" class="bound static" style="color:red;" data-test="value" aria-label="items"><li>one</li></ul>',
    )
    // Exercise the VNode path as an independent reference for prop fallthrough.
    expect(html).toBe(
      await renderToString(
        h(
          TransitionGroup,
          { ...props, tag: 'ul', class: ['bound', 'static'] },
          () => [h('li', { key: 1 }, 'one')],
        ),
      ),
    )
  })

  test.each(['name', 'moveClass', 'move-class', 'mode', 'id'])(
    'dynamic argument %s',
    async key => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ key, value: 'x' }),
            template: '<TransitionGroup tag="ul" :[key]="value"/>',
          }),
        ),
      ).toBe(
        key === 'mode' || key === 'id' ? `<ul ${key}="x"></ul>` : '<ul></ul>',
      )
    },
  )

  test('filters tag from object bindings with an explicit wrapper', async () => {
    expect(
      await renderToString(
        createApp({
          data: () => ({ props: { tag: 'ul', name: 'list', id: 'list' } }),
          template: '<TransitionGroup tag="ul" v-bind="props"/>',
        }),
      ),
    ).toBe('<ul id="list"></ul>')
  })

  test('root fallthrough attributes', async () => {
    expect(
      await renderToString(
        createApp(
          { template: '<TransitionGroup tag="ul"/>' },
          {
            name: 'list',
            'move-class': 'move',
            mode: 'x',
            id: 'list',
          },
        ),
      ),
    ).toBe('<ul mode="x" id="list"></ul>')
  })

  test('inheritAttrs: false', async () => {
    expect(
      await renderToString(
        createApp(
          {
            inheritAttrs: false,
            template: '<TransitionGroup tag="ul" name="list"/>',
          },
          { id: 'parent' },
        ),
      ),
    ).toBe('<ul></ul>')
  })

  test.each(['tag="ul"', ':tag="tag"'])(
    'nested group with %s and no props',
    async tag => {
      expect(
        await renderToString(
          createApp(
            {
              data: () => ({ tag: 'ul' }),
              template: `<div><TransitionGroup ${tag}><li key="1">one</li></TransitionGroup></div>`,
            },
            { id: 'root' },
          ),
        ),
      ).toBe('<div id="root"><ul><li>one</li></ul></div>')
    },
  )

  test('fragment group', async () => {
    expect(
      await renderToString(
        createApp({
          template:
            '<div><TransitionGroup name="list"><li key="1">one</li></TransitionGroup></div>',
        }),
      ),
    ).toBe('<div><!--[--><li>one</li><!--]--></div>')
  })

  test('ordinary element attributes', async () => {
    expect(
      await renderToString(
        createApp({
          template: '<input name="field" type="text">',
        }),
      ),
    ).toBe('<input name="field" type="text">')
  })
})
