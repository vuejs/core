import '../style.css'
import { render } from 'solid-js/web'
import DynamicPropsAttrs from '../solid/Solid'

performance.mark('bench:entry-start')

render(() => <DynamicPropsAttrs />, document.getElementById('app')!)
