import { normalizeContainer } from '../apiRender'
import { insert } from '../dom/element'
import { type VaporComponent, createComponent } from './component'

export function createVaporApp(comp: VaporComponent): any {
  return {
    mount(container: string | ParentNode) {
      container = normalizeContainer(container)
      // clear content before mounting
      if (container.nodeType === 1 /* Node.ELEMENT_NODE */) {
        container.textContent = ''
      }
      const instance = createComponent(comp)
      insert(instance.block, container)
      return instance
    },
  }
}
