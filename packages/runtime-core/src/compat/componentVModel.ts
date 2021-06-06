import { ShapeFlags } from '@vue/shared'
import { ComponentInternalInstance, ComponentOptions } from '../component'
import { callWithErrorHandling, ErrorCodes } from '../errorHandling'
import { VNode } from '../vnode'
import { popWarningContext, pushWarningContext } from '../warning'
import {
  DeprecationTypes,
  warnDeprecation,
  isCompatEnabled
} from './compatConfig'

export const compatModelEventPrefix = `onModelCompat:`

const warnedTypes = new WeakSet()

export function convertLegacyVModelProps(vnode: VNode) {
  const { type, shapeFlag, props, dynamicProps } = vnode
  if (shapeFlag & ShapeFlags.COMPONENT && props && 'modelValue' in props) {
    if (
      !isCompatEnabled(
        DeprecationTypes.COMPONENT_V_MODEL,
        // this is a special case where we want to use the vnode component's
        // compat config instead of the current rendering instance (which is the
        // parent of the component that exposes v-model)
        { type } as any
      )
    ) {
      return
    }

    if (__DEV__ && !warnedTypes.has(type as ComponentOptions)) {
      pushWarningContext(vnode)
      warnDeprecation(DeprecationTypes.COMPONENT_V_MODEL, { type } as any, type)
      popWarningContext()
      warnedTypes.add(type as ComponentOptions)
    }

    // v3 compiled model code -> v2 compat props
    // modelValue -> value
    // onUpdate:modelValue -> onModelCompat:input
    const { prop = 'value', event = 'input' } = (type as any).model || {}
    if (prop !== 'modelValue') {
      props[prop] = props.modelValue
      delete props.modelValue
    }
    // important: update dynamic props
    if (dynamicProps) {
      dynamicProps[dynamicProps.indexOf('modelValue')] = prop
    }
    props[compatModelEventPrefix + event] = props['onUpdate:modelValue']
    delete props['onUpdate:modelValue']
  }
}

export function compatModelEmit(
  instance: ComponentInternalInstance,
  event: string,
  args: any[]
) {
  if (!isCompatEnabled(DeprecationTypes.COMPONENT_V_MODEL, instance)) {
    return
  }
  const props = instance.vnode.props
  const modelHandler = props && props[compatModelEventPrefix + event]
  if (modelHandler) {
    callWithErrorHandling(
      modelHandler,
      instance,
      ErrorCodes.COMPONENT_EVENT_HANDLER,
      args
    )
  }
}
