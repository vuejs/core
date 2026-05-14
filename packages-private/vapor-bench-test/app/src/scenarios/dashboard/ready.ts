declare global {
  interface Window {
    __BENCH_READY__?: boolean
  }
}

export function markDashboardReady(target: string) {
  const benchWindow = globalThis as Window
  const benchDocument = globalThis.document

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      performance.mark('bench:first-screen-ready')
      benchDocument.documentElement.dataset.benchScenario = 'dashboard'
      benchDocument.documentElement.dataset.benchTarget = target
      benchDocument.documentElement.dataset.benchReady = 'true'
      benchWindow.__BENCH_READY__ = true
    })
  })
}
