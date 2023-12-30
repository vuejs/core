import { bench, describe } from 'vitest'
import { ref } from '../src/index'

describe('ref', () => {
  bench('create ref', () => {
    ref(100)
  })

  {
    let i = 0
    const v = ref(100)
    bench('write ref', () => {
      v.value = i++
    })
  }

  {
    const v = ref(100)
    bench('read ref', () => {
      v.value
    })
  }

  {
    let i = 0
    const v = ref(100)
    bench('write/read ref', () => {
      v.value = i++

      v.value
    })
  }
})
