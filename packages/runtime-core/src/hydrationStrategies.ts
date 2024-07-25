export type HydrationStrategy = (el: Element, hydrate: () => void) => () => void

export type HydrationStrategyFactory<Options = any> = (
  options?: Options,
) => HydrationStrategy

export const hydrateOnTimeout: HydrationStrategyFactory<number> =
  (delay = 100) =>
  (el, hydrate) =>
  () =>
    setTimeout(hydrate, delay)

export const hydrateOnVisible: HydrationStrategyFactory<number> = margin => {
  return hydrate => () => hydrate
}

export const hydrateOnMediaQuery: HydrationStrategyFactory<string> = query => {
  return hydrate => () => hydrate
}
