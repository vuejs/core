import { computed, effect, optimistic, ref } from '../src'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('optimistic', () => {
  test('publishes an overlay immediately and reconciles a readonly computed', async () => {
    const source = ref(1)
    const target = computed(() => source.value)
    const derived = computed(() => target.value * 2)
    const values: number[] = []
    effect(() => values.push(derived.value))
    const request = deferred<number>()
    const result = optimistic(target, {
      update: n => n + 1,
      run: () => request.promise,
      commit: (n, saved) => n + saved,
    })
    expect(derived.value).toBe(4)
    request.resolve(10)
    await expect(result).resolves.toBe(10)
    expect(target.value).toBe(12)
    expect(values).toEqual([2, 4, 24])
    source.value = 5
    expect(target.value).toBe(5)
  })

  test('rolls back only the rejected layer and rebases later fulfilled layers', async () => {
    const target = ref('base')
    const a = deferred<string>()
    const b = deferred<string>()
    const first = optimistic(target, {
      update: s => s + '-a',
      run: () => a.promise,
    })
    const second = optimistic(target, {
      update: s => s + '-b',
      run: () => b.promise,
      commit: (s, value) => s + value,
    })
    expect(target.value).toBe('base-a-b')
    b.resolve('!')
    await second
    expect(target.value).toBe('base-a-b!')
    const error = new Error('failed')
    a.reject(error)
    await expect(first).rejects.toBe(error)
    expect(target.value).toBe('base-b!')
  })

  test('replays active layers over direct writes', async () => {
    const target = ref(1)
    const request = deferred<void>()
    const mutation = optimistic(target, {
      update: n => n + 1,
      run: () => request.promise,
    })
    expect(target.value).toBe(2)
    target.value = 10
    expect(target.value).toBe(11)
    request.resolve()
    await mutation
    expect(target.value).toBe(11)
  })

  test('does not start run when no answer has settled', async () => {
    const target = computed(() => new Promise<number>(() => {}))
    const run = vi.fn()
    await expect(
      optimistic(target, { update: n => n + 1, run }),
    ).rejects.toBeDefined()
    expect(run).not.toHaveBeenCalled()
  })

  test('rolls back synchronous run and commit errors', async () => {
    const target = ref(1)
    const error = new Error('failed')
    await expect(
      optimistic(target, {
        update: n => n + 1,
        run: () => {
          throw error
        },
      }),
    ).rejects.toBe(error)
    expect(target.value).toBe(1)
    await expect(
      optimistic(target, {
        update: n => n + 1,
        run: () => 2,
        commit: () => {
          throw error
        },
      }),
    ).rejects.toBe(error)
    expect(target.value).toBe(1)
  })
})

test('replays optimistic layers over async revalidation and keeps the overlay readable', async () => {
  const refresh = ref(false)
  const request = deferred<number>()
  const source = computed(() => (refresh.value ? request.promise : 1))
  const target = computed(() => source.value * 10)
  expect(target.value).toBe(10)
  refresh.value = true
  const mutation = deferred<number>()
  const result = optimistic(target, {
    update: n => n + 1,
    run: () => mutation.promise,
  })
  expect(target.value).toBe(11)
  request.resolve(2)
  for (let i = 0; i < 4; i++) await Promise.resolve()
  expect(target.value).toBe(21)
  mutation.resolve(42)
  await result
  expect(target.value).toBe(21)
})
