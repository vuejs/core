import {
  NodeTypes,
  ElementNode,
  locStub,
  Namespaces,
  ElementTypes,
  ElementCodegenNode
} from '../src'
import { CREATE_VNODE } from '../src/runtimeHelpers'
import { isString } from '@vue/shared'

const leadingBracketRE = /^\[/
const bracketsRE = /^\[|\]$/g

// Create a matcher for an object
// where non-static expressions should be wrapped in []
// e.g.
// - createObjectMatcher({ 'foo': '[bar]' }) matches { foo: bar }
// - createObjectMatcher({ '[foo]': 'bar' }) matches { [foo]: "bar" }
export function createObjectMatcher(obj: any) {
  return {
    type: NodeTypes.JS_OBJECT_EXPRESSION,
    properties: Object.keys(obj).map(key => ({
      type: NodeTypes.JS_PROPERTY,
      key: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: key.replace(bracketsRE, ''),
        isStatic: !leadingBracketRE.test(key)
      },
      value: isString(obj[key])
        ? {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: obj[key].replace(bracketsRE, ''),
            isStatic: !leadingBracketRE.test(obj[key])
          }
        : obj[key]
    }))
  }
}

export function createElementWithCodegen(
  args: ElementCodegenNode['arguments']
): ElementNode {
  return {
    type: NodeTypes.ELEMENT,
    loc: locStub,
    ns: Namespaces.HTML,
    tag: 'div',
    tagType: ElementTypes.ELEMENT,
    isSelfClosing: false,
    props: [],
    children: [],
    codegenNode: {
      type: NodeTypes.JS_CALL_EXPRESSION,
      loc: locStub,
      callee: CREATE_VNODE,
      arguments: args
    }
  }
}
