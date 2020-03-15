import { App } from './apiCreateApp'
import { Fragment, Text, Comment, Static } from './vnode'

export interface AppRecord {
  id: number
  app: App
  version: string
  types: { [key: string]: string | Symbol }
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

export function initDevtools<HostElement = any>(
  app: App<HostElement>,
  version: string
) {
  // TODO queue if devtools is undefined
  if (!devtools) return
  devtools.emit('app:init', app, version, {
    Fragment: Fragment,
    Text: Text,
    Comment: Comment,
    Static: Static
  })
}
