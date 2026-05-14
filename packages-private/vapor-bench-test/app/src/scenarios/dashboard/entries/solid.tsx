import '../style.css'
import { render } from 'solid-js/web'
import Dashboard from '../solid/Solid'

performance.mark('bench:entry-start')

render(() => <Dashboard />, globalThis.document.getElementById('app')!)
