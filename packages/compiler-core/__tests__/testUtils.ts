import {
  NodeTypes,
  ElementNode,
  locStub,
  Namespaces,
  ElementTypes,
  VNodeCall
} from '../src'
import { isString, PatchFlags, PatchFlagNames, isArray } from '@vue/shared'

const leadingBracketRE = /^\[/
const bracketsRE = /^\[|\]$/g

// Create a matcher for an object
// where non-static expressions should be wrapped in []
// e.g.
// - createObjectMatcher({ 'foo': '[bar]' }) matches { foo: bar }
// - createObjectMatcher({ '[foo]': 'bar' }) matches { [foo]: "bar" }
export function createObjectMatcher(obj: Record<string, any>) {
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
  tag: VNodeCall['tag'],
  props?: VNodeCall['props'],
  children?: VNodeCall['children'],
  patchFlag?: VNodeCall['patchFlag'],
  dynamicProps?: VNodeCall['dynamicProps']
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
      type: NodeTypes.VNODE_CALL,
      tag,
      props,
      children,
      patchFlag,
      dynamicProps,
      directives: undefined,
      isBlock: false,
      disableTracking: false,
      loc: locStub
    }
  }
}

export function genFlagText(flag: PatchFlags | PatchFlags[]) {
  if (isArray(flag)) {
    let f = 0
    flag.forEach(ff => {
      f |= ff
    })
    return `${f} /* ${flag.map(f => PatchFlagNames[f]).join(', ')} */`
  } else {
    return `${flag} /* ${PatchFlagNames[flag]} */`
  }
}
