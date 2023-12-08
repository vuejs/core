import { type RootNode, BindingTypes, ErrorCodes } from '@vue/compiler-dom'
import { type CompilerOptions, compile as _compile } from '../../src'

function compile(template: string | RootNode, options: CompilerOptions = {}) {
  let { code } = _compile(template, {
    ...options,
    mode: 'module',
    prefixIdentifiers: true,
  })
  return code
}

describe('v-on', () => {
  test('simple expression', () => {
    const code = compile(`<div @click="handleClick"></div>`, {
      bindingMetadata: {
        handleClick: BindingTypes.SETUP_CONST,
      },
    })
    expect(code).matchSnapshot()
  })

  test('should error if no expression AND no modifier', () => {
    const onError = vi.fn()
    compile(`<div v-on:click />`, { onError })
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: ErrorCodes.X_V_ON_NO_EXPRESSION,
      loc: {
        start: {
          line: 1,
          column: 6,
        },
        end: {
          line: 1,
          column: 16,
        },
      },
    })
  })

  test('event modifier', () => {
    const code = compile(
      `<a @click.stop="handleEvent"></a>
        <form @submit.prevent="handleEvent"></form>
        <a @click.stop.prevent="handleEvent"></a>
        <div @click.self="handleEvent"></div>
        <div @click.capture="handleEvent"></div>
        <a @click.once="handleEvent"></a>
        <div @scroll.passive="handleEvent"></div>
        <input @click.right="handleEvent" />
        <input @click.left="handleEvent" />
        <input @click.middle="handleEvent" />
        <input @click.enter.right="handleEvent" />
        <input @keyup.enter="handleEvent" />
        <input @keyup.tab="handleEvent" />
        <input @keyup.delete="handleEvent" />
        <input @keyup.esc="handleEvent" />
        <input @keyup.space="handleEvent" />
        <input @keyup.up="handleEvent" />
        <input @keyup.down="handleEvent" />
        <input @keyup.left="handleEvent" />
        <input @keyup.middle="submit" />
        <input @keyup.middle.self="submit" />
        <input @keyup.self.enter="handleEvent" />`,
      {
        bindingMetadata: {
          handleEvent: BindingTypes.SETUP_CONST,
        },
      },
    )
    expect(code).matchSnapshot()
  })
})
