import { cdp } from 'vitest/browser'

export const E2E_TIMEOUT: number = 30 * 1000

const maxTries = 30
const vueGlobalBuildUrl = new URL('../../dist/vue.global.js', import.meta.url)
  .href
const transitionStyle = `
  .test {
    -webkit-transition: opacity 50ms ease;
    transition: opacity 50ms ease;
  }
  .group-move {
    -webkit-transition: -webkit-transform 50ms ease;
    transition: transform 50ms ease;
  }
  .v-appear,
  .v-enter,
  .v-leave-active,
  .test-appear,
  .test-enter,
  .test-leave-active,
  .test-reflow-enter,
  .test-reflow-leave-to,
  .hello,
  .bye.active,
  .changed-enter {
    opacity: 0;
  }
  .test-reflow-leave-active,
  .test-reflow-enter-active {
    -webkit-transition: opacity 50ms ease;
    transition: opacity 50ms ease;
  }
  .test-reflow-leave-from {
    opacity: 0.9;
  }
  .test-anim-enter-active {
    animation: test-enter 50ms;
    -webkit-animation: test-enter 50ms;
  }
  .test-anim-leave-active {
    animation: test-leave 50ms;
    -webkit-animation: test-leave 50ms;
  }
  .test-anim-long-enter-active {
    animation: test-enter 100ms;
    -webkit-animation: test-enter 100ms;
  }
  .test-anim-long-leave-active {
    animation: test-leave 100ms;
    -webkit-animation: test-leave 100ms;
  }
  @keyframes test-enter {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @-webkit-keyframes test-enter {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes test-leave {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
  @-webkit-keyframes test-leave {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
`

export const timeout = (n: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, n))

export async function expectByPolling(
  poll: () => Promise<any>,
  expected: string,
): Promise<void> {
  for (let tries = 0; tries < maxTries; tries++) {
    const actual = (await poll()) || ''
    if (actual.indexOf(expected) > -1 || tries === maxTries - 1) {
      expect(actual).toMatch(expected)
      break
    } else {
      await timeout(50)
    }
  }
}

export interface ElementHandle<T extends Element = Element> {
  evaluate<R>(fn: (node: T) => R | Promise<R>): Promise<R>
}

interface BrowserPage {
  goto(url?: string): Promise<void>
  waitForSelector(selector: string): Promise<Element>
  evaluate<R>(fn: () => R | Promise<R>): Promise<R>
  evaluate<Arg, R>(fn: (arg: Arg) => R | Promise<R>, arg: Arg): Promise<R>
  exposeFunction(name: string, fn: (...args: any[]) => any): Promise<void>
  $eval<R>(selector: string, fn: (node: Element) => R | Promise<R>): Promise<R>
  $$eval<R>(
    selector: string,
    fn: (nodes: Element[]) => R | Promise<R>,
  ): Promise<R>
  createCDPSession(): Promise<{
    send(method: string, params?: Record<string, unknown>): Promise<unknown>
  }>
  on(event: 'pageerror', handler: (...args: any[]) => void): void
  off(event: 'pageerror', handler: (...args: any[]) => void): void
}

interface BrowserUtils {
  page: () => BrowserPage
  reset(): Promise<void>
  click(selector: string): Promise<void>
  count(selector: string): Promise<number>
  text(selector: string): Promise<string | null>
  value(selector: string): Promise<string>
  html(selector: string): Promise<string>
  classList(selector: string): Promise<string[]>
  style(selector: string, property: keyof CSSStyleDeclaration): Promise<any>
  children(selector: string): Promise<any[]>
  isVisible(selector: string): Promise<boolean>
  isChecked(selector: string): Promise<boolean>
  isFocused(selector: string): Promise<boolean>
  setValue(selector: string, value: string): Promise<void>
  typeValue(selector: string, value: string): Promise<void>
  enterValue(selector: string, value: string): Promise<void>
  clearValue(selector: string): Promise<void>
  timeout(time: number): Promise<void>
  nextFrame(): Promise<void>
}

type PageErrorHandler = {
  error: EventListener
  rejection: EventListener
}

function installVueGlobalBuild() {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.async = false
    script.src = vueGlobalBuildUrl
    script.onload = () => {
      script.remove()
      if ((window as any).Vue) {
        resolve()
      } else {
        reject(new Error('Failed to expose Vue from vue.global.js.'))
      }
    }
    script.onerror = () => {
      script.remove()
      reject(new Error(`Failed to load ${vueGlobalBuildUrl}.`))
    }
    document.head.appendChild(script)
  })
}

function installTransitionStyle() {
  const style = document.createElement('style')
  style.dataset.vueTransitionE2e = ''
  style.textContent = transitionStyle
  document.head.appendChild(style)
}

const vueGlobalBuildReady = installVueGlobalBuild()
installTransitionStyle()

export function setupBrowserE2E(): BrowserUtils {
  const pageErrorHandlers = new Map<
    (...args: any[]) => void,
    PageErrorHandler
  >()
  const initialHeadNodes = new Set<Node>(Array.from(document.head.childNodes))

  function resetPageErrorHandlers() {
    pageErrorHandlers.forEach(({ error, rejection }) => {
      window.removeEventListener('error', error)
      window.removeEventListener('unhandledrejection', rejection)
    })
    pageErrorHandlers.clear()
  }

  function resetHead() {
    Array.from(document.head.childNodes).forEach(node => {
      if (
        !initialHeadNodes.has(node) &&
        !(
          node instanceof HTMLStyleElement &&
          node.dataset.vueTransitionE2e != null
        )
      ) {
        node.remove()
      }
    })
  }

  async function resetPage() {
    // Browser mode runs in Vitest's iframe instead of loading transition.html.
    // Keep these specs on the same global build that `test-e2e` prepares.
    resetPageErrorHandlers()
    await vueGlobalBuildReady
    resetHead()
    localStorage.clear()
    sessionStorage.clear()
    document.body.innerHTML = '<div id="app"></div>'
  }

  function getElement<T extends Element = Element>(selector: string): T {
    const el = document.querySelector<T>(selector)
    if (!el) {
      throw new Error(`Unable to find element: ${selector}`)
    }
    return el
  }

  function createElementHandle<T extends Element>(node: T): ElementHandle<T> {
    return {
      async evaluate<R>(fn: (node: T) => R | Promise<R>) {
        return (await fn(node)) as Awaited<R>
      },
    }
  }

  function toExposedArg(arg: unknown) {
    return arg instanceof Element ? createElementHandle(arg) : arg
  }

  const browserPage: BrowserPage = {
    async goto() {
      await resetPage()
    },

    async waitForSelector(selector) {
      const existing = document.querySelector(selector)
      if (existing) {
        return existing
      }

      return await new Promise<Element>((resolve, reject) => {
        const observer = new MutationObserver(() => {
          const el = document.querySelector(selector)
          if (el) {
            cleanup()
            resolve(el)
          }
        })
        const timer = setTimeout(() => {
          cleanup()
          reject(new Error(`Timed out waiting for selector: ${selector}`))
        }, 1000)
        const cleanup = () => {
          clearTimeout(timer)
          observer.disconnect()
        }

        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
        })
      })
    },

    async evaluate(fn: (...args: any[]) => any, arg?: unknown) {
      const result = await fn(arg)
      // Match the async boundary Puppeteer's page.evaluate used to provide.
      await Promise.resolve() // Vue patch job queued by the evaluated callback.
      await Promise.resolve() // Suspense async setup / branch resolution.
      await Promise.resolve() // DOM transition start queued after resolution.
      return result
    },

    async exposeFunction(name, fn) {
      ;(window as any)[name] = (...args: unknown[]) =>
        fn(...args.map(toExposedArg))
    },

    async $eval(selector, fn) {
      return (await fn(getElement(selector))) as Awaited<ReturnType<typeof fn>>
    },

    async $$eval(selector, fn) {
      return (await fn(
        Array.from(document.querySelectorAll(selector)),
      )) as Awaited<ReturnType<typeof fn>>
    },

    async createCDPSession() {
      const session = cdp() as {
        send(method: string, params?: Record<string, unknown>): Promise<unknown>
      }
      return {
        send: (method, params) => session.send(method, params),
      }
    },

    on(event, handler) {
      if (event !== 'pageerror') {
        return
      }
      const error = ((e: ErrorEvent) => handler(e.error || e.message)) as
        EventListener | any
      const rejection = ((e: PromiseRejectionEvent) => handler(e.reason)) as
        EventListener | any
      pageErrorHandlers.set(handler, { error, rejection })
      window.addEventListener('error', error)
      window.addEventListener('unhandledrejection', rejection)
    },

    off(event, handler) {
      if (event !== 'pageerror') {
        return
      }
      const listeners = pageErrorHandlers.get(handler)
      if (listeners) {
        window.removeEventListener('error', listeners.error)
        window.removeEventListener('unhandledrejection', listeners.rejection)
        pageErrorHandlers.delete(handler)
      }
    },
  }

  async function click(selector: string) {
    getElement<HTMLElement>(selector).click()
  }

  async function reset() {
    await resetPage()
  }

  async function count(selector: string) {
    return document.querySelectorAll(selector).length
  }

  async function text(selector: string) {
    return getElement(selector).textContent
  }

  async function value(selector: string) {
    return getElement<HTMLInputElement>(selector).value
  }

  async function html(selector: string) {
    return getElement(selector).innerHTML
  }

  async function classList(selector: string) {
    return Array.from(getElement(selector).classList)
  }

  async function children(selector: string) {
    return Array.from(getElement(selector).children)
  }

  async function style(selector: string, property: keyof CSSStyleDeclaration) {
    return window.getComputedStyle(getElement(selector))[property]
  }

  async function isVisible(selector: string) {
    return window.getComputedStyle(getElement(selector)).display !== 'none'
  }

  async function isChecked(selector: string) {
    return getElement<HTMLInputElement>(selector).checked
  }

  async function isFocused(selector: string) {
    return getElement(selector) === document.activeElement
  }

  async function setValue(selector: string, value: string) {
    const el = getElement<HTMLInputElement>(selector)
    el.value = value
    el.dispatchEvent(new Event('input'))
  }

  async function typeValue(selector: string, value: string) {
    const el = getElement<HTMLInputElement>(selector)
    el.value = value
    el.dispatchEvent(new Event('input'))
  }

  async function enterValue(selector: string, value: string) {
    await typeValue(selector, value)
    getElement<HTMLInputElement>(selector).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter' }),
    )
  }

  async function clearValue(selector: string) {
    getElement<HTMLInputElement>(selector).value = ''
  }

  async function nextFrame() {
    return new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve())
      })
    })
  }

  return {
    page: () => browserPage,
    reset,
    click,
    count,
    text,
    value,
    html,
    classList,
    style,
    children,
    isVisible,
    isChecked,
    isFocused,
    setValue,
    typeValue,
    enterValue,
    clearValue,
    timeout,
    nextFrame,
  }
}
