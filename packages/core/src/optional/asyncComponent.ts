import { ChildrenFlags } from '../flags'
import { createComponentVNode, Slots } from '../vdom'
import { Component, ComponentType, ComponentClass } from '../component'
import { unwrap } from '@vue/observer'

export interface AsyncComponentFactory {
  (): Promise<ComponentType>
  resolved?: ComponentType
}

export interface AsyncComponentFullOptions {
  factory: AsyncComponentFactory
  loading?: ComponentType
  error?: ComponentType
  delay?: number
  timeout?: number
}

export type AsyncComponentOptions =
  | AsyncComponentFactory
  | AsyncComponentFullOptions

interface AsyncContainerData {
  comp: ComponentType | null
  err: Error | null
  delayed: boolean
  timedOut: boolean
}

export function createAsyncComponent(
  options: AsyncComponentOptions
): ComponentClass {
  if (typeof options === 'function') {
    options = { factory: options }
  }

  const {
    factory,
    timeout,
    delay = 200,
    loading: loadingComp,
    error: errorComp
  } = options

  return class AsyncContainer extends Component<AsyncContainerData> {
    data() {
      return {
        comp: null,
        err: null,
        delayed: false,
        timedOut: false
      }
    }

    // doing this in beforeMount so this is non-SSR only
    beforeMount() {
      if (factory.resolved) {
        this.comp = factory.resolved
      } else {
        factory()
          .then(resolved => {
            this.comp = factory.resolved = resolved
          })
          .catch(err => {
            this.err = err
          })
      }
      if (timeout != null) {
        setTimeout(() => {
          this.timedOut = true
        }, timeout)
      }
      if (delay != null) {
        this.delayed = true
        setTimeout(() => {
          this.delayed = false
        }, delay)
      }
    }

    render(props: any, slots: Slots) {
      if (this.err || (this.timedOut && !this.comp)) {
        const error =
          this.err || new Error(`Async component timed out after ${timeout}ms.`)
        return errorComp
          ? createComponentVNode(
              errorComp,
              { error },
              null,
              ChildrenFlags.NO_CHILDREN
            )
          : null
      } else if (this.comp) {
        return createComponentVNode(
          this.comp,
          unwrap(props),
          slots,
          ChildrenFlags.STABLE_SLOTS
        )
      } else {
        return loadingComp && !this.delayed
          ? createComponentVNode(
              loadingComp,
              null,
              null,
              ChildrenFlags.NO_CHILDREN
            )
          : null
      }
    }
  } as ComponentClass
}
