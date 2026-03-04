import { isFunction, isObject } from '@vue/shared'
import type { Component, ComponentInternalInstance } from '../component'
import {
  DeprecationTypes,
  checkCompatEnabled,
  softAssertCompatEnabled,
} from './compatConfig'
import { convertLegacyAsyncComponent } from './componentAsync'
import { convertLegacyFunctionalComponent } from './componentFunctional'

export function convertLegacyComponent(
  comp: any,
  instance: ComponentInternalInstance | null,
): Component {
  if (comp.__isBuiltIn) {
    return comp
  }

  // 2.x constructor
  if (isFunction(comp) && comp.cid) {
    // #7766
    if (comp.render) {
      // only necessary when compiled from SFC
      comp.options.render = comp.render
    }
    // copy over internal properties set by the SFC compiler
    comp.options.__file = comp.__file
    comp.options.__hmrId = comp.__hmrId
    comp.options.__scopeId = comp.__scopeId
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
      comp,
    )
  ) {
    return convertLegacyFunctionalComponent(comp)
  }

  return comp
}
