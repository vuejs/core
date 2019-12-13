import { render, createVNode } from '@vue/runtime-dom'

// The bare minimum code required for rendering something to the screen
render(createVNode('div'), document.getElementById('app')!)
