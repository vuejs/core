import { extend, isPlainObject } from '@vue/shared'
import {
  createComponent,
  createVaporApp,
  createVaporSSRApp,
  defineVaporComponent,
  isFragment,
} from '.'
import {
  type CreateAppFunction,
  type CustomElementOptions,
  VueElementBase,
  warn,
} from '@vue/runtime-dom'
import type {
  ObjectVaporComponent,
  VaporComponent,
  VaporComponentInstance,
} from './component'
import type { Block } from './block'
import { withHydration } from './dom/hydration'

export type VaporElementConstructor<P = {}> = {
  new (initialProps?: Record<string, any>): VaporElement & P
}

// TODO type inference

/*@__NO_SIDE_EFFECTS__*/
export function defineVaporCustomElement(
  options: any,
  extraOptions?: Omit<ObjectVaporComponent, 'setup'>,
  /**
   * @internal
   */
  _createApp?: CreateAppFunction<ParentNode, VaporComponent>,
): VaporElementConstructor {
  let Comp = defineVaporComponent(options, extraOptions as any)
  if (isPlainObject(Comp)) Comp = extend({}, Comp, extraOptions)
  class VaporCustomElement extends VaporElement {
    static def = Comp
    constructor(initialProps?: Record<string, any>) {
      super(Comp, initialProps, _createApp)
    }
  }

  return VaporCustomElement
}

/*@__NO_SIDE_EFFECTS__*/
export const defineVaporSSRCustomElement = ((
  options: any,
  extraOptions?: Omit<ObjectVaporComponent, 'setup'>,
) => {
  return defineVaporCustomElement(options, extraOptions, createVaporSSRApp)
}) as typeof defineVaporCustomElement

type VaporInnerComponentDef = VaporComponent & CustomElementOptions

export class VaporElement extends VueElementBase<
  ParentNode,
  VaporComponent,
  VaporInnerComponentDef
> {
  constructor(
    def: VaporInnerComponentDef,
    props: Record<string, any> | undefined = {},
    createAppFn: CreateAppFunction<ParentNode, VaporComponent> = createVaporApp,
  ) {
    super(def, props, createAppFn)
  }

  protected _needsHydration(): boolean {
    if (this.shadowRoot && this._createApp !== createVaporApp) {
      return true
    } else {
      if (__DEV__ && this.shadowRoot) {
        warn(
          `Custom element has pre-rendered declarative shadow root but is not ` +
            `defined as hydratable. Use \`defineVaporSSRCustomElement\`.`,
        )
      }
    }
    return false
  }
  protected _mount(def: VaporInnerComponentDef): void {
    if ((__DEV__ || __FEATURE_PROD_DEVTOOLS__) && !def.name) {
      def.name = 'VaporElement'
    }

    this._app = this._createApp(this._def)
    this._inheritParentContext()
    if (this._def.configureApp) {
      this._def.configureApp(this._app)
    }

    // create component in hydration context
    if (this.shadowRoot && this._createApp === createVaporSSRApp) {
      withHydration(this._root, this._createComponent.bind(this))
    } else {
      this._createComponent()
    }

    this._app!.mount(this._root)

    // Render slots immediately after mount for shadowRoot: false
    // This ensures correct lifecycle order for nested custom elements
    if (!this.shadowRoot) {
      this._renderSlots()
    }
  }

  protected _update(): void {
    if (!this._app) return
    // update component by re-running all its render effects
    const renderEffects = (this._instance! as VaporComponentInstance)
      .renderEffects
    if (renderEffects) renderEffects.forEach(e => e.run())
  }

  protected _unmount(): void {
    if (__TEST__) {
      try {
        this._app!.unmount()
      } catch (error) {
        // In test environment, ignore errors caused by accessing Node
        // after the test environment has been torn down
        if (
          error instanceof ReferenceError &&
          error.message.includes('Node is not defined')
        ) {
          // Ignore this error in tests
        } else {
          throw error
        }
      }
    } else {
      this._app!.unmount()
    }
    if (this._instance && this._instance.ce) {
      this._instance.ce = undefined
    }
    this._app = this._instance = null
  }

  /**
   * Only called when shadowRoot is false
   */
  protected _updateSlotNodes(replacements: Map<Node, Node[]>): void {
    this._updateFragmentNodes(
      (this._instance! as VaporComponentInstance).block,
      replacements,
    )
  }

  /**
   * Replace slot nodes with their replace content
   * @internal
   */
  private _updateFragmentNodes(
    block: Block,
    replacements: Map<Node, Node[]>,
  ): void {
    if (Array.isArray(block)) {
      block.forEach(item => this._updateFragmentNodes(item, replacements))
      return
    }

    if (!isFragment(block)) return
    const { nodes } = block
    if (Array.isArray(nodes)) {
      const newNodes: Block[] = []
      for (const node of nodes) {
        if (node instanceof HTMLSlotElement) {
          newNodes.push(...replacements.get(node)!)
        } else {
          this._updateFragmentNodes(node, replacements)
          newNodes.push(node)
        }
      }
      block.nodes = newNodes
    } else if (nodes instanceof HTMLSlotElement) {
      block.nodes = replacements.get(nodes)!
    } else {
      this._updateFragmentNodes(nodes, replacements)
    }
  }

  private _createComponent() {
    this._def.ce = instance => {
      this._app!._ceComponent = this._instance = instance
      // For shadowRoot: false, _renderSlots is called synchronously after mount
      // in _mount() to ensure correct lifecycle order
      if (!this.shadowRoot) {
        // Still set updated hooks for subsequent updates
        this._instance!.u = [this._renderSlots.bind(this)]
      }
      this._processInstance()
    }

    createComponent(
      this._def,
      this._props,
      undefined,
      undefined,
      undefined,
      this._app!._context,
    )
  }
}
