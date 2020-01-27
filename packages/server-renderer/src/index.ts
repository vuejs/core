import { toDisplayString } from 'vue'

export { renderToString, renderComponent } from './renderToString'

export {
  renderVNode,
  renderClass,
  renderStyle,
  renderProps
} from './renderVnode'

export { escape } from './escape'

export function interpolate(value: unknown) {
  return escape(toDisplayString(value))
}
