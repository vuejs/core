import { camelize, isArray, normalizeClass, normalizeStyle } from '@vue/shared'
import {
  type ComponentInternalInstance,
  componentKey,
  currentInstance,
} from './component'
import { isEmitListener } from './componentEmits'
import { type RawProps, walkRawProps } from './componentProps'
import { renderEffect } from './renderEffect'
import { mergeProp, setDynamicProp } from './dom/prop'
import type { Block } from './apiRender'

export function patchAttrs(
  instance: ComponentInternalInstance,
  hasDynamicProps?: boolean,
): void {
  const {
    attrs,
    rawProps,
    propsOptions: [options],
  } = instance

  if (!rawProps.length) return
  const keys = new Set<string>()
  const classes: any[] = []
  const styles: any[] = []

  walkRawProps(rawProps, registerAttr)
  for (const key in attrs) {
    if (!keys.has(key)) {
      delete attrs[key]
    }
  }

  setClassOrStyle(classes, 'class', normalizeClass)
  setClassOrStyle(styles, 'style', normalizeStyle)

  function setClassOrStyle(
    values: any[],
    field: 'class' | 'style',
    normalize: (value: any) => any,
  ) {
    if (values.length) {
      if (hasDynamicProps) {
        Object.defineProperty(attrs, field, {
          get() {
            return normalize(values.map(value => value()))
          },
          enumerable: true,
          configurable: true,
        })
      } else {
        attrs[field] = normalizeClass(values)
      }
    }
  }

  function registerAttr(key: string, value: any, getter?: boolean) {
    if (
      (!options || !(camelize(key) in options)) &&
      !isEmitListener(instance.emitsOptions, key) &&
      (key === 'class' || key === 'style' || !keys.has(key))
    ) {
      keys.add(key)

      if (key === 'class' || key === 'style') {
        ;(key === 'class' ? classes : styles).push(
          hasDynamicProps
            ? getter
              ? value
              : () => value
            : getter
              ? value()
              : value,
        )
      } else if (getter) {
        Object.defineProperty(attrs, key, {
          get: value,
          enumerable: true,
          configurable: true,
        })
      } else {
        attrs[key] = value
      }
    }
  }
}

export function withAttrs(props: RawProps): RawProps {
  const instance = currentInstance!
  if (instance.type.inheritAttrs === false) return props
  const attrsGetter = () => instance.attrs
  if (!props) return [attrsGetter]
  if (isArray(props)) {
    return [attrsGetter, ...props]
  }
  return [attrsGetter, props]
}

function getFirstNode(block: Block | undefined): Node | undefined {
  if (!block || componentKey in block) return
  if (block instanceof Node) return block
  if (isArray(block)) {
    if (block.length === 1) {
      return getFirstNode(block[0])
    }
  } else {
    return getFirstNode(block.nodes)
  }
}

export function fallThroughAttrs(instance: ComponentInternalInstance): void {
  const {
    block,
    type: { inheritAttrs },
    dynamicAttrs,
  } = instance
  if (
    inheritAttrs === false ||
    dynamicAttrs === true || // all props as dynamic
    !block ||
    componentKey in block
  )
    return

  const element = getFirstNode(block)
  if (!element || !(element instanceof Element)) return

  const hasStaticAttrs = dynamicAttrs || dynamicAttrs === false

  let initial: Record<string, string> | undefined
  if (hasStaticAttrs) {
    // attrs in static template
    initial = {}
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i]
      if (dynamicAttrs && dynamicAttrs.includes(attr.name)) continue
      initial[attr.name] = attr.value
    }
  }

  renderEffect(() => {
    for (const key in instance.attrs) {
      if (dynamicAttrs && dynamicAttrs.includes(key)) continue

      let value: unknown
      if (hasStaticAttrs && key in initial!) {
        value = mergeProp(key, instance.attrs[key], initial![key])
      } else {
        value = instance.attrs[key]
      }

      setDynamicProp(element, key, value)
    }
  })
}

export function setInheritAttrs(dynamicAttrs?: string[] | boolean): void {
  const instance = currentInstance!
  if (instance.type.inheritAttrs === false) return
  instance.dynamicAttrs = dynamicAttrs
}
