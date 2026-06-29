import { DynamicFragment, SlotFragment } from '../../src/fragment'
import { hydrateNode, setIsHydratingEnabled } from '../../src/dom/hydration'
import {
  type AnchorPlan,
  resolveDynamicAnchor,
  startPendingSlotContent,
  withHydratingSlotBoundary,
} from '../../src/dom/hydrateFragment'

function resolveWithCursor(cursor: Node, fn: () => AnchorPlan): AnchorPlan {
  setIsHydratingEnabled(true)
  try {
    let plan!: AnchorPlan
    hydrateNode(cursor, () => {
      plan = fn()
    })
    return plan
  } finally {
    setIsHydratingEnabled(false)
  }
}

function expectKind<K extends AnchorPlan['kind']>(
  plan: AnchorPlan,
  kind: K,
): Extract<AnchorPlan, { kind: K }> {
  expect(plan.kind).toBe(kind)
  return plan as Extract<AnchorPlan, { kind: K }>
}

describe('resolveDynamicAnchor', () => {
  test('empty branch reuses SSR placeholder comment', () => {
    const host = document.createElement('div')
    const placeholder = document.createComment('')
    host.append(placeholder)

    const plan = resolveWithCursor(placeholder, () =>
      resolveDynamicAnchor(new DynamicFragment('if', false, false), true),
    )

    const reuse = expectKind(plan, 'reuse')
    expect(reuse.node).toBe(placeholder)
    expect(reuse.resetNodes).toBeUndefined()
  })

  test('empty branch against teleport anchor creates before it and keeps it structural', () => {
    const host = document.createElement('div')
    const target = document.createComment('teleport anchor')
    host.append(target)

    const plan = resolveWithCursor(target, () =>
      resolveDynamicAnchor(new DynamicFragment('if', false, false), true),
    )

    const create = expectKind(plan, 'create')
    expect(create.parent).toBe(host)
    expect(create.next).toBe(target)
    expect(create.mark).toBe(target)
  })

  test('empty branch against non-empty SSR reuses a labeled sibling anchor', () => {
    const host = document.createElement('div')
    const stale = document.createElement('span')
    const anchor = document.createComment('if')
    host.append(stale, anchor)

    const plan = resolveWithCursor(stale, () =>
      resolveDynamicAnchor(new DynamicFragment('if', false, false), true),
    )

    const reuse = expectKind(plan, 'reuse')
    expect(reuse.node).toBe(anchor)
    expect(reuse.resetNodes).toBe(true)
  })

  test('empty branch against non-empty SSR without reusable anchor trims the range', () => {
    const host = document.createElement('div')
    const stale = document.createElement('span')
    const footer = document.createElement('footer')
    host.append(stale, footer)

    const plan = resolveWithCursor(stale, () =>
      resolveDynamicAnchor(new DynamicFragment('if', false, false), true),
    )

    const cleanup = expectKind(plan, 'create-cleanup')
    expect(cleanup.parent).toBe(host)
    expect(cleanup.next).toBe(footer)
    expect(cleanup.cleanupStart).toBe(stale)
    expect(cleanup.cleanupUntil).toBe(footer)
    // resolution is a pure query: nothing was trimmed or inserted yet
    expect(host.innerHTML).toBe('<span></span><footer></footer>')
  })

  test('empty dynamic-component reuses its attached SSR comment block node', () => {
    const host = document.createElement('div')
    const comment = document.createComment('')
    host.append(comment)

    const plan = resolveWithCursor(comment, () => {
      const frag = new DynamicFragment('dynamic-component', false, false)
      frag.nodes = comment
      return resolveDynamicAnchor(frag, false)
    })

    const reuse = expectKind(plan, 'reuse')
    expect(reuse.node).toBe(comment)
    expect(reuse.resetNodes).toBe(true)
  })

  test('empty fragment with detached comment block node derives range from cursor', () => {
    const host = document.createElement('div')
    const stale = document.createElement('span')
    const footer = document.createElement('footer')
    host.append(stale, footer)

    const plan = resolveWithCursor(stale, () => {
      const frag = new DynamicFragment('if', false, false)
      frag.nodes = document.createComment('')
      return resolveDynamicAnchor(frag, false)
    })

    const cleanup = expectKind(plan, 'create-cleanup')
    expect(cleanup.parent).toBe(host)
    expect(cleanup.next).toBe(footer)
    expect(cleanup.cleanupStart).toBe(stale)
    expect(cleanup.cleanupUntil).toBe(footer)
  })

  test('non-forwarded slot reuses the boundary close anchor', () => {
    const host = document.createElement('div')
    const start = document.createComment('[')
    const end = document.createComment(']')
    host.append(start, end)

    const plan = resolveWithCursor(start, () =>
      withHydratingSlotBoundary(() =>
        resolveDynamicAnchor(new SlotFragment(), true),
      ),
    )

    const reuse = expectKind(plan, 'reuse')
    expect(reuse.node).toBe(end)
    expect(reuse.resetNodes).toBeUndefined()
  })

  test('empty forwarded slot creates after the boundary close anchor', () => {
    const host = document.createElement('div')
    const start = document.createComment('[')
    const end = document.createComment(']')
    const footer = document.createElement('footer')
    host.append(start, end, footer)

    const plan = resolveWithCursor(start, () =>
      withHydratingSlotBoundary(() => {
        const frag = new SlotFragment()
        frag.forwarded = true
        return resolveDynamicAnchor(frag, true)
      }),
    )

    const create = expectKind(plan, 'create')
    expect(create.parent).toBe(host)
    expect(create.next).toBe(footer)
    expect(create.mark).toBe(end)
  })

  test('empty inner v-if under pending slot content creates before fallback', () => {
    const host = document.createElement('div')
    const start = document.createComment('[')
    const end = document.createComment(']')
    host.append(start, end)

    const plan = resolveWithCursor(start, () =>
      withHydratingSlotBoundary(() => {
        const finish = startPendingSlotContent(start)
        try {
          return resolveDynamicAnchor(
            new DynamicFragment('if', false, false),
            true,
          )
        } finally {
          finish(false)
        }
      }),
    )

    const pending = expectKind(plan, 'pending')
    expect(pending.parent).toBe(host)
    expect(pending.slotEnd).toBe(end)
  })

  test('empty inner v-if that consumed the slot range creates before the slot end anchor', () => {
    const host = document.createElement('div')
    const start = document.createComment('[')
    const end = document.createComment(']')
    host.append(start, end)

    const plan = resolveWithCursor(start, () =>
      withHydratingSlotBoundary(() =>
        resolveDynamicAnchor(new DynamicFragment('if', false, false), true),
      ),
    )

    const create = expectKind(plan, 'create')
    expect(create.parent).toBe(host)
    expect(create.next).toBe(end)
    expect(create.mark).toBeUndefined()
  })

  test('keyed fragment creates from its block boundary', () => {
    const host = document.createElement('div')
    const el = document.createElement('span')
    const footer = document.createElement('footer')
    host.append(el, footer)

    const plan = resolveWithCursor(el, () => {
      const frag = new DynamicFragment('keyed', false, false)
      frag.nodes = el
      return resolveDynamicAnchor(frag, false)
    })

    const create = expectKind(plan, 'create')
    expect(create.parent).toBe(host)
    expect(create.next).toBe(footer)
  })
})
