import { EMPTY_OBJ, nativeOnRE, vnodeHookRE } from './utils'
import {
  ComponentClass,
  MountedComponent,
  FunctionalComponent
} from './component'
import { immutable, unwrap, lock, unlock } from '@vue/observer'
import {
  Data,
  ComponentPropsOptions,
  PropValidator,
  PropOptions
} from './componentOptions'

export function initializeProps(instance: MountedComponent, data: Data | null) {
  const { props, attrs } = resolveProps(
    data,
    instance.$options.props,
    instance.constructor as ComponentClass
  )
  instance.$props = immutable(props || {})
  instance.$attrs = immutable(attrs || {})
}

export function updateProps(instance: MountedComponent, nextData: Data) {
  // instance.$props and instance.$attrs are observables that should not be
  // replaced. Instead, we mutate them to match latest props, which will trigger
  // updates if any value that's been used in child component has changed.
  if (nextData != null) {
    const { props: nextProps, attrs: nextAttrs } = resolveProps(
      nextData,
      instance.$options.props,
      instance.constructor as ComponentClass
    )
    // unlock to temporarily allow mutatiing props
    unlock()
    const props = instance.$props
    const rawProps = unwrap(props)
    for (const key in rawProps) {
      if (!nextProps.hasOwnProperty(key)) {
        delete props[key]
      }
    }
    for (const key in nextProps) {
      props[key] = nextProps[key]
    }
    if (nextAttrs) {
      const attrs = instance.$attrs
      const rawAttrs = unwrap(attrs)
      for (const key in rawAttrs) {
        if (!nextAttrs.hasOwnProperty(key)) {
          delete attrs[key]
        }
      }
      for (const key in nextAttrs) {
        attrs[key] = nextAttrs[key]
      }
    }
    lock()
  }
}

const EMPTY_PROPS = { props: EMPTY_OBJ }

// resolve raw VNode data.
// - filter out reserved keys (key, ref, slots)
// - extract class, style and nativeOn* into $attrs (to be merged onto child
//   component root)
// - for the rest:
//   - if has declared props: put declared ones in `props`, the rest in `attrs`
//   - else: everything goes in `props`.
export function resolveProps(
  rawData: any,
  rawOptions: ComponentPropsOptions | void,
  Component: ComponentClass | FunctionalComponent
): { props: Data; attrs?: Data } {
  const hasDeclaredProps = rawOptions !== void 0
  const options = rawOptions as ComponentPropsOptions
  if (!rawData && !hasDeclaredProps) {
    return EMPTY_PROPS
  }
  const props: any = {}
  let attrs: any = void 0
  if (rawData != null) {
    for (const key in rawData) {
      // key, ref, slots are reserved
      if (key === 'key' || key === 'ref' || key === 'slots') {
        continue
      }
      // class, style, nativeOn & directive hooks are always extracted into a
      // separate `attrs` object, which can then be merged onto child component
      // root. in addition, if the component has explicitly declared props, then
      // any non-matching props are extracted into `attrs` as well.
      let isNativeOn
      if (
        key === 'class' ||
        key === 'style' ||
        vnodeHookRE.test(key) ||
        (isNativeOn = nativeOnRE.test(key)) ||
        (hasDeclaredProps && !options.hasOwnProperty(key))
      ) {
        const newKey = isNativeOn ? 'on' + key.slice(8) : key
        ;(attrs || (attrs = {}))[newKey] = rawData[key]
      } else {
        if (__DEV__ && hasDeclaredProps && options.hasOwnProperty(key)) {
          validateProp(key, rawData[key], options[key], Component)
        }
        props[key] = rawData[key]
      }
    }
  }
  // set default values
  if (hasDeclaredProps) {
    for (const key in options) {
      if (props[key] === void 0) {
        const opt = options[key]
        if (opt != null && opt.hasOwnProperty('default')) {
          const defaultValue = (opt as PropOptions).default
          props[key] =
            typeof defaultValue === 'function' ? defaultValue() : defaultValue
        }
      }
    }
  }
  return { props, attrs }
}

function validateProp(
  key: string,
  value: any,
  validator: PropValidator<any>,
  Component: ComponentClass | FunctionalComponent
) {
  // TODO
}
