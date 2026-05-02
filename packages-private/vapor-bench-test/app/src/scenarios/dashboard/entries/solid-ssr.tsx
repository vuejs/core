import { generateHydrationScript, renderToString } from 'solid-js/web'
import Dashboard from '../solid/Solid'

export function render() {
  return {
    html: renderToString(() => <Dashboard />),
    hydrationScript: generateHydrationScript({}),
  }
}
