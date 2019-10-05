import { VNode } from './vnode'
import { Data, ComponentInternalInstance } from './component'
import { isString } from '@vue/shared'
import { toRaw } from '@vue/reactivity'

let stack: VNode[] = []

type TraceEntry = {
  vnode: VNode
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
  const instance = stack.length ? stack[stack.length - 1].component : null
  const appWarnHandler = instance && instance.appContext.config.warnHandler
  const trace = getComponentTrace()

  if (appWarnHandler) {
    appWarnHandler(
      msg + args.join(''),
      instance && instance.renderProxy,
      formatTrace(trace).join('')
    )
    return
  }

  console.warn(`[Vue warn]: ${msg}`, ...args)
  // avoid spamming console during tests
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return
  }
  if (!trace.length) {
    return
  }
  if (trace.length > 1 && console.groupCollapsed) {
    console.groupCollapsed('at', ...formatTraceEntry(trace[0]))
    const logs: string[] = []
    trace.slice(1).forEach((entry, i) => {
      if (i !== 0) logs.push('\n')
      logs.push(...formatTraceEntry(entry, i + 1))
    })
    console.log(...logs)
    console.groupEnd()
  } else {
    console.log(...formatTrace(trace))
  }
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
        vnode: currentVNode,
        recurseCount: 0
      })
    }
    const parentInstance: ComponentInternalInstance | null = currentVNode.component!
      .parent
    currentVNode = parentInstance && parentInstance.vnode
  }

  return normalizedStack
}

function formatTrace(trace: ComponentTraceStack): string[] {
  const logs: string[] = []
  trace.forEach((entry, i) => {
    const formatted = formatTraceEntry(entry, i)
    if (i === 0) {
      logs.push('at', ...formatted)
    } else {
      logs.push('\n', ...formatted)
    }
  })
  return logs
}

function formatTraceEntry(
  { vnode, recurseCount }: TraceEntry,
  depth: number = 0
): string[] {
  const padding = depth === 0 ? '' : ' '.repeat(depth * 2 + 1)
  const postfix =
    recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``
  const open = padding + `<${formatComponentName(vnode)}`
  const close = `>` + postfix
  const rootLabel = vnode.component!.parent == null ? `(Root)` : ``
  return vnode.props
    ? [open, ...formatProps(vnode.props), close, rootLabel]
    : [open + close, rootLabel]
}

const classifyRE = /(?:^|[-_])(\w)/g
const classify = (str: string): string =>
  str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '')

function formatComponentName(vnode: VNode, file?: string): string {
  const Component = vnode.type as any
  let name = Component.displayName || Component.name
  if (!name && file) {
    const match = file.match(/([^/\\]+)\.vue$/)
    if (match) {
      name = match[1]
    }
  }
  return name ? classify(name) : 'AnonymousComponent'
}

function formatProps(props: Data): string[] {
  const res: string[] = []
  for (const key in props) {
    const value = props[key]
    if (isString(value)) {
      res.push(`${key}=${JSON.stringify(value)}`)
    } else {
      res.push(`${key}=`, toRaw(value) as any)
    }
  }
  return res
}
