// @ts-expect-error
globalThis.doProfile = false
// const defer = nextTick
const ric =
  typeof requestIdleCallback === 'undefined' ? setTimeout : requestIdleCallback
export const defer = () => new Promise(r => ric(r))

const times: Record<string, number[]> = {}

export const wrap = (
  id: string,
  fn: (...args: any[]) => any,
): ((...args: any[]) => Promise<void>) => {
  if (import.meta.env.PROD) return fn
  return async (...args) => {
    const btns = Array.from(
      document.querySelectorAll<HTMLButtonElement>('#control button'),
    )
    for (const node of btns) {
      node.disabled = true
    }
    const doProfile = (globalThis as any).doProfile
    await defer()

    doProfile && console.profile(id)
    const start = performance.now()
    fn(...args)
    await defer()
    const time = performance.now() - start
    const prevTimes = times[id] || (times[id] = [])
    prevTimes.push(time)
    const median = prevTimes.slice().sort((a, b) => a - b)[
      Math.floor(prevTimes.length / 2)
    ]
    const mean = prevTimes.reduce((a, b) => a + b, 0) / prevTimes.length
    const msg =
      `${id}: min: ${Math.min(...prevTimes).toFixed(2)} / ` +
      `max: ${Math.max(...prevTimes).toFixed(2)} / ` +
      `median: ${median.toFixed(2)}ms / ` +
      `mean: ${mean.toFixed(2)}ms / ` +
      `time: ${time.toFixed(2)}ms / ` +
      `std: ${getStandardDeviation(prevTimes).toFixed(2)} ` +
      `over ${prevTimes.length} runs`
    doProfile && console.profileEnd(id)
    console.log(msg)
    document.getElementById('time')!.textContent = msg

    for (const node of btns) {
      node.disabled = false
    }
  }
}

function getStandardDeviation(array: number[]) {
  const n = array.length
  const mean = array.reduce((a, b) => a + b) / n
  return Math.sqrt(
    array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n,
  )
}
