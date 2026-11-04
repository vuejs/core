import { describe } from 'vite-plus/test'
import { test } from '../../../scripts/bench'
import * as reactivity from '../dist/reactivity.esm-browser.prod'

const { ref } = reactivity

describe('ref', () => {
  test('create ref', async ({ benchmark }) => {
    await benchmark(() => {
      ref(100)
    })
  })

  {
    let i = 0
    const v = ref(100)
    test('write ref', async ({ benchmark }) => {
      await benchmark(() => {
        v.value = i++
      })
    })
  }

  {
    const v = ref(100)
    test('read ref', async ({ benchmark }) => {
      await benchmark(() => {
        v.value
      })
    })
  }

  {
    let i = 0
    const v = ref(100)
    test('write/read ref', async ({ benchmark }) => {
      await benchmark(() => {
        v.value = i++
        v.value
      })
    })
  }
})
