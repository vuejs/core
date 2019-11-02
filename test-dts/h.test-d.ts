// This file tests a number of cases that *should* fail using tsd:
// https://github.com/SamVerschueren/tsd
// It will probably show up red in VSCode, and it's intended. We cannot use
// directives like @ts-ignore or @ts-nocheck since that would suppress the
// errors that should be caught.

import { expectError } from 'tsd'
import { h, createComponent, ref, Fragment, Portal, Suspense } from './index'

// h inference w/ element
// key
h('div', { key: 1 })
h('div', { key: 'foo' })
expectError(h('div', { key: [] }))
expectError(h('div', { key: {} }))
// ref
h('div', { ref: 'foo' })
h('div', { ref: ref(null) })
h('div', { ref: el => {} })
expectError(h('div', { ref: [] }))
expectError(h('div', { ref: {} }))
expectError(h('div', { ref: 123 }))

// h inference w/ Fragment
// only accepts array children
h(Fragment, ['hello'])
h(Fragment, { key: 123 }, ['hello'])
expectError(h(Fragment, 'foo'))
expectError(h(Fragment, { key: 123 }, 'bar'))

// h inference w/ Portal
h(Portal, { target: '#foo' }, 'hello')
expectError(h(Portal))
expectError(h(Portal, {}))
expectError(h(Portal, { target: '#foo' }))

// h inference w/ Suspense
h(Suspense, { onRecede: () => {}, onResolve: () => {} }, 'hello')
h(Suspense, 'foo')
h(Suspense, () => 'foo')
h(Suspense, null, {
  default: () => 'foo'
})
expectError(h(Suspense, { onResolve: 1 }))

// h inference w/ functional component
const Func = (_props: { foo: string; bar?: number }) => ''
h(Func, { foo: 'hello' })
h(Func, { foo: 'hello', bar: 123 })
expectError(h(Func, { foo: 123 }))
expectError(h(Func, {}))
expectError(h(Func, { bar: 123 }))

// h inference w/ plain object component
const Foo = {
  props: {
    foo: String
  }
}

h(Foo, { foo: 'ok' })
h(Foo, { foo: 'ok', class: 'extra' })
// should fail on wrong type
expectError(h(Foo, { foo: 1 }))

// h inference w/ createComponent
const Bar = createComponent({
  props: {
    foo: String,
    bar: {
      type: Number,
      required: true
    }
  }
})

h(Bar, { bar: 1 })
h(Bar, { bar: 1, foo: 'ok' })
// should allow extraneous props (attrs fallthrough)
h(Bar, { bar: 1, foo: 'ok', class: 'extra' })
// should fail on missing required prop
expectError(h(Bar, {}))
expectError(h(Bar, { foo: 'ok' }))
// should fail on wrong type
expectError(h(Bar, { bar: 1, foo: 1 }))
