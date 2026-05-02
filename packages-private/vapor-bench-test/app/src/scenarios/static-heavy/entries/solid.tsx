import '../style.css'
import { render } from 'solid-js/web'
import StaticHeavy from '../solid/Solid'

performance.mark('bench:entry-start')

render(() => <StaticHeavy />, document.getElementById('app')!)
