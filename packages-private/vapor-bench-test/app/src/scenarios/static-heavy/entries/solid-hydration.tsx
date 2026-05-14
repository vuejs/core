import '../style.css'
import { hydrate } from 'solid-js/web'
import StaticHeavy from '../solid/Solid'

performance.mark('bench:entry-start')

hydrate(() => <StaticHeavy />, globalThis.document.getElementById('app')!)
