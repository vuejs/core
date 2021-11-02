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
  COMPONENT_EMIT = 'component:emit',
  PERFORMANCE_START = 'perf:start',
  PERFORMANCE_END = 'perf:end'
}

interface DevtoolsHook {
  enabled?: boolean
  emit: (event: string, ...payload: any[]) => void
  on: (event: string, handler: Function) => void
  once: (event: string, handler: Function) => void
  off: (event: string, handler: Function) => void
  appRecords: AppRecord[]
}

export let devtools: DevtoolsHook

let buffer: { event: string; args: any[] }[] = []

let devtoolsNotInstalled = false

function emit(event: string, ...args: any[]) {
  if (devtools) {
    devtools.emit(event, ...args)
  } else if (!devtoolsNotInstalled) {
    buffer.push({ event, args })
  }
}

export function setDevtoolsHook(hook: DevtoolsHook, target: any) {
  devtools = hook
  if (devtools) {
    devtools.enabled = true
    buffer.forEach(({ event, args }) => devtools.emit(event, ...args))
    buffer = []
  } else {
    const replay = (target.__VUE_DEVTOOLS_HOOK_REPLAY__ =
      target.__VUE_DEVTOOLS_HOOK_REPLAY__ || [])
    replay.push((newHook: DevtoolsHook) => {
      setDevtoolsHook(newHook, target)
    })
    // clear buffer after 3s - the user probably doesn't have devtools installed
    // at all, and keeping the buffer will cause memory leaks (#4738)
    setTimeout(() => {
      if (!devtools) {
        devtoolsNotInstalled = true
        buffer = []
      }
    }, 3000)
  }
}

export function devtoolsInitApp(app: App, version: string) {
  emit(DevtoolsHooks.APP_INIT, app, version, {
    Fragment,
    Text,
    Comment,
    Static
  })
}

export function devtoolsUnmountApp(app: App) {
  emit(DevtoolsHooks.APP_UNMOUNT, app)
}

export const devtoolsComponentAdded = /*#__PURE__*/ createDevtoolsComponentHook(
  DevtoolsHooks.COMPONENT_ADDED
)

export const devtoolsComponentUpdated =
  /*#__PURE__*/ createDevtoolsComponentHook(DevtoolsHooks.COMPONENT_UPDATED)

export const devtoolsComponentRemoved =
  /*#__PURE__*/ createDevtoolsComponentHook(DevtoolsHooks.COMPONENT_REMOVED)

function createDevtoolsComponentHook(hook: DevtoolsHooks) {
  return (component: ComponentInternalInstance) => {
    emit(
      hook,
      component.appContext.app,
      component.uid,
      component.parent ? component.parent.uid : undefined,
      component
    )
  }
}

export const devtoolsPerfStart = /*#__PURE__*/ createDevtoolsPerformanceHook(
  DevtoolsHooks.PERFORMANCE_START
)

export const devtoolsPerfEnd = /*#__PURE__*/ createDevtoolsPerformanceHook(
  DevtoolsHooks.PERFORMANCE_END
)

function createDevtoolsPerformanceHook(hook: DevtoolsHooks) {
  return (component: ComponentInternalInstance, type: string, time: number) => {
    emit(hook, component.appContext.app, component.uid, component, type, time)
  }
}

export function devtoolsComponentEmit(
  component: ComponentInternalInstance,
  event: string,
  params: any[]
) {
  emit(
    DevtoolsHooks.COMPONENT_EMIT,
    component.appContext.app,
    component,
    event,
    params
  )
}
