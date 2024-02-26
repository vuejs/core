import { bench } from 'vitest'
import {
  computed,
  effect,
  reactive,
  readonly,
  shallowRef,
  triggerRef,
} from '../src'

for (let amount = 1e1; amount < 1e4; amount *= 10) {
  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = reactive(rawArray)

    bench(`track for loop on reactive array, ${amount} elements`, () => {
      let sum = 0
      effect(() => {
        for (let i = 0; i < arr.length; i++) {
          sum += arr[i]
        }
      })
    })
  }

  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = reactive(rawArray)

    bench(`track iteration on reactive array, ${amount} elements`, () => {
      let sum = 0
      effect(() => {
        for (let x of arr) {
          sum += x
        }
      })
    })
  }

  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = reactive(rawArray)

    bench(`track forEach on reactive array, ${amount} elements`, () => {
      let sum = 0
      effect(() => {
        arr.forEach(x => (sum += x))
      })
    })
  }

  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = reactive(rawArray)

    bench(`track reduce on reactive array, ${amount} elements`, () => {
      let sum = 0
      effect(() => {
        sum = arr.reduce((v, a) => a + v, 0)
      })
    })
  }

  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = readonly(rawArray)

    bench(`track for loop on readonly array, ${amount} elements`, () => {
      let sum = 0
      effect(() => {
        for (let i = 0; i < arr.length; i++) {
          sum += arr[i]
        }
      })
    })
  }

  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = readonly(rawArray)

    bench(`track iteration on readonly array, ${amount} elements`, () => {
      let sum = 0
      effect(() => {
        for (let x of arr) {
          sum += x
        }
      })
    })
  }

  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = readonly(rawArray)

    bench(`track forEach on readonly array, ${amount} elements`, () => {
      let sum = 0
      effect(() => {
        arr.forEach(x => (sum += x))
      })
    })
  }

  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = readonly(rawArray)

    bench(`track reduce on readonly array, ${amount} elements`, () => {
      let sum = 0
      effect(() => {
        sum = arr.reduce((v, a) => a + v, 0)
      })
    })
  }

  {
    const rawArray: any[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const r = reactive(rawArray)
    effect(() => r.reduce((v, a) => a + v, 0))

    bench(
      `trigger index mutation (1st only) on *reactive* array (tracked with reduce), ${amount} elements`,
      () => {
        r[0]++
      },
    )
  }

  {
    const rawArray: any[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const r = reactive(rawArray)
    effect(() => r.reduce((v, a) => a + v, 0))

    bench(
      `trigger index mutation (all) on *reactive* array (tracked with reduce), ${amount} elements`,
      () => {
        for (let i = 0, n = r.length; i < n; i++) {
          r[i]++
        }
      },
    )
  }

  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = reactive(rawArray)
    let sum = 0
    effect(() => {
      for (let x of arr) {
        sum += x
      }
    })

    bench(
      `push() trigger on reactive array tracked via iteration, ${amount} elements`,
      () => {
        arr.push(1)
      },
    )
  }

  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = reactive(rawArray)
    let sum = 0
    effect(() => {
      arr.forEach(x => (sum += x))
    })

    bench(
      `push() trigger on reactive array tracked via forEach, ${amount} elements`,
      () => {
        arr.push(1)
      },
    )
  }
}
