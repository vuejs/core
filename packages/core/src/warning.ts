import { ComponentType, ComponentClass, FunctionalComponent } from './component'
import { EMPTY_OBJ } from './utils'
import { VNode } from './vdom'

let stack: VNode[] = []

export function pushWarningContext(vnode: VNode) {
  stack.push(vnode)
}

export function popWarningContext() {
  stack.pop()
}

export function warn(msg: string, ...args: any[]) {
  // TODO warn handler?
  console.warn(`[Vue warn]: ${msg}${getComponentTrace()}`, ...args)
}

function getComponentTrace(): string {
  let current: VNode | null | undefined = stack[stack.length - 1]
  if (!current) {
    return ''
  }

  // we can't just use the stack because it will be incomplete during updates
  // that did not start from the root. Re-construct the parent chain using
  // contextVNode information.
  const normlaizedStack: Array<{
    type: VNode
    recurseCount: number
  }> = []

  while (current) {
    const last = normlaizedStack[0]
    if (last && last.type === current) {
      last.recurseCount++
    } else {
      normlaizedStack.unshift({
        type: current,
        recurseCount: 0
      })
    }
    current = current.contextVNode
  }

  return (
    `\nat ` +
    normlaizedStack
      .map(({ type, recurseCount }, i) => {
        const padding = i === 0 ? '' : '  '.repeat(i + 1)
        const postfix =
          recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``
        return (
          padding + formatComponentName(type.tag as ComponentType) + postfix
        )
      })
      .join('\n')
  )
}

const classifyRE = /(?:^|[-_])(\w)/g
const classify = (str: string): string =>
  str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '')

function formatComponentName(c: ComponentType, includeFile?: boolean): string {
  let name: string
  let file: string | null = null

  if (c.prototype && c.prototype.render) {
    // stateful
    const cc = c as ComponentClass
    const options = cc.options || EMPTY_OBJ
    name = options.displayName || cc.name
    file = options.__file
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

  const filePostfix = file && includeFile !== false ? ` at ${file}` : ''
  return `<${classify(name)}>` + filePostfix
}
