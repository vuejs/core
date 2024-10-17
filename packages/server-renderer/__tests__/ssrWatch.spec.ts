import {
  createSSRApp,
  defineComponent,
  h,
  nextTick,
  ref,
  watch,
  watchEffect,
} from 'vue'
import { type SSRContext, renderToString } from '../src'

describe('ssr: watch', () => {
  // #6013
  test('should work w/ flush:sync', async () => {
    const App = defineComponent(() => {
      const count = ref(0)
      let msg = ''
      watch(
        count,
        () => {
          msg = 'hello world'
        },
        { flush: 'sync' },
      )
      count.value = 1
      expect(msg).toBe('hello world')
      return () => h('div', null, msg)
    })

    const app = createSSRApp(App)
    const ctx: SSRContext = {}
    const html = await renderToString(app, ctx)

    expect(ctx.__watcherHandles!.length).toBe(1)

    expect(html).toMatch('hello world')
  })

  test('should work with flush: sync and immediate: true', async () => {
    const text = ref('start')
    let msg = 'unchanged'

    const App = defineComponent(() => {
      watch(
        text,
        () => {
          msg = text.value
        },
        { flush: 'sync', immediate: true },
      )
      expect(msg).toBe('start')
      text.value = 'changed'
      expect(msg).toBe('changed')
      text.value = 'changed again'
      expect(msg).toBe('changed again')
      return () => h('div', null, msg)
    })

    const app = createSSRApp(App)
    const ctx: SSRContext = {}
    const html = await renderToString(app, ctx)

    expect(ctx.__watcherHandles!.length).toBe(1)
    expect(html).toMatch('changed again')
    await nextTick()
    expect(msg).toBe('changed again')
  })

  test('should run once with immediate: true', async () => {
    const text = ref('start')
    let msg = 'unchanged'

    const App = defineComponent(() => {
      watch(
        text,
        () => {
          msg = String(text.value)
        },
        { immediate: true },
      )
      text.value = 'changed'
      expect(msg).toBe('start')
      return () => h('div', null, msg)
    })

    const app = createSSRApp(App)
    const ctx: SSRContext = {}
    const html = await renderToString(app, ctx)

    expect(ctx.__watcherHandles).toBeUndefined()
    expect(html).toMatch('start')
    await nextTick()
    expect(msg).toBe('start')
  })

  test('should run once with immediate: true and flush: post', async () => {
    const text = ref('start')
    let msg = 'unchanged'

    const App = defineComponent(() => {
      watch(
        text,
        () => {
          msg = String(text.value)
        },
        { immediate: true, flush: 'post' },
      )
      text.value = 'changed'
      expect(msg).toBe('start')
      return () => h('div', null, msg)
    })

    const app = createSSRApp(App)
    const ctx: SSRContext = {}
    const html = await renderToString(app, ctx)

    expect(ctx.__watcherHandles).toBeUndefined()
    expect(html).toMatch('start')
    await nextTick()
    expect(msg).toBe('start')
  })
})

describe('ssr: watchEffect', () => {
  test('should run with flush: sync', async () => {
    const text = ref('start')
    let msg = 'unchanged'

    const App = defineComponent(() => {
      watchEffect(
        () => {
          msg = text.value
        },
        { flush: 'sync' },
      )
      expect(msg).toBe('start')
      text.value = 'changed'
      expect(msg).toBe('changed')
      text.value = 'changed again'
      expect(msg).toBe('changed again')
      return () => h('div', null, msg)
    })

    const app = createSSRApp(App)
    const ctx: SSRContext = {}
    const html = await renderToString(app, ctx)

    expect(ctx.__watcherHandles!.length).toBe(1)
    expect(html).toMatch('changed again')
    await nextTick()
    expect(msg).toBe('changed again')
  })

  test('should run once with default flush (pre)', async () => {
    const text = ref('start')
    let msg = 'unchanged'

    const App = defineComponent(() => {
      watchEffect(() => {
        msg = text.value
      })
      text.value = 'changed'
      expect(msg).toBe('start')
      return () => h('div', null, msg)
    })

    const app = createSSRApp(App)
    const ctx: SSRContext = {}
    const html = await renderToString(app, ctx)

    expect(ctx.__watcherHandles).toBeUndefined()
    expect(html).toMatch('start')
    await nextTick()
    expect(msg).toBe('start')
  })

  test('should not run for flush: post', async () => {
    const text = ref('start')
    let msg = 'unchanged'

    const App = defineComponent(() => {
      watchEffect(
        () => {
          msg = text.value
        },
        { flush: 'post' },
      )
      text.value = 'changed'
      expect(msg).toBe('unchanged')
      return () => h('div', null, msg)
    })

    const app = createSSRApp(App)
    const ctx: SSRContext = {}
    const html = await renderToString(app, ctx)

    expect(ctx.__watcherHandles).toBeUndefined()
    expect(html).toMatch('unchanged')
    await nextTick()
    expect(msg).toBe('unchanged')
  })
})
