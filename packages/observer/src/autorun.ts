import { OperationTypes } from './operations'
import { Dep, KeyToDepMap, targetMap } from './state'

export interface Autorun {
  (): any
  isAutorun: true
  active: boolean
  raw: Function
  deps: Array<Dep>
  scheduler?: Scheduler
  onTrack?: Debugger
  onTrigger?: Debugger
}

export interface AutorunOptions {
  lazy?: boolean
  scheduler?: Scheduler
  onTrack?: Debugger
  onTrigger?: Debugger
}

export type Scheduler = (run: () => any) => void

export type DebuggerEvent = {
  runner: Autorun
  target: any
  type: OperationTypes
  key: string | symbol | undefined
}

export type Debugger = (event: DebuggerEvent) => void

export const activeAutorunStack: Autorun[] = []

export const ITERATE_KEY = Symbol('iterate')

export function createAutorun(fn: Function, options: AutorunOptions): Autorun {
  const runner = function runner(...args): any {
    return run(runner as Autorun, fn, args)
  } as Autorun
  runner.isAutorun = true
  runner.active = true
  runner.raw = fn
  runner.scheduler = options.scheduler
  runner.onTrack = options.onTrack
  runner.onTrigger = options.onTrigger
  runner.deps = []
  return runner
}

function run(runner: Autorun, fn: Function, args: any[]): any {
  if (!runner.active) {
    return fn(...args)
  }
  if (activeAutorunStack.indexOf(runner) === -1) {
    cleanup(runner)
    try {
      activeAutorunStack.push(runner)
      return fn(...args)
    } finally {
      activeAutorunStack.pop()
    }
  }
}

export function cleanup(runner: Autorun) {
  for (let i = 0; i < runner.deps.length; i++) {
    runner.deps[i].delete(runner)
  }
  runner.deps = []
}

export function track(
  target: any,
  type: OperationTypes,
  key?: string | symbol
) {
  const runner = activeAutorunStack[activeAutorunStack.length - 1]
  if (runner) {
    if (type === OperationTypes.ITERATE) {
      key = ITERATE_KEY
    }
    // keyMap must exist because only an observed target can call this function
    const depsMap = targetMap.get(target) as KeyToDepMap
    let dep = depsMap.get(key as string | symbol)
    if (!dep) {
      depsMap.set(key as string | symbol, (dep = new Set()))
    }
    if (!dep.has(runner)) {
      dep.add(runner)
      runner.deps.push(dep)
      if (__DEV__ && runner.onTrack) {
        runner.onTrack({
          runner,
          target,
          type,
          key
        })
      }
    }
  }
}

export function trigger(
  target: any,
  type: OperationTypes,
  key?: string | symbol,
  extraInfo?: any
) {
  const depsMap = targetMap.get(target) as KeyToDepMap
  const runners = new Set()
  if (type === OperationTypes.CLEAR) {
    // collection being cleared, trigger all runners for target
    depsMap.forEach(dep => {
      addRunners(runners, dep)
    })
  } else {
    // schedule runs for SET | ADD | DELETE
    addRunners(runners, depsMap.get(key as string | symbol))
    // also run for iteration key on ADD | DELETE
    if (type === OperationTypes.ADD || type === OperationTypes.DELETE) {
      const iterationKey = Array.isArray(target) ? 'length' : ITERATE_KEY
      addRunners(runners, depsMap.get(iterationKey))
    }
  }
  runners.forEach(runner => {
    scheduleRun(runner, target, type, key, extraInfo)
  })
}

function addRunners(
  runners: Set<Autorun>,
  runnersToAdd: Set<Autorun> | undefined
) {
  if (runnersToAdd !== void 0) {
    runnersToAdd.forEach(runners.add, runners)
  }
}

function scheduleRun(
  runner: Autorun,
  target: any,
  type: OperationTypes,
  key: string | symbol | undefined,
  extraInfo: any
) {
  if (__DEV__ && runner.onTrigger) {
    runner.onTrigger(
      Object.assign(
        {
          runner,
          target,
          key,
          type
        },
        extraInfo
      )
    )
  }
  if (runner.scheduler !== void 0) {
    runner.scheduler(runner)
  } else {
    runner()
  }
}
