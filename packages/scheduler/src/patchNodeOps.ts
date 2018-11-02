import { NodeOps } from '@vue/runtime-core'
import { nodeOps } from '../../runtime-dom/src/nodeOps'
import { nodeOps as testNodeOps } from '../../runtime-test/src/nodeOps'

export type Op = [Function, ...any[]]

let currentOps: Op[]

export function setCurrentOps(ops: Op[]) {
  currentOps = ops
}

const evaluate = (v: any) => {
  return typeof v === 'function' ? v() : v
}

// patch nodeOps to record operations without touching the DOM
function patchOps(nodeOps: NodeOps) {
  Object.keys(nodeOps).forEach((key: keyof NodeOps) => {
    const original = nodeOps[key] as Function
    if (key === 'querySelector') {
      return
    }
    if (/create/.test(key)) {
      nodeOps[key] = (...args: any[]) => {
        let res: any
        if (currentOps) {
          return () => res || (res = original(...args))
        } else {
          return original(...args)
        }
      }
    } else if (!/parent|next|query/.test(key)) {
      nodeOps[key] = (...args: any[]) => {
        if (currentOps) {
          currentOps.push([original, ...args.map(evaluate)])
        } else {
          return original(...args)
        }
      }
    } else {
      nodeOps[key] = (node: any) => {
        return original(evaluate(node))
      }
    }
  })
}

patchOps(nodeOps)
patchOps(testNodeOps)
