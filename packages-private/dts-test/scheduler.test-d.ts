import { nextTick } from 'vue'
import { describe, expectType } from './utils'

describe('nextTick', async () => {
  expectType(nextTick(), {} as Promise<void>)
  expectType(
    nextTick(() => 'foo'),
    {} as Promise<string>,
  )
  expectType(
    nextTick(() => Promise.resolve('foo')),
    {} as Promise<string>,
  )
  expectType(
    nextTick(() => Promise.resolve(Promise.resolve('foo'))),
    {} as Promise<string>,
  )

  expectType(await nextTick(), {} as unknown as void)
  expectType(await nextTick(() => 'foo'), {} as string)
  expectType(await nextTick(() => Promise.resolve('foo')), {} as string)
  expectType(
    await nextTick(() => Promise.resolve(Promise.resolve('foo'))),
    {} as string,
  )

  nextTick().then(value => {
    expectType(value, {} as unknown as void)
  })
  nextTick(() => 'foo').then(value => {
    expectType(value, {} as string)
  })
  nextTick(() => Promise.resolve('foo')).then(value => {
    expectType(value, {} as string)
  })
  nextTick(() => Promise.resolve(Promise.resolve('foo'))).then(value => {
    expectType(value, {} as string)
  })
})
