import '../style.css'
import { render } from 'solid-js/web'
import ComponentFanout from '../solid/Solid'

performance.mark('bench:entry-start')

render(() => <ComponentFanout />, document.getElementById('app')!)
