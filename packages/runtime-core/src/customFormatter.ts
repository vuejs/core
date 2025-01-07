import {
  type Ref,
  isReactive,
  isReadonly,
  isRef,
  isShallow,
  toRaw,
} from '@vue/reactivity'
import { EMPTY_OBJ, extend, isArray, isFunction, isObject } from '@vue/shared'
import type { ComponentInternalInstance, ComponentOptions } from './component'
import type { ComponentPublicInstance } from './componentPublicInstance'

export function initCustomFormatter(): void {
  /* eslint-disable no-restricted-globals */
  if (!__DEV__ || typeof window === 'undefined') {
    return
  }

  const vueStyle = { style: 'color:#3ba776' }
  const numberStyle = { style: 'color:#1677ff' }
  const stringStyle = { style: 'color:#f5222d' }
  const keywordStyle = { style: 'color:#eb2f96' }

  // custom formatter for Chrome
  // https://www.mattzeunert.com/2016/02/19/custom-chrome-devtools-object-formatters.html
  const formatter = {
    __vue_custom_formatter: true,
    header(obj: unknown) {
      // TODO also format ComponentPublicInstance & ctx.slots/attrs in setup
      if (!isObject(obj)) {
        return null
      }

      if (obj.__isVue) {
        return ['div', vueStyle, `VueInstance`]
      } else if (isRef(obj)) {
        return [
          'div',
          {},
          ['span', vueStyle, genRefFlag(obj)],
          '<',
          // avoid debugger accessing value affecting behavior
          formatValue('_value' in obj ? obj._value : obj),
          `>`,
        ]
      } else if (isReactive(obj)) {
        return [
          'div',
          {},
          ['span', vueStyle, isShallow(obj) ? 'ShallowReactive' : 'Reactive'],
          '<',
          formatValue(obj),
          `>${isReadonly(obj) ? ` (readonly)` : ``}`,
        ]
      } else if (isReadonly(obj)) {
        return [
          'div',
          {},
          ['span', vueStyle, isShallow(obj) ? 'ShallowReadonly' : 'Readonly'],
          '<',
          formatValue(obj),
          '>',
        ]
      }
      return null
    },
    hasBody(obj: unknown) {
      return obj && (obj as any).__isVue
    },
    body(obj: unknown) {
      if (obj && (obj as any).__isVue) {
        return [
          'div',
          {},
          ...formatInstance((obj as ComponentPublicInstance).$),
        ]
      }
    },
  }

  function formatInstance(instance: ComponentInternalInstance) {
    const blocks = []
    if (instance.type.props && instance.props) {
      blocks.push(createInstanceBlock('props', toRaw(instance.props)))
    }
    if (instance.setupState !== EMPTY_OBJ) {
      blocks.push(createInstanceBlock('setup', instance.setupState))
    }
    if (instance.data !== EMPTY_OBJ) {
      blocks.push(createInstanceBlock('data', toRaw(instance.data)))
    }
    const computed = extractKeys(instance, 'computed')
    if (computed) {
      blocks.push(createInstanceBlock('computed', computed))
    }
    const injected = extractKeys(instance, 'inject')
    if (injected) {
      blocks.push(createInstanceBlock('injected', injected))
    }

    blocks.push([
      'div',
      {},
      [
        'span',
        {
          style: keywordStyle.style + ';opacity:0.66',
        },
        '$ (internal): ',
      ],
      ['object', { object: instance }],
    ])
    return blocks
  }

  function createInstanceBlock(type: string, target: any) {
    target = extend({}, target)
    if (!Object.keys(target).length) {
      return ['span', {}]
    }
    return [
      'div',
      { style: 'line-height:1.25em;margin-bottom:0.6em' },
      [
        'div',
        {
          style: 'color:#476582',
        },
        type,
      ],
      [
        'div',
        {
          style: 'padding-left:1.25em',
        },
        ...Object.keys(target).map(key => {
          return [
            'div',
            {},
            ['span', keywordStyle, key + ': '],
            formatValue(target[key], false),
          ]
        }),
      ],
    ]
  }

  function formatValue(v: unknown, asRaw = true) {
    if (typeof v === 'number') {
      return ['span', numberStyle, v]
    } else if (typeof v === 'string') {
      return ['span', stringStyle, JSON.stringify(v)]
    } else if (typeof v === 'boolean') {
      return ['span', keywordStyle, v]
    } else if (isObject(v)) {
      return ['object', { object: asRaw ? toRaw(v) : v }]
    } else {
      return ['span', stringStyle, String(v)]
    }
  }

  function extractKeys(instance: ComponentInternalInstance, type: string) {
    const Comp = instance.type
    if (isFunction(Comp)) {
      return
    }
    const extracted: Record<string, any> = {}
    for (const key in instance.ctx) {
      if (isKeyOfType(Comp, key, type)) {
        extracted[key] = instance.ctx[key]
      }
    }
    return extracted
  }

  function isKeyOfType(Comp: ComponentOptions, key: string, type: string) {
    const opts = Comp[type]
    if (
      (isArray(opts) && opts.includes(key)) ||
      (isObject(opts) && key in opts)
    ) {
      return true
    }
    if (Comp.extends && isKeyOfType(Comp.extends, key, type)) {
      return true
    }
    if (Comp.mixins && Comp.mixins.some(m => isKeyOfType(m, key, type))) {
      return true
    }
  }

  function genRefFlag(v: Ref) {
    if (isShallow(v)) {
      return `ShallowRef`
    }
    if ((v as any).effect) {
      return `ComputedRef`
    }
    return `Ref`
  }

  if ((window as any).devtoolsFormatters) {
    ;(window as any).devtoolsFormatters.push(formatter)
  } else {
    ;(window as any).devtoolsFormatters = [formatter]
  }
}
