// global immutability lock
export let LOCKED = true

export function lock() {
  LOCKED = true
}

export function unlock() {
  LOCKED = false
}
