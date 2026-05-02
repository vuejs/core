import '../style.css'
import { hydrate } from 'solid-js/web'
import Dashboard from '../solid/Solid'

performance.mark('bench:entry-start')

hydrate(() => <Dashboard />, document.getElementById('app')!)
