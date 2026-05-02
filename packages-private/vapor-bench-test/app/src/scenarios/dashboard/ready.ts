declare global {
  interface Window {
    __BENCH_READY__?: boolean
  }
}

export function markDashboardReady(target: string) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      performance.mark('bench:first-screen-ready')
      document.documentElement.dataset.benchScenario = 'dashboard'
      document.documentElement.dataset.benchTarget = target
      document.documentElement.dataset.benchReady = 'true'
      window.__BENCH_READY__ = true
    })
  })
}
