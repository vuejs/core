import '../style.css'
import { render } from 'solid-js/web'
import ConditionalBranch from '../solid/Solid'

performance.mark('bench:entry-start')

render(() => <ConditionalBranch />, document.getElementById('app')!)
