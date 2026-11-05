import {
  type ElementNode,
  ElementTypes,
  NodeTypes,
  type Property,
  type SimpleExpressionNode,
  type VNodeCall,
  locStub,
} from '../src'
import {
  Namespaces,
  PatchFlagNames,
  type PatchFlags,
  type ShapeFlags,
  isArray,
  isString,
} from '@vue/shared'
import { decodeMappings } from 'muggle-string'

export interface Mapping {
  generatedLine: number
  generatedColumn: number
  source: string | null
  originalLine: number | null
  originalColumn: number | null
  name: string | null
}

// the mappings of a source map in generated order, lines from 1, columns from 0
export function decodeSourceMap(map: {
  mappings: string
  sources: string[]
  names: string[]
}): Mapping[] {
  return decodeMappings(map.mappings).flatMap((segments, line) =>
    segments.map(([column, source, originalLine, originalColumn, name]) => ({
      generatedLine: line + 1,
      generatedColumn: column,
      source: source === undefined ? null : map.sources[source],
      originalLine: originalLine === undefined ? null : originalLine + 1,
      originalColumn: originalColumn === undefined ? null : originalColumn,
      name: name === undefined ? null : map.names[name],
    })),
  )
}

// the original position of the mapping that starts last at or before
// `position` on its line
export function originalPositionFor(
  mappings: Mapping[],
  { line, column }: { line: number; column: number },
): Pick<Mapping, 'source' | 'name'> & {
  line: number | null
  column: number | null
} {
  let found: Mapping | undefined
  for (const mapping of mappings) {
    if (
      mapping.generatedLine === line &&
      mapping.generatedColumn <= column &&
      (!found || mapping.generatedColumn > found.generatedColumn)
    ) {
      found = mapping
    }
  }
  return {
    source: found ? found.source : null,
    line: found ? found.originalLine : null,
    column: found ? found.originalColumn : null,
    name: found ? found.name : null,
  }
}

const leadingBracketRE = /^\[/
const bracketsRE = /^\[|\]$/g

// Create a matcher for an object
// where non-static expressions should be wrapped in []
// e.g.
// - createObjectMatcher({ 'foo': '[bar]' }) matches { foo: bar }
// - createObjectMatcher({ '[foo]': 'bar' }) matches { [foo]: "bar" }
export function createObjectMatcher(obj: Record<string, any>): {
  type: NodeTypes
  properties: Partial<Property>[]
} {
  return {
    type: NodeTypes.JS_OBJECT_EXPRESSION,
    properties: Object.keys(obj).map(key => ({
      type: NodeTypes.JS_PROPERTY,
      key: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: key.replace(bracketsRE, ''),
        isStatic: !leadingBracketRE.test(key),
      } as SimpleExpressionNode,
      value: isString(obj[key])
        ? {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: obj[key].replace(bracketsRE, ''),
            isStatic: !leadingBracketRE.test(obj[key]),
          }
        : obj[key],
    })),
  }
}

export function createElementWithCodegen(
  tag: VNodeCall['tag'],
  props?: VNodeCall['props'],
  children?: VNodeCall['children'],
  patchFlag?: VNodeCall['patchFlag'],
  dynamicProps?: VNodeCall['dynamicProps'],
): ElementNode {
  return {
    type: NodeTypes.ELEMENT,
    loc: locStub,
    ns: Namespaces.HTML,
    tag: 'div',
    tagType: ElementTypes.ELEMENT,
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
      isComponent: false,
      loc: locStub,
    },
  }
}

type Flags = PatchFlags | ShapeFlags
export function genFlagText(
  flag: Flags | Flags[],
  names: { [k: number]: string } = PatchFlagNames,
): string {
  if (isArray(flag)) {
    let f = 0
    flag.forEach(ff => {
      f |= ff
    })
    return `${f} /* ${flag.map(f => names[f]).join(', ')} */`
  } else {
    return `${flag} /* ${names[flag]} */`
  }
}
