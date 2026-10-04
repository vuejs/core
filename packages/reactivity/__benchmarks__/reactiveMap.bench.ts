import { test } from '../../../scripts/bench'
import type { ComputedRef } from '../src'
import * as reactivity from '../dist/reactivity.esm-browser.prod'

const { computed, reactive } = reactivity

function createMap(obj: Record<string, any>) {
  const map = new Map()
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      map.set(key, obj[key])
    }
  }
  return map
}

test('create reactive map', async ({ benchmark }) => {
  await benchmark(() => {
    reactive(createMap({ a: 1 }))
  })
})

{
  let i = 0
  const r = reactive(createMap({ a: 1 }))
  test('write reactive map property', async ({ benchmark }) => {
    await benchmark(() => {
      r.set('a', i++)
    })
  })
}

{
  const r = reactive(createMap({ a: 1 }))
  computed(() => {
    return r.get('a') * 2
  })
  let i = 0
  test("write reactive map, don't read computed (never invoked)", async ({
    benchmark,
  }) => {
    await benchmark(() => {
      r.set('a', i++)
    })
  })
}

{
  const r = reactive(createMap({ a: 1 }))
  const c = computed(() => {
    return r.get('a') * 2
  })
  c.value
  let i = 0
  test("write reactive map, don't read computed (invoked)", async ({
    benchmark,
  }) => {
    await benchmark(() => {
      r.set('a', i++)
    })
  })
}

{
  const r = reactive(createMap({ a: 1 }))
  const c = computed(() => {
    return r.get('a') * 2
  })
  let i = 0
  test('write reactive map, read computed', async ({ benchmark }) => {
    await benchmark(() => {
      r.set('a', i++)
      c.value
    })
  })
}

{
  const _m = new Map()
  for (let i = 0; i < 10000; i++) {
    _m.set(i, i)
  }
  const r = reactive(_m)
  const c = computed(() => {
    let total = 0
    r.forEach((value, key) => {
      total += value
    })
    return total
  })
  test("write reactive map (10'000 items), read computed", async ({
    benchmark,
  }) => {
    await benchmark(() => {
      r.set(5000, r.get(5000) + 1)
      c.value
    })
  })
}

{
  const r = reactive(createMap({ a: 1 }))
  const computeds: any[] = []
  for (let i = 0, n = 1000; i < n; i++) {
    const c = computed(() => {
      return r.get('a') * 2
    })
    computeds.push(c)
  }
  let i = 0
  test("write reactive map, don't read 1000 computeds (never invoked)", async ({
    benchmark,
  }) => {
    await benchmark(() => {
      r.set('a', i++)
    })
  })
}

{
  const r = reactive(createMap({ a: 1 }))
  const computeds: any[] = []
  for (let i = 0, n = 1000; i < n; i++) {
    const c = computed(() => {
      return r.get('a') * 2
    })
    c.value
    computeds.push(c)
  }
  let i = 0
  test("write reactive map, don't read 1000 computeds (invoked)", async ({
    benchmark,
  }) => {
    await benchmark(() => {
      r.set('a', i++)
    })
  })
}

{
  const r = reactive(createMap({ a: 1 }))
  const computeds: ComputedRef<number>[] = []
  for (let i = 0, n = 1000; i < n; i++) {
    const c = computed(() => {
      return r.get('a') * 2
    })
    computeds.push(c)
  }
  let i = 0
  test('write reactive map, read 1000 computeds', async ({ benchmark }) => {
    await benchmark(() => {
      r.set('a', i++)
      computeds.forEach(c => c.value)
    })
  })
}

{
  const reactives: Map<any, any>[] = []
  for (let i = 0, n = 1000; i < n; i++) {
    reactives.push(reactive(createMap({ a: i })))
  }
  const c = computed(() => {
    let total = 0
    reactives.forEach(r => (total += r.get('a')))
    return total
  })
  let i = 0
  const n = reactives.length
  test('1000 reactive maps, 1 computed', async ({ benchmark }) => {
    await benchmark(() => {
      reactives[i++ % n].set('a', reactives[i++ % n].get('a') + 1)
      c.value
    })
  })
}
