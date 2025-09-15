/**
 * @vitest-environment jsdom
 */
import { bench, describe } from 'vitest'
import {
  ssrInterpolate as _ssrInterpolate,
  ssrRenderAttrs as _ssrRenderAttrs,
} from '@vue/server-renderer'
import {
  Fragment as _Fragment,
  createBlock as _createBlock,
  createCommentVNode as _createCommentVNode,
  createElementBlock as _createElementBlock,
  createElementVNode as _createElementVNode,
  createVNode as _createVNode,
  openBlock as _openBlock,
  renderList as _renderList,
  renderSlot as _renderSlot,
  toDisplayString as _toDisplayString,
  vModelText as _vModelText,
  withCtx as _withCtx,
  withDirectives as _withDirectives,
  createSSRApp,
  ref,
} from '@vue/runtime-dom'
import {
  applyTextModel as _applyTextModel,
  child as _child,
  createComponent as _createComponent,
  createFor as _createFor,
  createIf as _createIf,
  createSlot as _createSlot,
  next as _next,
  renderEffect as _renderEffect,
  setInsertionState as _setInsertionState,
  setText as _setText,
  template as _template,
  createVaporSSRApp,
} from '@vue/runtime-vapor'

describe('hydration benchmark', () => {
  {
    let html = `<div><div><h1>Hello World!</h1><input value="Hello World!"><div><!--[--><div>1</div><div>2</div><div>3</div><div>4</div><div>5</div><!--]--></div><!--[--><!--]--><span></span></div></div>`

    const t0 = _template('<h1> </h1>')
    const t1 = _template('<div> </div>')
    const t2 = _template('<div><input><div></div><!><span></span></div>', true)

    const VaporChild = {
      __vapor: true,
      setup() {
        const msg = ref('Hello World!')
        const show = ref(true)

        const n9 = t2() as any
        const n0 = _child(n9) as any
        const n8 = _next(n0) as any
        const n7 = _next(n8) as any
        _setInsertionState(n9, n8)
        _createIf(
          () => show.value,
          () => {
            const n3 = t0() as any
            _applyTextModel(
              n3,
              () => msg.value,
              _value => (msg.value = _value),
            )
            return n3
          },
        )
        _setInsertionState(n7)
        _createFor(
          () => 5,
          _for_item0 => {
            const n6 = t1() as any
            const x6 = _child(n6) as any
            _renderEffect(() =>
              _setText(x6, _toDisplayString(_for_item0.value)),
            )
            return n6
          },
          undefined,
          5,
        )
        const x0 = _child(n0) as any
        _renderEffect(() => _setText(x0, _toDisplayString(msg.value)))
        return n9
      },
    }

    const tt0 = _template('<span> </span>')
    const tt1 = _template('<div></div>', true)

    const VaporApp = {
      __vapor: true,
      setup() {
        const msg = ref('hi')
        const n2 = tt1() as any
        _setInsertionState(n2)
        _createComponent(VaporChild, null, {
          default: () => {
            const n0 = tt0() as any
            const x0 = _child(n0) as any
            _renderEffect(() => _setText(x0, _toDisplayString(msg.value)))
            return n0
          },
        })
        return n2
      },
    }

    const VdomChild = {
      setup() {
        const msg = ref('Hello World!')
        const show = ref(true)

        // @ts-expect-error
        return (_ctx, _cache) => {
          return (
            _openBlock(),
            _createElementBlock('div', null, [
              _createElementVNode(
                'h1',
                null,
                _toDisplayString(msg.value),
                1 /* TEXT */,
              ),
              show.value
                ? _withDirectives(
                    (_openBlock(),
                    _createElementBlock(
                      'input',
                      {
                        key: 0,
                        'onUpdate:modelValue':
                          _cache[0] ||
                          (_cache[0] = ($event: any) => (msg.value = $event)),
                      },
                      null,
                      512 /* NEED_PATCH */,
                    )),
                    [[_vModelText, msg.value]],
                  )
                : _createCommentVNode('v-if', true),
              _createElementVNode('div', null, [
                (_openBlock(),
                _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(5, item => {
                    return _createElementVNode(
                      'div',
                      null,
                      _toDisplayString(item),
                      1 /* TEXT */,
                    )
                  }),
                  64 /* STABLE_FRAGMENT */,
                )),
              ]),
              _cache[1] ||
                (_cache[1] = _createElementVNode(
                  'span',
                  null,
                  null,
                  -1 /* CACHED */,
                )),
            ])
          )
        }
      },
    }

    const VdomApp = {
      setup() {
        const msg = ref('hi')
        return () => {
          return (
            _openBlock(),
            _createElementBlock('div', null, [
              _createVNode(VdomChild, null, {
                default: _withCtx(() => [
                  _createElementVNode(
                    'span',
                    null,
                    _toDisplayString(msg.value),
                    1 /* TEXT */,
                  ),
                ]),
                _: 1 /* STABLE */,
              }),
            ])
          )
        }
      },
    }

    bench('vapor', () => {
      try {
        __DEV__ = false
        const container = document.createElement('div')
        container.innerHTML = html

        const app = createVaporSSRApp(VaporApp)
        app.mount(container)
      } finally {
        __DEV__ = true
      }
    })

    bench('vdom', () => {
      try {
        __DEV__ = false
        const container = document.createElement('div')
        container.innerHTML = html

        const app = createSSRApp(VdomApp)
        app.mount(container)
      } finally {
        __DEV__ = true
      }
    })
  }
})
