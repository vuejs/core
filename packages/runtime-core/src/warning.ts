import { ComponentType, ComponentClass, FunctionalComponent } from './component'
import { EMPTY_OBJ, isString } from '@vue/shared'
import { VNode } from './vdom'
import { Data } from './componentOptions'

let stack: VNode[] = []

type TraceEntry = {
  type: VNode
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
  // TODO warn handler
  console.warn(`[Vue warn]: ${msg}`, ...args)
  const trace = getComponentTrace()
  if (!trace.length) {
    return
  }
  if (console.groupCollapsed) {
    console.groupCollapsed('at', ...formatTraceEntry(trace[0]))
    const logs: string[] = []
    trace.slice(1).forEach((entry, i) => {
      logs.push('\n', ...formatTraceEntry(entry, i + 1))
    })
    console.log(...logs)
    console.groupEnd()
  } else {
    const logs: string[] = []
    trace.forEach((entry, i) => {
      const formatted = formatTraceEntry(entry, i)
      if (i === 0) {
        logs.push('at', ...formatted)
      } else {
        logs.push('\n', ...formatted)
      }
    })
    console.log(...logs)
  }
}

function getComponentTrace(): ComponentTraceStack {
  let current: VNode | null | undefined = stack[stack.length - 1]
  if (!current) {
    return []
  }

  // we can't just use the stack because it will be incomplete during updates
  // that did not start from the root. Re-construct the parent chain using
  // contextVNode information.
  const normlaizedStack: ComponentTraceStack = []

  while (current) {
    const last = normlaizedStack[0]
    if (last && last.type === current) {
      last.recurseCount++
    } else {
      normlaizedStack.push({
        type: current,
        recurseCount: 0
      })
    }
    current = current.contextVNode
  }

  return normlaizedStack
}

function formatTraceEntry(
  { type, recurseCount }: TraceEntry,
  depth: number = 0
): string[] {
  const padding = depth === 0 ? '' : ' '.repeat(depth * 2 + 1)
  const postfix =
    recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``
  const open = padding + `<${formatComponentName(type.tag as ComponentType)}`
  const close = `>` + postfix
  return type.data ? [open, ...formatProps(type.data), close] : [open + close]
}

const classifyRE = /(?:^|[-_])(\w)/g
const classify = (str: string): string =>
  str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '')

function formatComponentName(c: ComponentType, file?: string): string {
  let name: string

  if (c.prototype && c.prototype.render) {
    // stateful
    const cc = c as ComponentClass
    const options = cc.options || EMPTY_OBJ
    name = options.displayName || cc.name
  } else {
    // functional
    const fc = c as FunctionalComponent
    name = fc.displayName || fc.name
  }

  if (file && name === 'AnonymousComponent') {
    const match = file.match(/([^/\\]+)\.vue$/)
    if (match) {
      name = match[1]
    }
  }

  return classify(name)
}

function formatProps(props: Data) {
  const res = []
  for (const key in props) {
    const value = props[key]
    if (isString(value)) {
      res.push(`${key}=${JSON.stringify(value)}`)
    } else {
      res.push(`${key}=`, value)
    }
  }
  return res
}
