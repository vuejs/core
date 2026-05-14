declare global {
  interface Window {
    __BENCH_READY__?: boolean
  }
}

export function markStaticHeavyReady(target: string) {
  const benchWindow = globalThis as Window
  const benchDocument = globalThis.document

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      performance.mark('bench:first-screen-ready')
      benchDocument.documentElement.dataset.benchScenario = 'static-heavy'
      benchDocument.documentElement.dataset.benchTarget = target
      benchDocument.documentElement.dataset.benchReady = 'true'
      benchWindow.__BENCH_READY__ = true
    })
  })
}
