import { generateHydrationScript, renderToString } from 'solid-js/web'
import StaticHeavy from '../solid/Solid'

export function render() {
  return {
    html: renderToString(() => <StaticHeavy />),
    hydrationScript: generateHydrationScript({}),
  }
}
