import { MountedComponent } from './component'

export const enum ErrorTypes {
  LIFECYCLE = 1,
  RENDER = 2,
  NATIVE_EVENT_HANDLER = 3,
  COMPONENT_EVENT_HANDLER = 4
}

const globalHandlers: Function[] = []

export function globalHandleError(handler: () => void) {
  globalHandlers.push(handler)
  return () => {
    globalHandlers.splice(globalHandlers.indexOf(handler), 1)
  }
}

export function handleError(
  err: Error,
  instance: MountedComponent,
  type: ErrorTypes,
  code: number
) {
  // TODO
}
