import {
  type ComponentInternalInstance,
  currentInstance,
  formatComponentName,
} from './component'
import { isFunction, isString } from '@vue/shared'
import { isRef, pauseTracking, resetTracking, toRaw } from '@vue/reactivity'
import { VaporErrorCodes, callWithErrorHandling } from './errorHandling'
import type { NormalizedRawProps } from './componentProps'

type TraceEntry = {
  instance: ComponentInternalInstance
  recurseCount: number
}

type ComponentTraceStack = TraceEntry[]

export function warn(msg: string, ...args: any[]): void {
  // avoid props formatting or warn handler tracking deps that might be mutated
  // during patch, leading to infinite recursion.
  pauseTracking()

  const instance = currentInstance
  const appWarnHandler = instance && instance.appContext.config.warnHandler
  const trace = getComponentTrace()

  if (appWarnHandler) {
    callWithErrorHandling(
      appWarnHandler,
      instance,
      VaporErrorCodes.APP_WARN_HANDLER,
      [
        msg +
          args
            .map(a => (a.toString && a.toString()) ?? JSON.stringify(a))
            .join(''),
        instance,
        trace
          .map(
            ({ instance }) =>
              `at <${formatComponentName(instance, instance.type)}>`,
          )
          .join('\n'),
        trace,
      ],
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

export function getComponentTrace(): ComponentTraceStack {
  let instance = currentInstance
  if (!instance) return []

  // we can't just use the stack because it will be incomplete during updates
  // that did not start from the root. Re-construct the parent chain using
  // instance parent pointers.
  const stack: ComponentTraceStack = []

  while (instance) {
    const last = stack[0]
    if (last && last.instance === instance) {
      last.recurseCount++
    } else {
      stack.push({
        instance,
        recurseCount: 0,
      })
    }
    instance = instance.parent
  }

  return stack
}

function formatTrace(trace: ComponentTraceStack): any[] {
  const logs: any[] = []
  trace.forEach((entry, i) => {
    logs.push(...(i === 0 ? [] : [`\n`]), ...formatTraceEntry(entry))
  })
  return logs
}

function formatTraceEntry({ instance, recurseCount }: TraceEntry): any[] {
  const postfix =
    recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``
  const isRoot = instance ? instance.parent == null : false
  const open = ` at <${formatComponentName(instance, instance.type, isRoot)}`
  const close = `>` + postfix
  return instance.rawProps.length
    ? [open, ...formatProps(instance.rawProps), close]
    : [open + close]
}

function formatProps(rawProps: NormalizedRawProps): any[] {
  const fullProps: Record<string, any> = {}
  for (const props of rawProps) {
    if (isFunction(props)) {
      const propsObj = props()
      for (const key in propsObj) {
        fullProps[key] = propsObj[key]
      }
    } else {
      for (const key in props) {
        fullProps[key] = props[key]()
      }
    }
  }

  const res: any[] = []
  Object.keys(fullProps)
    .slice(0, 3)
    .forEach(key => res.push(...formatProp(key, fullProps[key])))

  if (fullProps.length > 3) {
    res.push(` ...`)
  }

  return res
}

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
