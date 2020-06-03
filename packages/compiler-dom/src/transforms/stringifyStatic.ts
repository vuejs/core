/**
 * This module is Node-only.
 */
import {
  CREATE_STATIC,
  createCallExpression,
  ElementNode,
  ElementTypes,
  ExpressionNode,
  HoistTransform,
  JSChildNode,
  NodeTypes,
  PlainElementNode,
  SimpleExpressionNode,
  TemplateChildNode,
  TextCallNode,
  TransformContext
} from '@vue/compiler-core'
import {
  escapeHtml,
  isKnownAttr,
  isString,
  isSymbol,
  isVoidTag,
  normalizeClass,
  normalizeStyle,
  stringifyStyle,
  toDisplayString
} from '@vue/shared'

export const enum StringifyThresholds {
  ELEMENT_WITH_BINDING_COUNT = 5,
  NODE_COUNT = 20
}

type StringifiableNode = PlainElementNode | TextCallNode

/**
 * Turn eligible hoisted static trees into stringified static nodes, e.g.
 *
 * ```js
 * const _hoisted_1 = createStaticVNode(`<div class="foo">bar</div>`)
 * ```
 *
 * A single static vnode can contain stringified content for **multiple**
 * consecutive nodes (element and plain text), called a "chunk".
 * `@vue/runtime-dom` will create the content via innerHTML in a hidden
 * container element and insert all the nodes in place. The call must also
 * provide the number of nodes contained in the chunk so that during hydration
 * we can know how many nodes the static vnode should adopt.
 *
 * The optimization scans a children list that contains hoisted nodes, and
 * tries to find the largest chunk of consecutive hoisted nodes before running
 * into a non-hoisted node or the end of the list. A chunk is then converted
 * into a single static vnode and replaces the hoisted expression of the first
 * node in the chunk. Other nodes in the chunk are considered "merged" and
 * therefore removed from both the hoist list and the children array.
 *
 * This optimization is only performed in Node.js.
 */
export const stringifyStatic: HoistTransform = (children, context, parent) => {
  let nc = 0 // current node count
  let ec = 0 // current element with binding count
  const currentChunk: StringifiableNode[] = []
  const chunks: (JSChildNode | TemplateChildNode)[] = []
  const parentIsHoistedNode = getHoistedNode(parent as TemplateChildNode)

  const pushChunk = () => {
    if (
      nc >= StringifyThresholds.NODE_COUNT ||
      ec >= StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
    ) {
      // combine all currently eligible nodes into a single static vnode call
      const staticCall = createCallExpression(context.helper(CREATE_STATIC), [
        JSON.stringify(
          currentChunk.map(node => stringifyNode(node, context)).join('')
        ),
        // the 2nd argument indicates the number of DOM nodes this static vnode
        // will insert / hydrate
        String(currentChunk.length)
      ])

      if (parentIsHoistedNode) {
        // if parent is hoisted, just append staticCall instead of hoisted vnode list
        chunks.push(staticCall)
      } else {
        // if parent isn't hoisted, this mean is hoisted node self.
        // so need remove chunk nodes, re-create hoist for staticCall
        for (let i = 0; i < currentChunk.length; i++) {
          removeHoist(currentChunk[i], context)
        }
        chunks.push(context.hoist(staticCall))
      }
      currentChunk.length = 0
    }
    // if the nodes of currentChunk can't static, should append to chunks
    if (currentChunk.length) {
      chunks.push(...currentChunk)
    }
  }

  let i = 0
  for (; i < children.length; i++) {
    const child = children[i]
    if (getHoistedNode(child) || parentIsHoistedNode) {
      // presence of hoisted means child must be a stringifiable node
      const result = analyzeNode(child)
      if (result) {
        // node is stringifiable, record state
        nc += result[0]
        ec += result[1]
        currentChunk.push(child as StringifiableNode)
        continue
      }
    }
    // we only reach here if we ran into a node that is not stringifiable
    // check if currently analyzed nodes meet criteria for stringification.
    pushChunk()
    // current node should append to chunks
    chunks.push(child)
    // reset state
    nc = 0
    ec = 0
  }
  // maybe current chunk has children
  pushChunk()
  if (parentIsHoistedNode) {
    (parent as any).codegenNode.hoisted!.children = chunks as TemplateChildNode[]
  } else {
    parent.children = chunks as TemplateChildNode[]
  }
}

const getHoistedNode = (node: TemplateChildNode) =>
  ((node.type === NodeTypes.ELEMENT && node.tagType === ElementTypes.ELEMENT) ||
    node.type == NodeTypes.TEXT_CALL) &&
  node.codegenNode &&
  node.codegenNode.type === NodeTypes.SIMPLE_EXPRESSION &&
  node.codegenNode.hoisted

const dataAriaRE = /^(data|aria)-/
const isStringifiableAttr = (name: string) => {
  return isKnownAttr(name) || dataAriaRE.test(name)
}

const removeHoist = (node: StringifiableNode, context: TransformContext) => {
  const hoistToRemove = (node.codegenNode as SimpleExpressionNode).hoisted!
  context.hoists.splice(context.hoists.indexOf(hoistToRemove), 1)
}

/**
 * for a hoisted node, analyze it and return:
 * - false: bailed (contains runtime constant)
 * - [nc, ec] where
 *   - nc is the number of nodes inside
 *   - ec is the number of element with bindings inside
 */
function analyzeNode(node: TemplateChildNode): [number, number] | false {
  if (node.type === NodeTypes.TEXT_CALL) {
    return [1, 0]
  }
  if (node.type !== NodeTypes.ELEMENT) {
    return false
  }

  let nc = 1 // node count
  let ec = node.props.length > 0 ? 1 : 0 // element w/ binding count
  let bailed = false
  const bail = (): false => {
    bailed = true
    return false
  }

  // TODO: check for cases where using innerHTML will result in different
  // output compared to imperative node insertions.
  // probably only need to check for most common case
  // i.e. non-phrasing-content tags inside `<p>`
  function walk(node: ElementNode): boolean {
    for (let i = 0; i < node.props.length; i++) {
      const p = node.props[i]
      // bail on non-attr bindings
      if (p.type === NodeTypes.ATTRIBUTE && !isStringifiableAttr(p.name)) {
        return bail()
      }
      if (p.type === NodeTypes.DIRECTIVE && p.name === 'bind') {
        // bail on non-attr bindings
        if (
          p.arg &&
          (p.arg.type === NodeTypes.COMPOUND_EXPRESSION ||
            (p.arg.isStatic && !isStringifiableAttr(p.arg.content)))
        ) {
          return bail()
        }
      }
    }
    for (let i = 0; i < node.children.length; i++) {
      nc++
      if (nc >= StringifyThresholds.NODE_COUNT) {
        return true
      }
      const child = node.children[i]
      if (child.type === NodeTypes.ELEMENT) {
        if (child.props.length > 0) {
          ec++
          if (ec >= StringifyThresholds.ELEMENT_WITH_BINDING_COUNT) {
            return true
          }
        }
        walk(child)
        if (bailed) {
          return false
        }
      }
    }
    return true
  }

  return walk(node) ? [nc, ec] : false
}

function stringifyNode(
  node: string | TemplateChildNode,
  context: TransformContext
): string {
  if (isString(node)) {
    return node
  }
  if (isSymbol(node)) {
    return ``
  }
  switch (node.type) {
    case NodeTypes.ELEMENT:
      return stringifyElement(node, context)
    case NodeTypes.TEXT:
      return escapeHtml(node.content)
    case NodeTypes.COMMENT:
      return `<!--${escapeHtml(node.content)}-->`
    case NodeTypes.INTERPOLATION:
      return escapeHtml(toDisplayString(evaluateConstant(node.content)))
    case NodeTypes.COMPOUND_EXPRESSION:
      return escapeHtml(evaluateConstant(node))
    case NodeTypes.TEXT_CALL:
      return stringifyNode(node.content, context)
    default:
      // static trees will not contain if/for nodes
      return ''
  }
}

function stringifyElement(
  node: ElementNode,
  context: TransformContext
): string {
  let res = `<${node.tag}`
  for (let i = 0; i < node.props.length; i++) {
    const p = node.props[i]
    if (p.type === NodeTypes.ATTRIBUTE) {
      res += ` ${p.name}`
      if (p.value) {
        res += `="${escapeHtml(p.value.content)}"`
      }
    } else if (p.type === NodeTypes.DIRECTIVE && p.name === 'bind') {
      // constant v-bind, e.g. :foo="1"
      let evaluated = evaluateConstant(p.exp as SimpleExpressionNode)
      const arg = p.arg && (p.arg as SimpleExpressionNode).content
      if (arg === 'class') {
        evaluated = normalizeClass(evaluated)
      } else if (arg === 'style') {
        evaluated = stringifyStyle(normalizeStyle(evaluated))
      }
      res += ` ${(p.arg as SimpleExpressionNode).content}="${escapeHtml(
        evaluated
      )}"`
    }
  }
  if (context.scopeId) {
    res += ` ${context.scopeId}`
  }
  res += `>`
  for (let i = 0; i < node.children.length; i++) {
    res += stringifyNode(node.children[i], context)
  }
  if (!isVoidTag(node.tag)) {
    res += `</${node.tag}>`
  }
  return res
}

// __UNSAFE__
// Reason: eval.
// It's technically safe to eval because only constant expressions are possible
// here, e.g. `{{ 1 }}` or `{{ 'foo' }}`
// in addition, constant exps bail on presence of parens so you can't even
// run JSFuck in here. But we mark it unsafe for security review purposes.
// (see compiler-core/src/transformExpressions)
function evaluateConstant(exp: ExpressionNode): string {
  if (exp.type === NodeTypes.SIMPLE_EXPRESSION) {
    return new Function(`return ${exp.content}`)()
  } else {
    // compound
    let res = ``
    exp.children.forEach(c => {
      if (isString(c) || isSymbol(c)) {
        return
      }
      if (c.type === NodeTypes.TEXT) {
        res += c.content
      } else if (c.type === NodeTypes.INTERPOLATION) {
        res += toDisplayString(evaluateConstant(c.content))
      } else {
        res += evaluateConstant(c)
      }
    })
    return res
  }
}
