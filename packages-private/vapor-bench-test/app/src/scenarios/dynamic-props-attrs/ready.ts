declare global {
  interface Window {
    __BENCH_READY__?: boolean
    __BENCH_RUN_OPERATION__?: (operation: string) => void | Promise<void>
    __BENCH_ASSERT_OPERATION__?: (operation: string) => void
  }
}

const TONES = ['neutral', 'success', 'warning', 'danger']
const ITEMS_PER_GROUP = 20

export function installDynamicPropsAttrsBenchmark(
  target: string,
  runOperation: (operation: string) => void | Promise<void>,
) {
  window.__BENCH_RUN_OPERATION__ = runOperation
  window.__BENCH_ASSERT_OPERATION__ = assertDynamicPropsAttrsOperation

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      performance.mark('bench:first-screen-ready')
      document.documentElement.dataset.benchScenario = 'dynamic-props-attrs'
      document.documentElement.dataset.benchTarget = target
      document.documentElement.dataset.benchReady = 'true'
      window.__BENCH_READY__ = true
    })
  })
}

function assertDynamicPropsAttrsOperation() {
  const state = readBenchState()
  const activeId = Number(state[0])
  const attrRevision = Number(state[1])
  const variantSeed = Number(state[2])
  const activeCard = getCard(activeId)
  const expectedTone = getTone(activeId, variantSeed)
  const expectedRevision = String(attrRevision)
  const expectedRank = String((getScore(activeId) + attrRevision) % 100)

  assertTextIncludes('.attrs-summary', `revision ${attrRevision}`)
  assertClass(activeCard, 'is-active')
  assertClass(activeCard, `tone-${expectedTone}`)
  assertTextIncludes(activeCard, `active attr revision ${attrRevision}`)
  assertAttribute(activeCard, 'data-revision', expectedRevision)
  assertAttribute(activeCard, 'data-rank', expectedRank)
  assertAttribute(activeCard, 'title', `${getCode(activeId)} ${expectedTone}`)
  assertAttribute(
    activeCard,
    'aria-label',
    `${getTitle(activeId)} ${expectedTone} revision ${attrRevision}`,
  )
}

function readBenchState() {
  const marker = document.querySelector('[data-bench-state]')
  if (!marker || !marker.textContent) {
    throw new Error('Missing dynamic props attrs bench state')
  }

  return marker.textContent.trim().split(':')
}

function getCard(index: number) {
  const card = document.querySelectorAll('.attrs-card')[index]
  if (!card) {
    throw new Error(`Missing attrs card ${index}`)
  }

  return card
}

function getTone(id: number, variantSeed: number) {
  return TONES[(id + variantSeed + 1) % TONES.length]
}

function getScore(id: number) {
  return 25 + ((id * 17) % 75)
}

function getTitle(id: number) {
  const group = Math.floor(id / ITEMS_PER_GROUP)
  const index = id % ITEMS_PER_GROUP
  return `Attr card ${group + 1}-${index + 1}`
}

function getCode(id: number) {
  return `DA-${String(id + 1).padStart(4, '0')}`
}

function assertClass(element: Element, className: string) {
  if (!element.classList.contains(className)) {
    throw new Error(`Expected element to have class "${className}"`)
  }
}

function assertAttribute(element: Element, name: string, expected: string) {
  const actual = element.getAttribute(name)
  if (actual !== expected) {
    throw new Error(`Expected ${name}="${expected}", got "${actual}"`)
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
