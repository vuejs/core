import '../style.css'
import { render } from 'solid-js/web'
import LocalizedLeaf from '../solid/Solid'

performance.mark('bench:entry-start')

render(() => <LocalizedLeaf />, globalThis.document.getElementById('app')!)
