import { isArray } from '.'
const targetMap = new Map<Node, Set<Function>>()

let observer: MutationObserver | null = null

/**
 * Observe DOM removal of a target element
 * @param target
 * @param callback
 */
export function observeDomRemoval(
  target: Node,
  callback: Function | Function[]
) {
  let cbSet = targetMap.get(target)

  if (!cbSet) {
    cbSet = new Set()
    targetMap.set(target, cbSet)
  }
  if (isArray(callback)) {
    callback.forEach(cb => cbSet!.add(cb))
  } else {
    cbSet.add(callback)
  }

  if (observer) return
  observer = new MutationObserver(mutationsList => {
    if (targetMap.size === 0) return
    for (const mutation of mutationsList) {
      const removedNodes = mutation.removedNodes
      if (mutation.type === 'childList' && removedNodes.length > 0) {
        for (let index = 0; index < removedNodes.length; index++) {
          const removedNode = removedNodes[index]
          for (const [target, cbSet] of targetMap) {
            if (removedNode.contains(target)) {
              cbSet.forEach(cb => cb())
              targetMap.delete(target)
              return
            }
          }
        }
      }
    }
  })
  observer.observe(document, { childList: true, subtree: true })
}
