import { toDisplayString } from 'vue'
import { escape } from './escape'

export { escape }

export function interpolate(value: unknown) {
  return escape(toDisplayString(value))
}

export { renderToString, renderComponent, renderSlot } from './renderToString'
export { renderClass, renderStyle, renderProps } from './renderProps'
