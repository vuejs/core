import { isFunction, isObject } from '@vue/shared'
import { Component, ComponentInternalInstance } from '../component'
import {
  checkCompatEnabled,
  DeprecationTypes,
  softAssertCompatEnabled
} from './compatConfig'
import { convertLegacyAsyncComponent } from './componentAsync'
import { convertLegacyFunctionalComponent } from './componentFunctional'

export function convertLegacyComponent(
  comp: any,
  instance: ComponentInternalInstance | null
): Component {
  if (comp.__isBuiltIn) {
    return comp
  }

  // 2.x constructor
  if (isFunction(comp) && comp.cid) {
    comp = comp.options
  }

  // 2.x async component
  if (
    isFunction(comp) &&
    checkCompatEnabled(DeprecationTypes.COMPONENT_ASYNC, instance, comp)
  ) {
    // since after disabling this, plain functions are still valid usage, do not
    // use softAssert here.
    return convertLegacyAsyncComponent(comp)
  }

  // 2.x functional component
  if (
    isObject(comp) &&
    comp.functional &&
    softAssertCompatEnabled(
      DeprecationTypes.COMPONENT_FUNCTIONAL,
      instance,
      comp
    )
  ) {
    return convertLegacyFunctionalComponent(comp)
  }

  return comp
}
