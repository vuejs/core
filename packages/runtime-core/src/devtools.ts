import { App } from './apiCreateApp'
import { Fragment, Text, Comment, Static } from './vnode'
import { ComponentInternalInstance } from './component'

interface AppRecord {
  id: number
  app: App
  version: string
  types: Record<string, string | Symbol>
}

const enum DevtoolsHooks {
  APP_INIT = 'app:init',
  APP_UNMOUNT = 'app:unmount',
  COMPONENT_UPDATED = 'component:updated',
  COMPONENT_ADDED = 'component:added',
  COMPONENT_REMOVED = 'component:removed',
  COMPONENT_EMIT = 'component:emit'
}

interface DevtoolsHook {
  emit: (event: string, ...payload: any[]) => void
  on: (event: string, handler: Function) => void
  once: (event: string, handler: Function) => void
  off: (event: string, handler: Function) => void
  appRecords: AppRecord[]
}

export let devtools: DevtoolsHook

export function setDevtoolsHook(hook: DevtoolsHook) {
  devtools = hook
}

export function devtoolsInitApp(app: App, version: string) {
  // TODO queue if devtools is undefined
  if (!devtools) return
  devtools.emit(DevtoolsHooks.APP_INIT, app, version, {
    Fragment,
    Text,
    Comment,
    Static
  })
}

export function devtoolsUnmountApp(app: App) {
  if (!devtools) return
  devtools.emit(DevtoolsHooks.APP_UNMOUNT, app)
}

export const devtoolsComponentAdded = /*#__PURE__*/ createDevtoolsComponentHook(
  DevtoolsHooks.COMPONENT_ADDED
)

export const devtoolsComponentUpdated = /*#__PURE__*/ createDevtoolsComponentHook(
  DevtoolsHooks.COMPONENT_UPDATED
)

export const devtoolsComponentRemoved = /*#__PURE__*/ createDevtoolsComponentHook(
  DevtoolsHooks.COMPONENT_REMOVED
)

function createDevtoolsComponentHook(hook: DevtoolsHooks) {
  return (component: ComponentInternalInstance) => {
    if (!devtools) return
    devtools.emit(
      hook,
      component.appContext.app,
      component.uid,
      component.parent ? component.parent.uid : undefined,
      component
    )
  }
}

export function devtoolsComponentEmit(
  component: ComponentInternalInstance,
  event: string,
  params: any[]
) {
  if (!devtools) return
  devtools.emit(
    DevtoolsHooks.COMPONENT_EMIT,
    component.appContext.app,
    component,
    event,
    params
  )
}
