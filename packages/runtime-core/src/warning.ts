import { VNode } from './vnode'
import {
  Data,
  ComponentInternalInstance,
  ConcreteComponent,
  formatComponentName
} from './component'
import { isString, isFunction } from '@vue/shared'
import { toRaw, isRef, pauseTracking, resetTracking } from '@vue/reactivity'
import { callWithErrorHandling, ErrorCodes } from './errorHandling'

type ComponentVNode = VNode & {
  type: ConcreteComponent
}

const stack: VNode[] = []

type TraceEntry = {
  vnode: ComponentVNode
  recurseCount: number
}

type ComponentTraceStack = TraceEntry[]

export function pushWarningContext(vnode: VNode) {
  stack.push(vnode)
}

export function popWarningContext() {
  stack.pop()
}

export function warn(msg: string, ...args: any[]) {
  // avoid props formatting or warn handler tracking deps that might be mutated
  // during patch, leading to infinite recursion.
  pauseTracking()

  const instance = stack.length ? stack[stack.length - 1].component : null
  const appWarnHandler = instance && instance.appContext.config.warnHandler
  const trace = getComponentTrace()

  if (appWarnHandler) {
    callWithErrorHandling(
      appWarnHandler,
      instance,
      ErrorCodes.APP_WARN_HANDLER,
      [
        msg + args.join(''),
        instance && instance.proxy,
        trace
          .map(
            ({ vnode }) => `at <${formatComponentName(instance, vnode.type)}>`
          )
          .join('\n'),
        trace
      ]
    )
  } else {
    const warnArgs = [`[Vue warn]: ${msg}`, ...args]
    /* istanbul ignore if */
    if (
      trace.length &&
      // avoid spamming console during tests
      !__TEST__
    ) {
      warnArgs.push(`\n`, ...formatTrace(trace))
    }
    console.warn(...warnArgs)
  }

  resetTracking()
}

function getComponentTrace(): ComponentTraceStack {
  let currentVNode: VNode | null = stack[stack.length - 1]
  if (!currentVNode) {
    return []
  }

  // we can't just use the stack because it will be incomplete during updates
  // that did not start from the root. Re-construct the parent chain using
  // instance parent pointers.
  const normalizedStack: ComponentTraceStack = []

  while (currentVNode) {
    const last = normalizedStack[0]
    if (last && last.vnode === currentVNode) {
      last.recurseCount++
    } else {
      normalizedStack.push({
        vnode: currentVNode as ComponentVNode,
        recurseCount: 0
      })
    }
    const parentInstance: ComponentInternalInstance | null =
      currentVNode.component && currentVNode.component.parent
    currentVNode = parentInstance && parentInstance.vnode
  }

  return normalizedStack
}

/* istanbul ignore next */
function formatTrace(trace: ComponentTraceStack): any[] {
  const logs: any[] = []
  trace.forEach((entry, i) => {
    logs.push(...(i === 0 ? [] : [`\n`]), ...formatTraceEntry(entry))
  })
  return logs
}

function formatTraceEntry({ vnode, recurseCount }: TraceEntry): any[] {
  const postfix =
    recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``
  const isRoot = vnode.component ? vnode.component.parent == null : false
  const open = ` at <${formatComponentName(
    vnode.component,
    vnode.type,
    isRoot
  )}`
  const close = `>` + postfix
  return vnode.props
    ? [open, ...formatProps(vnode.props), close]
    : [open + close]
}

/* istanbul ignore next */
function formatProps(props: Data): any[] {
  const res: any[] = []
  const keys = Object.keys(props)
  keys.slice(0, 3).forEach(key => {
    res.push(...formatProp(key, props[key]))
  })
  if (keys.length > 3) {
    res.push(` ...`)
  }
  return res
}

function formatProp(key: string, value: unknown): any[]
function formatProp(key: string, value: unknown, raw: true): any
/* istanbul ignore next */
function formatProp(key: string, value: unknown, raw?: boolean): any {
  if (isString(value)) {
    value = JSON.stringify(value)
    return raw ? value : [`${key}=${value}`]
  } else if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value == null
  ) {
    return raw ? value : [`${key}=${value}`]
  } else if (isRef(value)) {
    value = formatProp(key, toRaw(value.value), true)
    return raw ? value : [`${key}=Ref<`, value, `>`]
  } else if (isFunction(value)) {
    return [`${key}=fn${value.name ? `<${value.name}>` : ``}`]
  } else {
    value = toRaw(value)
    return raw ? value : [`${key}=`, value]
  }
}
