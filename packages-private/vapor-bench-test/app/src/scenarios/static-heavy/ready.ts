declare global {
  interface Window {
    __BENCH_READY__?: boolean
  }
}

export function markStaticHeavyReady(target: string) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      performance.mark('bench:first-screen-ready')
      document.documentElement.dataset.benchScenario = 'static-heavy'
      document.documentElement.dataset.benchTarget = target
      document.documentElement.dataset.benchReady = 'true'
      window.__BENCH_READY__ = true
    })
  })
}
