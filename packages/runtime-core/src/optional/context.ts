import { observable } from '@vue/observer'
import { Component, FunctionalComponent, ComponentInstance } from '../component'
import { warn } from '../warning'
import { Slots, VNode } from '../vdom'
import { VNodeFlags } from '../flags'

interface ProviderProps {
  id: string | symbol
  value: any
}

export class Provide extends Component<ProviderProps> {
  context: Record<string | symbol, any> = observable()

  static props = {
    id: {
      type: [String, Symbol],
      required: true
    },
    value: {
      required: true
    }
  }

  created() {
    const { $props, context } = this
    this.$watch(
      () => $props.value,
      value => {
        // TS doesn't allow symbol as index :/
        // https://github.com/Microsoft/TypeScript/issues/24587
        context[$props.id as string] = value
      },
      {
        sync: true,
        immediate: true
      }
    )
    if (__DEV__) {
      this.$watch(
        () => $props.id,
        (id, oldId) => {
          warn(
            `Context provider id change detected (from "${oldId}" to "${id}"). ` +
              `This is not supported and should be avoided as it leads to ` +
              `indeterministic context resolution.`
          )
        },
        {
          sync: true
        }
      )
    }
  }

  render(props: any, slots: any) {
    return slots.default && slots.default()
  }
}

interface InjectProps {
  id: string | symbol
}

export const Inject: FunctionalComponent<InjectProps> = (
  props: InjectProps,
  slots: Slots,
  attrs: any,
  vnode: VNode
) => {
  let resolvedValue
  let resolved = false
  const { id } = props
  // walk the parent chain to locate context with key
  while (vnode !== null && vnode.contextVNode !== null) {
    if (
      vnode.flags & VNodeFlags.COMPONENT_STATEFUL &&
      (vnode.children as ComponentInstance).constructor === Provide &&
      (vnode.children as any).context.hasOwnProperty(id)
    ) {
      resolved = true
      resolvedValue = (vnode.children as any).context[id]
      break
    }
    vnode = vnode.contextVNode
  }
  if (__DEV__ && !resolved) {
    warn(
      `Inject with id "${id.toString()}" did not match any Provider with ` +
        `corresponding property in the parent chain.`
    )
  }
  return slots.default && slots.default(resolvedValue)
}
