import { RESOLVE_FILTER } from '../runtimeHelpers'
import {
  type AttributeNode,
  type DirectiveNode,
  type ExpressionNode,
  NodeTypes,
  type SimpleExpressionNode,
} from '../ast'
import {
  CompilerDeprecationTypes,
  isCompatEnabled,
  warnDeprecation,
} from './compatConfig'
import type { NodeTransform, TransformContext } from '../transform'
import { toValidAssetId } from '../utils'

const validDivisionCharRE = /[\w).+\-_$\]]/

export const transformFilter: NodeTransform = (node, context) => {
  if (!isCompatEnabled(CompilerDeprecationTypes.COMPILER_FILTERS, context)) {
    return
  }

  if (node.type === NodeTypes.INTERPOLATION) {
    // filter rewrite is applied before expression transform so only
    // simple expressions are possible at this stage
    rewriteFilter(node.content, context)
  } else if (node.type === NodeTypes.ELEMENT) {
    node.props.forEach((prop: AttributeNode | DirectiveNode) => {
      if (
        prop.type === NodeTypes.DIRECTIVE &&
        prop.name !== 'for' &&
        prop.exp
      ) {
        rewriteFilter(prop.exp, context)
      }
    })
  }
}

function rewriteFilter(node: ExpressionNode, context: TransformContext) {
  if (node.type === NodeTypes.SIMPLE_EXPRESSION) {
    parseFilter(node, context)
  } else {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]
      if (typeof child !== 'object') continue
      if (child.type === NodeTypes.SIMPLE_EXPRESSION) {
        parseFilter(child, context)
      } else if (child.type === NodeTypes.COMPOUND_EXPRESSION) {
        rewriteFilter(node, context)
      } else if (child.type === NodeTypes.INTERPOLATION) {
        rewriteFilter(child.content, context)
      }
    }
  }
}

function parseFilter(node: SimpleExpressionNode, context: TransformContext) {
  const exp = node.content
  let inSingle = false
  let inDouble = false
  let inTemplateString = false
  let inRegex = false
  let curly = 0
  let square = 0
  let paren = 0
  let lastFilterIndex = 0
  let c,
    prev,
    i: number,
    expression,
    filters: string[] = []

  for (i = 0; i < exp.length; i++) {
    prev = c
    c = exp.charCodeAt(i)
    if (inSingle) {
      if (c === 0x27 && prev !== 0x5c) inSingle = false
    } else if (inDouble) {
      if (c === 0x22 && prev !== 0x5c) inDouble = false
    } else if (inTemplateString) {
      if (c === 0x60 && prev !== 0x5c) inTemplateString = false
    } else if (inRegex) {
      if (c === 0x2f && prev !== 0x5c) inRegex = false
    } else if (
      c === 0x7c && // pipe
      exp.charCodeAt(i + 1) !== 0x7c &&
      exp.charCodeAt(i - 1) !== 0x7c &&
      !curly &&
      !square &&
      !paren
    ) {
      if (expression === undefined) {
        // first filter, end of expression
        lastFilterIndex = i + 1
        expression = exp.slice(0, i).trim()
      } else {
        pushFilter()
      }
    } else {
      switch (c) {
        case 0x22:
          inDouble = true
          break // "
        case 0x27:
          inSingle = true
          break // '
        case 0x60:
          inTemplateString = true
          break // `
        case 0x28:
          paren++
          break // (
        case 0x29:
          paren--
          break // )
        case 0x5b:
          square++
          break // [
        case 0x5d:
          square--
          break // ]
        case 0x7b:
          curly++
          break // {
        case 0x7d:
          curly--
          break // }
      }
      if (c === 0x2f) {
        // /
        let j = i - 1
        let p
        // find first non-whitespace prev char
        for (; j >= 0; j--) {
          p = exp.charAt(j)
          if (p !== ' ') break
        }
        if (!p || !validDivisionCharRE.test(p)) {
          inRegex = true
        }
      }
    }
  }

  if (expression === undefined) {
    expression = exp.slice(0, i).trim()
  } else if (lastFilterIndex !== 0) {
    pushFilter()
  }

  function pushFilter() {
    filters.push(exp.slice(lastFilterIndex, i).trim())
    lastFilterIndex = i + 1
  }

  if (filters.length) {
    __DEV__ &&
      warnDeprecation(
        CompilerDeprecationTypes.COMPILER_FILTERS,
        context,
        node.loc,
      )
    for (i = 0; i < filters.length; i++) {
      expression = wrapFilter(expression, filters[i], context)
    }
    node.content = expression
    // reset ast since the content is replaced
    node.ast = undefined
  }
}

function wrapFilter(
  exp: string,
  filter: string,
  context: TransformContext,
): string {
  context.helper(RESOLVE_FILTER)
  const i = filter.indexOf('(')
  if (i < 0) {
    context.filters!.add(filter)
    return `${toValidAssetId(filter, 'filter')}(${exp})`
  } else {
    const name = filter.slice(0, i)
    const args = filter.slice(i + 1)
    context.filters!.add(name)
    return `${toValidAssetId(name, 'filter')}(${exp}${
      args !== ')' ? ',' + args : args
    }`
  }
}
