/* eslint-disable no-console */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-restricted-globals */

import { nextTick } from '@vue/vapor'

declare namespace globalThis {
  let doProfile: boolean
  let reactivity: boolean
  let recordTime: boolean
  let times: Record<string, number[]>
}

globalThis.recordTime = true
globalThis.doProfile = false
globalThis.reactivity = false

export const defer = () => new Promise(r => requestIdleCallback(r))

const times: Record<string, number[]> = (globalThis.times = {})

export function wrap(
  id: string,
  fn: (...args: any[]) => any,
): (...args: any[]) => Promise<void> {
  return async (...args) => {
    if (!globalThis.recordTime) {
      return fn(...args)
    }

    document.body.classList.remove('done')

    const { doProfile } = globalThis
    await nextTick()

    doProfile && console.profile(id)
    const start = performance.now()
    fn(...args)

    await nextTick()
    let time: number
    if (globalThis.reactivity) {
      time = performance.measure(
        'flushJobs-measure',
        'flushJobs-start',
        'flushJobs-end',
      ).duration
      performance.clearMarks()
      performance.clearMeasures()
    } else {
      time = performance.now() - start
    }
    const prevTimes = times[id] || (times[id] = [])
    prevTimes.push(time)

    const { min, max, median, mean, std } = compute(prevTimes)
    const msg =
      `${id}: min: ${min} / ` +
      `max: ${max} / ` +
      `median: ${median}ms / ` +
      `mean: ${mean}ms / ` +
      `time: ${time.toFixed(2)}ms / ` +
      `std: ${std} ` +
      `over ${prevTimes.length} runs`
    doProfile && console.profileEnd(id)
    console.log(msg)
    const timeEl = document.getElementById('time')!
    timeEl.textContent = msg

    document.body.classList.add('done')
  }
}

function compute(array: number[]) {
  const n = array.length
  const max = Math.max(...array)
  const min = Math.min(...array)
  const mean = array.reduce((a, b) => a + b) / n
  const std = Math.sqrt(
    array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n,
  )
  const median = array.slice().sort((a, b) => a - b)[Math.floor(n / 2)]
  return {
    max: round(max),
    min: round(min),
    mean: round(mean),
    std: round(std),
    median: round(median),
  }
}

function round(n: number) {
  return +n.toFixed(2)
}
