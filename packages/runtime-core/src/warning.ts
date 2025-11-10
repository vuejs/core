import {
  type Data,
  type GenericComponentInstance,
  formatComponentName,
} from './component'
import { isFunction, isString } from '@vue/shared'
import { isRef, setActiveSub, toRaw } from '@vue/reactivity'
import { ErrorCodes, callWithErrorHandling } from './errorHandling'
import { type VNode, isVNode } from './vnode'

const stack: (GenericComponentInstance | VNode)[] = []

type TraceEntry = {
  ctx: GenericComponentInstance | VNode
  recurseCount: number
}

type ComponentTraceStack = TraceEntry[]

/**
 * @internal
 */
export function pushWarningContext(
  ctx: GenericComponentInstance | VNode,
): void {
  stack.push(ctx)
}

/**
 * @internal
 */
export function popWarningContext(): void {
  stack.pop()
}

let isWarning = false

export function warn(msg: string, ...args: any[]): void {
  if (isWarning) return
  isWarning = true

  // avoid props formatting or warn handler tracking deps that might be mutated
  // during patch, leading to infinite recursion.
  const prevSub = setActiveSub()

  const entry = stack.length ? stack[stack.length - 1] : null
  const instance = isVNode(entry) ? entry.component : entry
  const appWarnHandler = instance && instance.appContext.config.warnHandler
  const trace = getComponentTrace()

  if (appWarnHandler) {
    callWithErrorHandling(
      appWarnHandler,
      instance,
      ErrorCodes.APP_WARN_HANDLER,
      [
        // eslint-disable-next-line no-restricted-syntax
        msg + args.map(a => a.toString?.() ?? JSON.stringify(a)).join(''),
        (instance && instance.proxy) || instance,
        trace
          .map(
            ({ ctx }) =>
              `at <${formatComponentName(instance, (ctx as any).type)}>`,
          )
          .join('\n'),
        trace,
      ],
    )
  } else {
    const warnArgs = [`[Vue warn]: ${msg}`, ...args]
    if (
      trace.length &&
      // avoid spamming console during tests
      !__TEST__
    ) {
      /* v8 ignore next 2 */
      warnArgs.push(`\n`, ...formatTrace(trace))
    }
    console.warn(...warnArgs)
  }

  setActiveSub(prevSub)
  isWarning = false
}

export function getComponentTrace(): ComponentTraceStack {
  let currentCtx: TraceEntry['ctx'] | null = stack[stack.length - 1]
  if (!currentCtx) {
    return []
  }

  // we can't just use the stack because it will be incomplete during updates
  // that did not start from the root. Re-construct the parent chain using
  // instance parent pointers.
  const normalizedStack: ComponentTraceStack = []

  while (currentCtx) {
    const last = normalizedStack[0]
    if (last && last.ctx === currentCtx) {
      last.recurseCount++
    } else {
      normalizedStack.push({
        ctx: currentCtx,
        recurseCount: 0,
      })
    }
    if (isVNode(currentCtx)) {
      const parent: GenericComponentInstance | null =
        currentCtx.component && currentCtx.component.parent
      currentCtx = (parent && parent.vnode) || parent
    } else {
      currentCtx = currentCtx.parent
    }
  }

  return normalizedStack
}

/* v8 ignore start */
function formatTrace(trace: ComponentTraceStack): any[] {
  const logs: any[] = []
  trace.forEach((entry, i) => {
    logs.push(...(i === 0 ? [] : [`\n`]), ...formatTraceEntry(entry))
  })
  return logs
}

function formatTraceEntry({ ctx, recurseCount }: TraceEntry): any[] {
  const postfix =
    recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``
  const instance = isVNode(ctx) ? ctx.component : ctx
  const isRoot = instance ? instance.parent == null : false
  const open = ` at <${formatComponentName(instance, (ctx as any).type, isRoot)}`
  const close = `>` + postfix
  return ctx.props ? [open, ...formatProps(ctx.props), close] : [open + close]
}

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

/**
 * @internal
 */
export function assertNumber(val: unknown, type: string): void {
  if (!__DEV__) return
  if (val === undefined) {
    return
  } else if (typeof val !== 'number') {
    warn(`${type} is not a valid number - ` + `got ${JSON.stringify(val)}.`)
  } else if (isNaN(val)) {
    warn(`${type} is NaN - ` + 'the duration expression might be incorrect.')
  }
}
/* v8 ignore stop */
