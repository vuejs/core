import { bench, describe } from 'vitest'

import { createBuffer } from '../src/render'

describe('createBuffer', () => {
  let stringBuffer = createBuffer()

  bench(
    'string only',
    () => {
      for (let i = 0; i < 10; i += 1) {
        stringBuffer.push('hello')
      }
    },
    {
      setup() {
        stringBuffer = createBuffer()
      },
    },
  )

  let stringNestedBuffer = createBuffer()

  bench(
    'string with nested',
    () => {
      for (let i = 0; i < 10; i += 1) {
        if (i % 3 === 0) {
          stringNestedBuffer.push('hello')
        } else {
          const buffer = createBuffer()
          buffer.push('hello')
          stringNestedBuffer.push(buffer.getBuffer())
        }
      }
    },
    {
      setup() {
        stringNestedBuffer = createBuffer()
      },
    },
  )

  bench(
    'string with nested async',
    () => {
      for (let i = 0; i < 10; i += 1) {
        if (i % 3 === 0) {
          const buffer = createBuffer()
          buffer.push('hello')
          stringNestedBuffer.push(Promise.resolve(buffer.getBuffer()))
        } else {
          const buffer = createBuffer()
          buffer.push('hello')
          stringNestedBuffer.push(buffer.getBuffer())
        }
      }
    },
    {
      setup() {
        stringNestedBuffer = createBuffer()
      },
    },
  )
})
