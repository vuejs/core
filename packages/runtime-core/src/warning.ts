import { VNode } from './vnode'
import { Data, ComponentInternalInstance, Component } from './component'
import { isString, isFunction } from '@vue/shared'
import { toRaw, isRef, pauseTracking, resumeTracking } from '@vue/reactivity'
import { callWithErrorHandling, ErrorCodes } from './errorHandling'

type ComponentVNode = VNode & {
  type: Component
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
        instance && instance.renderProxy,
        trace
          .map(({ vnode }) => `at <${formatComponentName(vnode)}>`)
          .join('\n'),
        trace
      ]
    )
  } else {
    const warnArgs = [`[Vue warn]: ${msg}`, ...args]
    if (
      trace.length &&
      // avoid spamming console during tests
      !__TEST__
    ) {
      warnArgs.push(`\n`, ...formatTrace(trace))
    }
    console.warn(...warnArgs)
  }

  resumeTracking()
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
    const parentInstance: ComponentInternalInstance | null = currentVNode.component!
      .parent
    currentVNode = parentInstance && parentInstance.vnode
  }

  return normalizedStack
}

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
  const open = ` at <${formatComponentName(vnode)}`
  const close = `>` + postfix
  const rootLabel = vnode.component!.parent == null ? `(Root)` : ``
  return vnode.props
    ? [open, ...formatProps(vnode.props), close, rootLabel]
    : [open + close, rootLabel]
}

const classifyRE = /(?:^|[-_])(\w)/g
const classify = (str: string): string =>
  str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '')

function formatComponentName(vnode: ComponentVNode, file?: string): string {
  const Component = vnode.type as Component
  let name = isFunction(Component)
    ? Component.displayName || Component.name
    : Component.name
  if (!name && file) {
    const match = file.match(/([^/\\]+)\.vue$/)
    if (match) {
      name = match[1]
    }
  }
  return name ? classify(name) : 'Anonymous'
}

function formatProps(props: Data): any[] {
  const res: any[] = []
  for (const key in props) {
    res.push(...formatProp(key, props[key]))
  }
  return res
}

function formatProp(key: string, value: unknown): any[]
function formatProp(key: string, value: unknown, raw: true): any
function formatProp(key: string, value: unknown, raw?: boolean): any {
  if (isString(value)) {
    value = JSON.stringify(value)
    return raw ? value : [`${key}=${value}`]
  } else if (typeof value === 'number' || value == null) {
    return raw ? value : [`${key}=${value}`]
  } else if (isRef(value)) {
    value = formatProp(key, toRaw(value.value), true)
    return raw ? value : [`${key}=Ref<`, value, `>`]
  } else {
    value = toRaw(value)
    return raw ? value : [`${key}=`, value]
  }
}
