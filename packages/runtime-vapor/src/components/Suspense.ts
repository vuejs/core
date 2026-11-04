import { withSuspenseEnabled } from '../suspense'

// TODO: implement this
export const VaporSuspenseImpl: {
  name: string
  __isSuspense: true
  process(): void
} = /*@__PURE__*/ withSuspenseEnabled({
  name: 'VaporSuspense',
  __isSuspense: true,
  process(): void {},
})
