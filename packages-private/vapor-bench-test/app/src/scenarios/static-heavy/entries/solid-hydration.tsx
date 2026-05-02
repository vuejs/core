import '../style.css'
import { hydrate } from 'solid-js/web'
import StaticHeavy from '../solid/Solid'

performance.mark('bench:entry-start')

hydrate(() => <StaticHeavy />, document.getElementById('app')!)
