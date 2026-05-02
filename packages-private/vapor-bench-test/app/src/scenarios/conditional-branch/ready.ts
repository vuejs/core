declare global {
  interface Window {
    __BENCH_READY__?: boolean
    __BENCH_RUN_OPERATION__?: (operation: string) => void | Promise<void>
    __BENCH_ASSERT_OPERATION__?: (operation: string) => void
  }
}

export function installConditionalBranchBenchmark(
  target: string,
  runOperation: (operation: string) => void | Promise<void>,
) {
  window.__BENCH_RUN_OPERATION__ = runOperation
  window.__BENCH_ASSERT_OPERATION__ = assertConditionalBranchOperation

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      performance.mark('bench:first-screen-ready')
      document.documentElement.dataset.benchScenario = 'conditional-branch'
      document.documentElement.dataset.benchTarget = target
      document.documentElement.dataset.benchReady = 'true'
      window.__BENCH_READY__ = true
    })
  })
}

function assertConditionalBranchOperation() {
  const state = readBenchState()
  const flips = state[0]
  const hotExpanded = state[1] === 'true'
  const firstExpanded = state[2] === 'true'
  const lastExpanded = state[3] === 'true'

  assertTextIncludes('.branch-summary', `${flips} flips`)
  assertBranchState(247, hotExpanded)
  assertBranchState(0, firstExpanded)
  assertBranchState(479, lastExpanded)
}

function readBenchState() {
  const marker = document.querySelector('[data-bench-state]')
  if (!marker || !marker.textContent) {
    throw new Error('Missing conditional branch bench state')
  }

  return marker.textContent.trim().split(':')
}

function assertTextIncludes(selector: string, expected: string) {
  const element = document.querySelector(selector)
  if (
    !element ||
    !element.textContent ||
    !element.textContent.includes(expected)
  ) {
    throw new Error(`Expected ${selector} to include "${expected}"`)
  }
}

function assertBranchState(index: number, expanded: boolean) {
  const slot = document.querySelectorAll('.branch-slot')[index]
  if (!slot) {
    throw new Error(`Missing branch slot ${index}`)
  }

  const selector = expanded ? '.branch-card--expanded' : '.branch-card--compact'
  const card = slot.querySelector(selector)

  if (!card) {
    throw new Error(
      `Expected branch ${index} to render ${
        expanded ? 'expanded' : 'compact'
      } branch DOM`,
    )
  }
}
