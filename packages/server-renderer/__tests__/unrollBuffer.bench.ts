import { bench, describe } from 'vitest'

import { type SSRBuffer, createBuffer } from '../src/render'
import { unrollBuffer as _unrollBuffer } from '../src/renderToString'

// move to local const to avoid import access overhead
// https://github.com/vitest-dev/vitest/issues/6903
const unrollBuffer = _unrollBuffer

function createSyncBuffer(levels: number, itemsPerLevel: number): SSRBuffer {
  const buffer = createBuffer()

  function addItems(buf: ReturnType<typeof createBuffer>, level: number) {
    for (let i = 1; i <= levels * itemsPerLevel; i++) {
      buf.push(`sync${level}.${i}`)
    }
    if (level < levels) {
      const subBuffer = createBuffer()
      addItems(subBuffer, level + 1)
      buf.push(subBuffer.getBuffer())
    }
  }

  addItems(buffer, 1)
  return buffer.getBuffer()
}

function createMixedBuffer(levels: number, itemsPerLevel: number): SSRBuffer {
  const buffer = createBuffer()

  function addItems(buf: ReturnType<typeof createBuffer>, level: number) {
    for (let i = 1; i <= levels * itemsPerLevel; i++) {
      if (i % 3 === 0) {
        // @ts-expect-error testing...
        buf.push(Promise.resolve(`async${level}.${i}`))
      } else {
        buf.push(`sync${level}.${i}`)
      }
    }
    if (level < levels) {
      const subBuffer = createBuffer()
      addItems(subBuffer, level + 1)
      buf.push(subBuffer.getBuffer())
    }
  }

  addItems(buffer, 1)
  return buffer.getBuffer()
}

describe('unrollBuffer', () => {
  let syncBuffer = createBuffer().getBuffer()
  let mixedBuffer = createBuffer().getBuffer()

  bench(
    'sync',
    () => {
      return unrollBuffer(syncBuffer) as any
    },
    {
      setup() {
        syncBuffer = createSyncBuffer(5, 3)
      },
    },
  )

  bench(
    'mixed',
    () => {
      return unrollBuffer(mixedBuffer) as any
    },
    {
      setup() {
        mixedBuffer = createMixedBuffer(5, 3)
      },
    },
  )
})
