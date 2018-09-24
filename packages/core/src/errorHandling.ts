import { MountedComponent } from './component'

export const enum ErrorTypes {
  LIFECYCLE = 1,
  RENDER,
  RENDER_ERROR,
  NATIVE_EVENT_HANDLER,
  COMPONENT_EVENT_HANDLER
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
  type: ErrorTypes
) {
  // TODO
}
