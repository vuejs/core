import { computed, effect, effectScope, ref } from '../src'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function pending(read: () => unknown): Promise<void> {
  try {
    read()
  } catch (error: any) {
    expect(error.promise).toBeInstanceOf(Promise)
    return error.promise
  }
  throw new Error('expected a pending computation')
}

describe('async computed', () => {
  test('lazily assimilates promises and composes through computed values', async () => {
    const request = deferred<{ name: string }>()
    const getter = vi.fn(() => request.promise)
    const user = computed(getter)
    const name = computed(() => user.value.name)
    const heading = computed(() => `Hello ${name.value}`)
    expect(getter).not.toHaveBeenCalled()
    const ready = pending(() => heading.value)
    pending(() => heading.value)
    expect(getter).toHaveBeenCalledTimes(1)
    request.resolve({ name: 'Vue' })
    await ready
    expect(heading.value).toBe('Hello Vue')
    expect(getter).toHaveBeenCalledTimes(1)
  })

  test('holds refreshes and ignores obsolete fulfillment and rejection', async () => {
    const id = ref(0)
    const requests = [
      deferred<string>(),
      deferred<string>(),
      deferred<string>(),
    ]
    const value = computed(() => requests[id.value].promise)
    const first = pending(() => value.value)
    requests[0].resolve('first')
    await first
    expect(value.value).toBe('first')
    id.value = 1
    const obsolete = pending(() => value.value)
    id.value = 2
    const latest = pending(() => value.value)
    requests[2].resolve('latest')
    await latest
    requests[1].reject(new Error('obsolete'))
    await obsolete
    expect(value.value).toBe('latest')
  })

  test('retries rejected generations after invalidation', async () => {
    const id = ref(0)
    const request = deferred<string>()
    const value = computed(() => (id.value ? 'recovered' : request.promise))
    const ready = pending(() => value.value)
    const error = new Error('failed')
    request.reject(error)
    await ready
    expect(() => value.value).toThrow(error)
    id.value++
    expect(value.value).toBe('recovered')
  })

  test('assimilates thenables, including nested promises', async () => {
    const value = computed(
      () =>
        ({
          then: (resolve: any) => resolve(Promise.resolve(42)),
        }) as PromiseLike<number>,
    )
    await pending(() => value.value)
    expect(value.value).toBe(42)
  })

  test('keeps writable computed and wrapped promises unchanged', () => {
    const promise = Promise.resolve(42)
    const writable = computed({ get: () => promise, set: () => {} })
    expect(writable.value).toBe(promise)
    expect(computed(() => ({ promise })).value.promise).toBe(promise)
  })

  test('tracks only reads before await', async () => {
    const before = ref(1)
    const after = ref(1)
    const getter = vi.fn(async () => {
      const n = before.value
      await Promise.resolve()
      return n + after.value
    })
    const value = computed(getter)
    await pending(() => value.value)
    expect(value.value).toBe(2)
    after.value++
    expect(value.value).toBe(2)
    before.value++
    await pending(() => value.value)
    expect(value.value).toBe(4)
    expect(getter).toHaveBeenCalledTimes(2)
  })

  test('does not publish a late result after its creating scope stops', async () => {
    const scope = effectScope()
    const request = deferred<number>()
    const value = scope.run(() => computed(() => request.promise))!
    const ready = pending(() => value.value)
    scope.stop()
    request.resolve(42)
    await ready
    expect((value as any)._value).toBeUndefined()
  })

  test('notifies subscribers when an equal value settles again', async () => {
    const id = ref(0)
    const value = computed(() => Promise.resolve(id.value && 0))
    const values: number[] = []
    effect(() => {
      try {
        values.push(value.value)
      } catch {}
    })
    await pending(() => value.value)
    expect(values).toEqual([0])
    id.value++
    await pending(() => value.value)
    expect(values).toEqual([0, 0])
  })
})

test('retries an async derived getter that initially reads a pending source', async () => {
  const request = deferred<number>()
  const source = computed(() => request.promise)
  const derived = computed(async () => source.value * 2)
  const ready = pending(() => derived.value)
  request.resolve(21)
  await ready
  await pending(() => derived.value)
  expect(derived.value).toBe(42)
})

test('does not commit a request invalidated before its next read', async () => {
  const id = ref(0)
  const first = deferred<number>()
  const second = deferred<number>()
  const value = computed(() => (id.value ? second.promise : first.promise))
  const ready = pending(() => value.value)
  id.value++
  first.resolve(1)
  await ready
  expect((value as any)._value).toBeUndefined()
  const latest = pending(() => value.value)
  second.resolve(2)
  await latest
  expect(value.value).toBe(2)
})

test('passes the last fulfilled answer to an async getter', async () => {
  const id = ref(0)
  const value = computed<Promise<number>>(
    async previous => id.value + (previous || 0),
  )
  await pending(() => value.value)
  expect(value.value).toBe(0)
  id.value = 2
  await pending(() => value.value)
  expect(value.value).toBe(2)
  id.value = 3
  await pending(() => value.value)
  expect(value.value).toBe(5)
})
