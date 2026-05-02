declare global {
  interface Window {
    __BENCH_READY__?: boolean
    __BENCH_RUN_OPERATION__?: (operation: string) => void | Promise<void>
    __BENCH_ASSERT_OPERATION__?: (operation: string) => void
  }
}

export function installComponentFanoutBenchmark(
  target: string,
  runOperation: (operation: string) => void | Promise<void>,
) {
  window.__BENCH_RUN_OPERATION__ = runOperation
  window.__BENCH_ASSERT_OPERATION__ = assertComponentFanoutOperation

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      performance.mark('bench:first-screen-ready')
      document.documentElement.dataset.benchScenario = 'component-fanout'
      document.documentElement.dataset.benchTarget = target
      document.documentElement.dataset.benchReady = 'true'
      window.__BENCH_READY__ = true
    })
  })
}

function assertComponentFanoutOperation() {
  const state = readBenchState()
  const activeId = Number(state[0])
  const revision = state[1]
  const mode = state[2]
  const activeCard = getCard(activeId)
  const firstCard = getCard(0)

  assertTextIncludes('.fanout-summary', `revision ${revision}`)
  assertClass(activeCard, 'is-active')
  assertTextIncludes(activeCard, `active revision ${revision}`)
  assertTextIncludes(firstCard, mode)
  assertTextIncludes(firstCard, `r${revision}`)

  if (mode === 'busy') {
    assertClass(firstCard, 'is-busy')
  } else if (mode === 'alert') {
    assertClass(firstCard, 'is-alert')
  }
}

function readBenchState() {
  const marker = document.querySelector('[data-bench-state]')
  if (!marker || !marker.textContent) {
    throw new Error('Missing component fanout bench state')
  }

  return marker.textContent.trim().split(':')
}

function getCard(index: number) {
  const card = document.querySelectorAll('.fanout-card')[index]
  if (!card) {
    throw new Error(`Missing fanout card ${index}`)
  }

  return card
}

function assertClass(element: Element, className: string) {
  if (!element.classList.contains(className)) {
    throw new Error(`Expected element to have class "${className}"`)
  }
}

function assertTextIncludes(target: string | Element, expected: string) {
  const element =
    typeof target === 'string' ? document.querySelector(target) : target
  if (
    !element ||
    !element.textContent ||
    !element.textContent.includes(expected)
  ) {
    throw new Error(`Expected element text to include "${expected}"`)
  }
}
