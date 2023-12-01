import type { CodegenOptions, CodegenResult } from '@vue/compiler-dom'
import {
  type DynamicChildren,
  type RootIRNode,
  IRNodeTypes,
  OperationNode,
  VaporHelper,
} from './ir'

// remove when stable
function checkNever(x: never): void {}

export interface CodegenContext {
  options: CodegenOptions
  helpers: Set<string>
  vaporHelpers: Set<string>
  helper(name: string): string
  vaporHelper(name: string): string
}

function createCodegenContext(ir: RootIRNode, options: CodegenOptions) {
  const { helpers, vaporHelpers } = ir
  return {
    options,
    helpers,
    vaporHelpers,
    helper(name: string) {
      helpers.add(name)
      return `_${name}`
    },
    vaporHelper(name: VaporHelper) {
      vaporHelpers.add(name)
      return `_${name}`
    },
  }
}

// IR -> JS codegen
export function generate(
  ir: RootIRNode,
  options: CodegenOptions = {},
): CodegenResult {
  const ctx = createCodegenContext(ir, options)
  const { vaporHelper, helpers, vaporHelpers } = ctx

  let code = ''
  let preamble = ''

  ir.template.forEach((template, i) => {
    if (template.type === IRNodeTypes.TEMPLATE_FACTORY) {
      preamble += `const t${i} = ${vaporHelper('template')}(${JSON.stringify(
        template.template,
      )})\n`
    } else {
      // fragment
      code += `const t0 = ${vaporHelper('fragment')}()\n`
    }
  })

  {
    code += `const n${ir.dynamic.id} = t0()\n`

    const children = genChildren(ir.dynamic.children)
    if (children) {
      code += `const ${children} = ${vaporHelper('children')}(n${
        ir.dynamic.id
      })\n`
    }

    for (const operation of ir.operation) {
      code += genOperation(operation, ctx)
    }
    for (const [_expr, operations] of Object.entries(ir.effect)) {
      let scope = `${vaporHelper('effect')}(() => {\n`
      for (const operation of operations) {
        scope += genOperation(operation, ctx)
      }
      scope += '})\n'
      code += scope
    }
    // TODO multiple-template
    // TODO return statement in IR
    code += `return n${ir.dynamic.id}\n`
  }

  if (vaporHelpers.size)
    // TODO: extract
    preamble =
      `import { ${[...vaporHelpers]
        .map((h) => `${h} as _${h}`)
        .join(', ')} } from 'vue/vapor'\n` + preamble
  if (helpers.size)
    preamble =
      `import { ${[...helpers]
        .map((h) => `${h} as _${h}`)
        .join(', ')} } from 'vue'\n` + preamble

  const functionName = 'render'
  const isSetupInlined = !!options.inline
  if (isSetupInlined) {
    code = `(() => {\n${code}\n})();`
  } else {
    code = `${preamble}export function ${functionName}(_ctx) {\n${code}\n}`
  }

  return {
    code,
    ast: ir as any,
    preamble,
  }
}

function genOperation(oper: OperationNode, { vaporHelper }: CodegenContext) {
  // TODO: cache old value
  switch (oper.type) {
    case IRNodeTypes.SET_PROP: {
      return `${vaporHelper('setAttr')}(n${oper.element}, ${JSON.stringify(
        oper.name,
      )}, undefined, ${oper.value})\n`
    }

    case IRNodeTypes.SET_TEXT: {
      return `${vaporHelper('setText')}(n${oper.element}, undefined, ${
        oper.value
      })\n`
    }

    case IRNodeTypes.SET_EVENT: {
      let value = oper.value
      if (oper.modifiers.length) {
        value = `${vaporHelper('withModifiers')}(${value}, ${genArrayExpression(
          oper.modifiers,
        )})`
      }
      return `${vaporHelper('on')}(n${oper.element}, ${JSON.stringify(
        oper.name,
      )}, ${value})\n`
    }

    case IRNodeTypes.SET_HTML: {
      return `${vaporHelper('setHtml')}(n${oper.element}, undefined, ${
        oper.value
      })\n`
    }

    case IRNodeTypes.CREATE_TEXT_NODE: {
      return `const n${oper.id} = ${vaporHelper('createTextNode')}(${
        oper.value
      })\n`
    }

    case IRNodeTypes.INSERT_NODE: {
      const elements = ([] as number[]).concat(oper.element)
      let element = elements.map((el) => `n${el}`).join(', ')
      if (elements.length > 1) element = `[${element}]`
      return `${vaporHelper('insert')}(${element}, n${
        oper.parent
      }${`, n${oper.anchor}`})\n`
    }
    case IRNodeTypes.PREPEND_NODE: {
      return `${vaporHelper('prepend')}(n${oper.parent}, ${oper.elements
        .map((el) => `n${el}`)
        .join(', ')})\n`
    }
    case IRNodeTypes.APPEND_NODE: {
      return `${vaporHelper('append')}(n${oper.parent}, ${oper.elements
        .map((el) => `n${el}`)
        .join(', ')})\n`
    }
    default:
      checkNever(oper)
  }
}

function genChildren(children: DynamicChildren) {
  let code = ''
  // TODO
  let offset = 0
  for (const [index, child] of Object.entries(children)) {
    const childrenLength = Object.keys(child.children).length
    if (child.ghost && child.placeholder === null && childrenLength === 0) {
      offset--
      continue
    }

    code += ` ${Number(index) + offset}: [`

    const id = child.ghost ? child.placeholder : child.id
    if (id !== null) code += `n${id}`

    const childrenString = childrenLength && genChildren(child.children)
    if (childrenString) code += `, ${childrenString}`

    code += '],'
  }

  if (!code) return ''
  return `{${code}}`
}

// TODO: other types (not only string)
function genArrayExpression(elements: string[]) {
  return `[${elements.map((it) => `"${it}"`).join(', ')}]`
}
