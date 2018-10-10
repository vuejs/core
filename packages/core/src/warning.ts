import { ComponentType, ComponentClass, FunctionalComponent } from './component'
import { EMPTY_OBJ } from './utils'

// TODO push vnodes instead
// component vnodes get a new property (contextVNode) which points to the
// parent component (stateful or functional)
// this way we can use any component vnode to construct a trace that inludes
// functional and stateful components.

// in createRenderer, parentComponent should be replced by ctx
// $parent logic should also accomodate

let stack: ComponentType[] = []

export function pushComponent(c: ComponentType) {
  stack.push(c)
}

export function popComponent() {
  stack.pop()
}

export function warn(msg: string) {
  // TODO warn handler?
  console.warn(`[Vue warn]: ${msg}${getComponentTrace()}`)
}

function getComponentTrace(): string {
  const current = stack[stack.length - 1]
  if (!current) {
    return ''
  }
  // we can't just use the stack itself, because it will be incomplete
  // during updates
  // check recursive
  const normlaizedStack: Array<{
    type: ComponentType
    recurseCount: number
  }> = []
  stack.forEach(c => {
    const last = normlaizedStack[normlaizedStack.length - 1]
    if (last && last.type === c) {
      last.recurseCount++
    } else {
      normlaizedStack.push({ type: c, recurseCount: 0 })
    }
  })
  return (
    `\n\nfound in\n\n` +
    normlaizedStack
      .map(({ type, recurseCount }, i) => {
        const padding = i === 0 ? '---> ' : ' '.repeat(5 + i * 2)
        const postfix =
          recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``
        return padding + formatComponentName(type) + postfix
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

  if (c.prototype.render) {
    const cc = c as ComponentClass
    const options = cc.options || EMPTY_OBJ
    name = options.displayName || cc.name
    file = options.__file
  } else {
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
