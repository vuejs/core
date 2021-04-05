import { isFunction } from '@vue/shared'
import { App, AppContext } from '../apiCreateApp'
import {
  ComponentOptions,
  createComponentInstance,
  finishComponentSetup,
  setupComponent
} from '../component'
import { devtoolsInitApp } from '../devtools'
import { RootHydrateFunction } from '../hydration'
import { RootRenderFunction } from '../renderer'
import { cloneVNode, createVNode } from '../vnode'
import { warn } from '../warning'
import { version } from '..'
import { DeprecationTypes, warnDeprecation } from './deprecations'

export function installCompatMount(
  app: App,
  context: AppContext,
  render: RootRenderFunction,
  hydrate?: RootHydrateFunction
) {
  let isMounted = false

  /**
   * Vue 2 supports the behavior of creating a component instance but not
   * mounting it, which is no longer possible in Vue 3 - this internal
   * function simulates that behavior.
   */
  app._createRoot = options => {
    const component = app._component
    const vnode = createVNode(component, options.propsData || null)
    vnode.appContext = context

    const hasNoRender =
      !isFunction(component) && !component.render && !component.template
    const emptyRender = () => {}

    // create root instance
    const instance = createComponentInstance(vnode, null, null)
    // suppress "missing render fn" warning since it can't be determined
    // until $mount is called
    if (hasNoRender) {
      instance.render = emptyRender
    }
    setupComponent(instance, __NODE_JS__)
    vnode.component = instance

    // $mount & $destroy
    // these are defined on ctx and picked up by the $mount/$destroy
    // public property getters on the instance proxy.
    // Note: the following assumes DOM environment since the compat build
    // only targets web. It essentially includes logic for app.mount from
    // both runtime-core AND runtime-dom.
    instance.ctx._compat_mount = (selectorOrEl: string | Element) => {
      if (isMounted) {
        __DEV__ && warn(`Root instance is already mounted.`)
        return
      }

      let container: Element
      if (typeof selectorOrEl === 'string') {
        // eslint-disable-next-line
        const result = document.querySelector(selectorOrEl)
        if (!result) {
          __DEV__ &&
            warn(
              `Failed to mount root instance: selector "${selectorOrEl}" returned null.`
            )
          return
        }
        container = result
      } else {
        if (!selectorOrEl) {
          __DEV__ &&
            warn(
              `Failed to mount root instance: invalid mount target ${selectorOrEl}.`
            )
          return
        }
        container = selectorOrEl
      }

      const isSVG = container instanceof SVGElement

      // HMR root reload
      if (__DEV__) {
        context.reload = () => {
          const cloned = cloneVNode(vnode)
          // compat mode will use instance if not reset to null
          cloned.component = null
          render(cloned, container, isSVG)
        }
      }

      // resolve in-DOM template if component did not provide render
      // and no setup/mixin render functions are provided (by checking
      // that the instance is still using the placeholder render fn)
      if (hasNoRender && instance.render === emptyRender) {
        // root directives check
        if (__DEV__) {
          for (let i = 0; i < container.attributes.length; i++) {
            const attr = container.attributes[i]
            if (attr.name !== 'v-cloak' && /^(v-|:|@)/.test(attr.name)) {
              warnDeprecation(DeprecationTypes.DOM_TEMPLATE_MOUNT)
              break
            }
          }
        }
        instance.render = null
        ;(component as ComponentOptions).template = container.innerHTML
        finishComponentSetup(instance, __NODE_JS__, true /* skip options */)
      }

      // clear content before mounting
      container.innerHTML = ''

      // TODO hydration
      render(vnode, container, isSVG)

      if (container instanceof Element) {
        container.removeAttribute('v-cloak')
        container.setAttribute('data-v-app', '')
      }

      isMounted = true
      app._container = container
      // for devtools and telemetry
      ;(container as any).__vue_app__ = app
      if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        devtoolsInitApp(app, version)
      }

      return instance.proxy!
    }

    instance.ctx._compat_destroy = app.unmount

    return instance.proxy!
  }
}
