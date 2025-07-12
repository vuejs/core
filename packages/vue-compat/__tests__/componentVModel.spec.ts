import Vue from '@vue/compat'
import type { ComponentOptions } from '../../runtime-core/src/component'
import { nextTick } from '../../runtime-core/src/scheduler'
import {
  DeprecationTypes,
  deprecationData,
  toggleDeprecationWarning,
} from '../../runtime-core/src/compat/compatConfig'
import { triggerEvent } from './utils'

beforeEach(() => {
  toggleDeprecationWarning(true)
  Vue.configureCompat({
    MODE: 2,
    GLOBAL_MOUNT: 'suppress-warning',
  })
})

afterEach(() => {
  toggleDeprecationWarning(false)
  Vue.configureCompat({ MODE: 3 })
})

describe('COMPONENT_V_MODEL', () => {
  async function runTest(CustomInput: ComponentOptions) {
    const vm = new Vue({
      data() {
        return {
          text: 'foo',
        }
      },
      components: { CustomInput },
      template: `
      <div>
        <span>{{ text }}</span>
        <custom-input v-model="text"></custom-input>
      </div>
      `,
    }).$mount() as any

    const input = vm.$el.querySelector('input')
    const span = vm.$el.querySelector('span')

    expect(input.value).toBe('foo')
    expect(span.textContent).toBe('foo')

    expect(
      (deprecationData[DeprecationTypes.COMPONENT_V_MODEL].message as Function)(
        CustomInput,
      ),
    ).toHaveBeenWarned()

    input.value = 'bar'
    triggerEvent(input, 'input')
    await nextTick()

    expect(input.value).toBe('bar')
    expect(span.textContent).toBe('bar')

    vm.text = 'baz'
    await nextTick()
    expect(input.value).toBe('baz')
    expect(span.textContent).toBe('baz')
  }

  test('basic usage', async () => {
    await runTest({
      name: 'CustomInput',
      props: ['value'],
      template: `<input :value="value" @input="$emit('input', $event.target.value)">`,
    })
  })

  test('with model option', async () => {
    await runTest({
      name: 'CustomInput',
      props: ['input'],
      model: {
        prop: 'input',
        event: 'update',
      },
      template: `<input :value="input" @input="$emit('update', $event.target.value)">`,
    })
  })

  async function runTestWithModifier(CustomInput: ComponentOptions) {
    const vm = new Vue({
      data() {
        return {
          text: ' foo ',
        }
      },
      components: {
        CustomInput,
      },
      template: `
      <div>
        <span>{{ text }}</span>
        <custom-input v-model.trim="text"></custom-input>
      </div>
      `,
    }).$mount() as any

    const input = vm.$el.querySelector('input')
    const span = vm.$el.querySelector('span')

    expect(input.value).toBe(' foo ')
    expect(span.textContent).toBe(' foo ')

    expect(
      (deprecationData[DeprecationTypes.COMPONENT_V_MODEL].message as Function)(
        CustomInput,
      ),
    ).toHaveBeenWarned()

    input.value = ' bar '
    triggerEvent(input, 'input')
    await nextTick()

    expect(input.value).toBe('bar')
    expect(span.textContent).toBe('bar')
  }

  test('with model modifiers', async () => {
    await runTestWithModifier({
      name: 'CustomInput',
      props: ['value'],
      template: `<input :value="value" @input="$emit('input', $event.target.value)">`,
    })
  })

  test('with model modifiers and model option', async () => {
    await runTestWithModifier({
      name: 'CustomInput',
      props: ['foo'],
      model: {
        prop: 'foo',
        event: 'bar',
      },
      template: `<input :value="foo" @input="$emit('bar', $event.target.value)">`,
    })
  })
})
