import { App } from './apiCreateApp'
import { Fragment, Text, Comment, Static } from './vnode'
import { ComponentInternalInstance } from './component'

export interface AppRecord {
  id: number
  app: App
  version: string
  types: { [key: string]: string | Symbol }
}

enum DevtoolsHooks {
  APP_INIT = 'app:init',
  APP_UNMOUNT = 'app:unmount',
  COMPONENT_UPDATED = 'component:updated',
  COMPONENT_ADDED = 'component:added',
  COMPONENT_REMOVED = 'component:removed'
}

export interface DevtoolsHook {
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

export function initApp(app: App, version: string) {
  // TODO queue if devtools is undefined
  if (!devtools) return
  devtools.emit(DevtoolsHooks.APP_INIT, app, version, {
    Fragment: Fragment,
    Text: Text,
    Comment: Comment,
    Static: Static
  })
}

export function appUnmounted(app: App) {
  if (!devtools) return
  devtools.emit(DevtoolsHooks.APP_UNMOUNT, app)
}

export function componentAdded(component: ComponentInternalInstance) {
  if (!devtools || !component.appContext.__app) return
  devtools.emit(
    DevtoolsHooks.COMPONENT_ADDED,
    component.appContext.__app,
    component.uid,
    component.parent ? component.parent.uid : undefined
  )
}

export function componentUpdated(component: ComponentInternalInstance) {
  if (!devtools || !component.appContext.__app) return
  devtools.emit(
    DevtoolsHooks.COMPONENT_UPDATED,
    component.appContext.__app,
    component.uid,
    component.parent ? component.parent.uid : undefined
  )
}

export function componentRemoved(component: ComponentInternalInstance) {
  if (!devtools || !component.appContext.__app) return
  devtools.emit(
    DevtoolsHooks.COMPONENT_REMOVED,
    component.appContext.__app,
    component.uid,
    component.parent ? component.parent.uid : undefined
  )
}
