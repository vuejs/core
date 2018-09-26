import { ChildrenFlags } from '../flags'
import { createComponentVNode, VNodeData } from '../vdom'
import { Component, ComponentType, FunctionalComponent } from '../component'

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
  timedOut: boolean
}

interface AsyncContainerProps {
  options: AsyncComponentFullOptions
  rawData: VNodeData | null
}

export class AsyncContainer extends Component<
  AsyncContainerData,
  AsyncContainerProps
> {
  data() {
    return {
      comp: null,
      err: null,
      timedOut: false
    }
  }

  created() {
    const { factory, timeout } = this.$props.options
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
  }

  render(props: AsyncContainerProps) {
    if (this.err || (this.timedOut && !this.comp)) {
      const error =
        this.err ||
        new Error(`Async component timed out after ${props.options.timeout}ms.`)
      const errorComp = props.options.error
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
        props.rawData,
        null,
        ChildrenFlags.UNKNOWN_CHILDREN
      )
    } else {
      const loadingComp = props.options.loading
      return loadingComp
        ? createComponentVNode(
            loadingComp,
            null,
            null,
            ChildrenFlags.NO_CHILDREN
          )
        : null
    }
  }
}

export function createAsyncComponent(
  options: AsyncComponentOptions
): FunctionalComponent {
  if (typeof options === 'function') {
    options = { factory: options }
  }
  return (_, __, ___, rawData) =>
    createComponentVNode(
      AsyncContainer,
      { options, rawData },
      null,
      ChildrenFlags.NO_CHILDREN
    )
}
