import { ReactiveEffect } from '@vue/reactivity'

const p = Promise.resolve()

let queued: any[] | undefined

function queue(fn: any) {
  if (!queued) {
    queued = [fn]
    p.then(flush)
  } else {
    queued.push(fn)
  }
}

function flush() {
  for (let i = 0; i < queued!.length; i++) {
    queued![i]()
  }
  queued = undefined
}

export const nextTick = (fn: any) => p.then(fn)

export function effect(fn: any) {
  let run: () => void
  const e = new ReactiveEffect(fn, () => queue(run))
  run = e.run.bind(e)
  run()
}
