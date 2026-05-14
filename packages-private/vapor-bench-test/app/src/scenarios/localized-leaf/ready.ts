declare global {
  interface Window {
    __BENCH_READY__?: boolean
    __BENCH_RUN_OPERATION__?: (operation: string) => void | Promise<void>
    __BENCH_ASSERT_OPERATION__?: (operation: string) => void
  }
}

export function installLocalizedLeafBenchmark(
  target: string,
  runOperation: (operation: string) => void | Promise<void>,
) {
  const benchWindow = globalThis as Window
  const benchDocument = globalThis.document

  benchWindow.__BENCH_RUN_OPERATION__ = runOperation
  benchWindow.__BENCH_ASSERT_OPERATION__ = assertLocalizedLeafOperation

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      performance.mark('bench:first-screen-ready')
      benchDocument.documentElement.dataset.benchScenario = 'localized-leaf'
      benchDocument.documentElement.dataset.benchTarget = target
      benchDocument.documentElement.dataset.benchReady = 'true'
      benchWindow.__BENCH_READY__ = true
    })
  })
}

function assertLocalizedLeafOperation(operation: string) {
  const state = readBenchState()
  const updated = state[0]
  const hotCell = state[1]
  const rowCell = state[2]
  const firstCell = state[3]

  assertTextIncludes('.leaf-summary', `${updated} updates`)
  assertCellText(5050, hotCell)
  assertCellText(0, firstCell)

  if (operation === 'update-row' || operation === 'update-1000-cells') {
    assertCellText(5000, rowCell)
  }
}

function readBenchState() {
  const marker = globalThis.document.querySelector('[data-bench-state]')
  if (!marker || !marker.textContent) {
    throw new Error('Missing localized leaf bench state')
  }

  return marker.textContent.trim().split(':')
}

function assertTextIncludes(selector: string, expected: string) {
  const element = globalThis.document.querySelector(selector)
  if (
    !element ||
    !element.textContent ||
    !element.textContent.includes(expected)
  ) {
    throw new Error(`Expected ${selector} to include "${expected}"`)
  }
}

function assertCellText(index: number, expected: string) {
  const cell = globalThis.document.querySelectorAll('.leaf-cell')[index]
  const actual = cell && cell.textContent ? cell.textContent.trim() : ''

  if (actual !== expected) {
    throw new Error(
      `Expected cell ${index} to be "${expected}", got "${actual}"`,
    )
  }
}
