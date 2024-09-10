import { ErrorCodes, callWithErrorHandling, handleError } from './errorHandling'
import { type Awaited, NOOP, isArray } from '@vue/shared'
import { type ComponentInternalInstance, getComponentName } from './component'

// 定义一个用于异步任务队列管理的模块，支持任务的排队、立即执行、延后执行等功能。

/**
 * 定义一个SchedulerJob接口，扩展自Function，用于表示调度器中的一个任务
 * 包含任务的各种属性，如id、是否前置任务、是否激活、是否计算中、是否允许递归调用等
 */
export interface SchedulerJob extends Function {
  id?: number // 任务的唯一标识符
  pre?: boolean // 标记是否为前置任务
  active?: boolean // 标记任务是否激活
  computed?: boolean // 标记任务是否为计算任务
  /**
   * Indicates whether the effect is allowed to recursively trigger itself
   * when managed by the scheduler.
   *
   * By default, a job cannot trigger itself because some built-in method calls,
   * e.g. Array.prototype.push actually performs reads as well (#1740) which
   * can lead to confusing infinite loops.
   * The allowed cases are component update functions and watch callbacks.
   * Component update functions may update child component props, which in turn
   * trigger flush: "pre" watch callbacks that mutates state that the parent
   * relies on (#1801). Watch callbacks doesn't track its dependencies so if it
   * triggers itself again, it's likely intentional and it is the user's
   * responsibility to perform recursive state mutation that eventually
   * stabilizes (#1727).
   */
  allowRecurse?: boolean // 标记是否允许任务递归调用自身
  /**
   * Attached by renderer.ts when setting up a component's render effect
   * Used to obtain component information when reporting max recursive updates.
   * dev only.
   */
  ownerInstance?: ComponentInternalInstance // 任务所属的组件实例，仅开发环境使用
}

// 定义SchedulerJobs类型，可以是一个SchedulerJob实例或其数组
export type SchedulerJobs = SchedulerJob | SchedulerJob[]

let isFlushing = false // 标记当前是否正在执行队列中的任务
let isFlushPending = false // 标记是否已有任务等待执行

const queue: SchedulerJob[] = [] // 存储待执行任务的队列
let flushIndex = 0 // 当前执行到队列中的哪个位置

const pendingPostFlushCbs: SchedulerJob[] = [] // 存储待执行的后置回调函数
let activePostFlushCbs: SchedulerJob[] | null = null // 当前正在执行的后置回调函数队列
let postFlushIndex = 0 // 后置回调函数执行的索引

const resolvedPromise = /*#__PURE__*/ Promise.resolve() as Promise<any> // 一个已经解析的Promise，用于快速返回结果
let currentFlushPromise: Promise<void> | null = null // 当前执行队列中的Promise，用于链式执行

const RECURSION_LIMIT = 100 // 递归调用限制
type CountMap = Map<SchedulerJob, number>

/**
 * 将给定的函数fn安排在当前事件循环的下一个tick中执行。
 * 如果没有提供fn，则直接返回当前正在执行或已经解析的promise。
 *
 * @param fn 可选的函数，它将在下一个tick中被调用。默认为undefined。
 * @returns 返回一个Promise，该Promise在执行fn之后解析为fn的返回值（如果提供）。
 */
export function nextTick<T = void, R = void>(
  this: T,
  fn?: (this: T) => R,
): Promise<Awaited<R>> {
  // 获取当前正在刷新的 promise 或已解析的 promise。
  const p = currentFlushPromise || resolvedPromise
  // 如果提供了 fn，则在下一个 tick 中执行 fn，并返回 promise；否则，直接返回获取的 promise。
  return fn ? p.then(this ? fn.bind(this) : fn) : p
}

// 使用二分查找在队列中找到适合插入任务的位置，以保持队列中任务id的递增顺序，
// 这可以防止任务被跳过，也可以避免重复的修补操作。
// #2768
// Use binary-search to find a suitable position in the queue,
// so that the queue maintains the increasing order of job's id,
// which can prevent the job from being skipped and also can avoid repeated patching.
function findInsertionIndex(id: number) {
  // the start index should be `flushIndex + 1`
  let start = flushIndex + 1
  let end = queue.length

  while (start < end) {
    const middle = (start + end) >>> 1
    const middleJob = queue[middle]
    const middleJobId = getId(middleJob)
    if (middleJobId < id || (middleJobId === id && middleJob.pre)) {
      start = middle + 1
    } else {
      end = middle
    }
  }

  return start
}

/**
 * 将给定的函数fn安排在当前事件循环的下一个tick中执行
 * @param job 要安排的任务
 */
export function queueJob(job: SchedulerJob) {
  // the dedupe search uses the startIndex argument of Array.includes()
  // by default the search index includes the current job that is being run
  // so it cannot recursively trigger itself again.
  // if the job is a watch() callback, the search will start with a +1 index to
  // allow it recursively trigger itself - it is the user's responsibility to
  // ensure it doesn't end up in an infinite loop.
  // 利用Array.includes()方法的startIndex参数进行去重搜索，
  // 默认情况下，搜索从当前正在执行的任务之后开始，这样可以防止任务递归触发自身。
  if (
    !queue.length ||
    !queue.includes(
      job,
      isFlushing && job.allowRecurse ? flushIndex + 1 : flushIndex,
    )
  ) {
    if (job.id == null) {
      queue.push(job)
    } else {
      queue.splice(findInsertionIndex(job.id), 0, job)
    }
    queueFlush()
  }
}

/**
 * 需要刷新队列时调用，触发任务的执行
 */
function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true
    currentFlushPromise = resolvedPromise.then(flushJobs)
  }
}

export function invalidateJob(job: SchedulerJob) {
  const i = queue.indexOf(job)
  if (i > flushIndex) {
    queue.splice(i, 1)
  }
}

/**
 * 将后置回调函数加入队列，等待执行
 * @param cb 后置回调函数，可以是一个函数或函数数组
 */
export function queuePostFlushCb(cb: SchedulerJobs) {
  if (!isArray(cb)) {
    // 如果cb不是数组，检查是否已包含在当前正在执行的回调队列中，未包含则加入待执行队列
    if (
      !activePostFlushCbs ||
      !activePostFlushCbs.includes(
        cb,
        cb.allowRecurse ? postFlushIndex + 1 : postFlushIndex,
      )
    ) {
      pendingPostFlushCbs.push(cb)
    }
  } else {
    // if cb is an array, it is a component lifecycle hook which can only be
    // triggered by a job, which is already deduped in the main queue, so
    // we can skip duplicate check here to improve perf
    // 如果cb是数组，直接加入待执行队列，无需去重
    pendingPostFlushCbs.push(...cb)
  }
  queueFlush()
}

/**
 * 执行所有的前置回调函数
 * @param instance 当前组件实例，用于检查循环更新
 * @param seen 记录已执行的任务，防止循环更新
 * @param i
 */
export function flushPreFlushCbs(
  instance?: ComponentInternalInstance,
  seen?: CountMap,
  // if currently flushing, skip the current job itself
  i = isFlushing ? flushIndex + 1 : 0,
) {
  if (__DEV__) {
    seen = seen || new Map()
  }
  // 遍历队列中的任务，执行所有标记为前置的任务
  for (; i < queue.length; i++) {
    const cb = queue[i]
    if (cb && cb.pre) {
      if (instance && cb.id !== instance.uid) {
        continue
      }
      if (__DEV__ && checkRecursiveUpdates(seen!, cb)) {
        continue
      }
      // 从队列中移除已执行的任务，避免重复执行
      queue.splice(i, 1)
      i--
      cb()
    }
  }
}

/**
 * 执行所有的后置回调函数
 * @param seen 记录已执行的任务，防止循环更新
 */
export function flushPostFlushCbs(seen?: CountMap) {
  // 先将待执行的后置回调函数去重并排序
  if (pendingPostFlushCbs.length) {
    const deduped = [...new Set(pendingPostFlushCbs)].sort(
      (a, b) => getId(a) - getId(b),
    )
    pendingPostFlushCbs.length = 0

    // 如果已有活跃的后置回调函数队列，将新的回调函数加入队列
    // #1947 already has active queue, nested flushPostFlushCbs call
    if (activePostFlushCbs) {
      activePostFlushCbs.push(...deduped)
      return
    }

    activePostFlushCbs = deduped
    if (__DEV__) {
      seen = seen || new Map()
    }

    // 执行所有的后置回调函数
    for (
      postFlushIndex = 0;
      postFlushIndex < activePostFlushCbs.length;
      postFlushIndex++
    ) {
      const cb = activePostFlushCbs[postFlushIndex]
      if (__DEV__ && checkRecursiveUpdates(seen!, cb)) {
        continue
      }
      if (cb.active !== false) cb()
    }
    activePostFlushCbs = null
    postFlushIndex = 0
  }
}

const getId = (job: SchedulerJob): number =>
  job.id == null ? Infinity : job.id

const comparator = (a: SchedulerJob, b: SchedulerJob): number => {
  const diff = getId(a) - getId(b)
  if (diff === 0) {
    if (a.pre && !b.pre) return -1
    if (b.pre && !a.pre) return 1
  }
  return diff
}

/**
 * 执行队列中的所有任务
 * @param seen 记录已执行的任务，用于开发环境下的循环更新检查
 */
function flushJobs(seen?: CountMap) {
  isFlushPending = false
  isFlushing = true
  if (__DEV__) {
    seen = seen || new Map()
  }

  // 在执行前对任务队列进行排序，确保更新顺序正确
  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child so its render effect will have smaller
  //    priority number)
  // 2. If a component is unmounted during a parent component's update,
  //    its update can be skipped.
  queue.sort(comparator)

  // 条件判断外置以避免Rollup的优化导致的问题
  // conditional usage of checkRecursiveUpdate must be determined out of
  // try ... catch block since Rollup by default de-optimizes treeshaking
  // inside try-catch. This can leave all warning code unshaked. Although
  // they would get eventually shaken by a minifier like terser, some minifiers
  // would fail to do that (e.g. https://github.com/evanw/esbuild/issues/1610)
  const check = __DEV__
    ? (job: SchedulerJob) => checkRecursiveUpdates(seen!, job)
    : NOOP

  try {
    // 遍历队列，执行所有激活的任务
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex]
      if (job && job.active !== false) {
        if (__DEV__ && check(job)) {
          continue
        }
        // 错误处理
        callWithErrorHandling(job, null, ErrorCodes.SCHEDULER)
      }
    }
  } finally {
    // 清理状态，准备下一次执行
    flushIndex = 0
    queue.length = 0

    flushPostFlushCbs(seen)

    isFlushing = false
    currentFlushPromise = null
    // 如果还有未执行完的任务或者有新的任务加入，则继续执行
    // some postFlushCb queued jobs!
    // keep flushing until it drains.
    if (queue.length || pendingPostFlushCbs.length) {
      flushJobs(seen)
    }
  }
}

/**
 * 检查是否发生了递归更新，防止无限循环更新
 * @param seen 记录已执行的任务次数
 * @param fn 当前执行的任务
 * @returns 如果检测到递归更新，则返回true，否则返回false
 */
function checkRecursiveUpdates(seen: CountMap, fn: SchedulerJob) {
  if (!seen.has(fn)) {
    seen.set(fn, 1)
  } else {
    const count = seen.get(fn)!
    if (count > RECURSION_LIMIT) {
      // 如果递归次数超过限制，报错提醒
      const instance = fn.ownerInstance
      const componentName = instance && getComponentName(instance.type)
      handleError(
        `Maximum recursive updates exceeded${
          componentName ? ` in component <${componentName}>` : ``
        }. ` +
          `This means you have a reactive effect that is mutating its own ` +
          `dependencies and thus recursively triggering itself. Possible sources ` +
          `include component template, render function, updated hook or ` +
          `watcher source function.`,
        null,
        ErrorCodes.APP_ERROR_HANDLER,
      )
      return true
    } else {
      seen.set(fn, count + 1)
    }
  }
}
