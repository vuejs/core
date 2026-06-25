import { nextTick } from 'vue'
import { describe, expectType } from './utils'

describe('nextTick', async () => {
  expectType<Promise<void>>(nextTick())
  expectType<Promise<string>>(nextTick(() => 'foo'))
  expectType<Promise<string>>(nextTick(() => Promise.resolve('foo')))
  expectType<Promise<string>>(
    nextTick(() => Promise.resolve(Promise.resolve('foo'))),
  )

  expectType<void>(await nextTick())
  expectType<string>(await nextTick(() => 'foo'))
  expectType<string>(await nextTick(() => Promise.resolve('foo')))
  expectType<string>(
    await nextTick(() => Promise.resolve(Promise.resolve('foo'))),
  )

  nextTick().then(value => {
    expectType<void>(value)
  })
  nextTick(() => 'foo').then(value => {
    expectType<string>(value)
  })
  nextTick(() => Promise.resolve('foo')).then(value => {
    expectType<string>(value)
  })
  nextTick(() => Promise.resolve(Promise.resolve('foo'))).then(value => {
    expectType<string>(value)
  })
})
