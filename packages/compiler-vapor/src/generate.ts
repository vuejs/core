import type { CodegenOptions, CodegenResult } from '@vue/compiler-dom'
import {
  type DynamicChildren,
  type RootIRNode,
  IRNodeTypes,
  OperationNode,
} from './ir'

// remove when stable
function checkNever(x: never): void {}

// IR -> JS codegen
export function generate(
  ir: RootIRNode,
  options: CodegenOptions = {},
): CodegenResult {
  let code = ''
  let preamble = ''

  const { helpers, vaporHelpers } = ir

  ir.template.forEach((template, i) => {
    if (template.type === IRNodeTypes.TEMPLATE_FACTORY) {
      preamble += `const t${i} = template(${JSON.stringify(
        template.template,
      )})\n`
      vaporHelpers.add('template')
    } else {
      // fragment
      code += `const t0 = fragment()\n`
      vaporHelpers.add('fragment')
    }
  })

  {
    code += `const n${ir.dynamic.id} = t0()\n`

    const children = genChildren(ir.dynamic.children)
    if (children) {
      code += `const ${children} = children(n${ir.dynamic.id})\n`
      vaporHelpers.add('children')
    }

    for (const operation of ir.operation) {
      code += genOperation(operation)
    }
    for (const [_expr, operations] of Object.entries(ir.effect)) {
      // TODO don't use watchEffect from vue/core, implement `effect` function in runtime-vapor package
      let scope = `watchEffect(() => {\n`
      helpers.add('watchEffect')
      for (const operation of operations) {
        scope += genOperation(operation)
      }
      scope += '})\n'
      code += scope
    }
    // TODO multiple-template
    // TODO return statement in IR
    code += `return n${ir.dynamic.id}\n`
  }

  if (vaporHelpers.size)
    preamble =
      `import { ${[...vaporHelpers].join(', ')} } from 'vue/vapor'\n` + preamble
  if (helpers.size)
    preamble = `import { ${[...helpers].join(', ')} } from 'vue'\n` + preamble

  const functionName = options.ssr ? `ssrRender` : `render`
  const isSetupInlined = !!options.inline
  if (isSetupInlined) {
    code = `(() => {\n${code}\n})();`
  } else {
    code = `${preamble}export function ${functionName}() {\n${code}\n}`
  }

  return {
    code,
    ast: ir as any,
    preamble,
  }

  function genOperation(oper: OperationNode) {
    let code = ''

    // TODO: cache old value
    switch (oper.type) {
      case IRNodeTypes.SET_PROP: {
        code = `setAttr(n${oper.element}, ${JSON.stringify(
          oper.name,
        )}, undefined, ${oper.value})\n`
        vaporHelpers.add('setAttr')
        break
      }

      case IRNodeTypes.SET_TEXT: {
        code = `setText(n${oper.element}, undefined, ${oper.value})\n`
        vaporHelpers.add('setText')
        break
      }

      case IRNodeTypes.SET_EVENT: {
        code = `on(n${oper.element}, ${JSON.stringify(oper.name)}, ${
          oper.value
        })\n`
        vaporHelpers.add('on')
        break
      }

      case IRNodeTypes.SET_HTML: {
        code = `setHtml(n${oper.element}, undefined, ${oper.value})\n`
        vaporHelpers.add('setHtml')
        break
      }

      case IRNodeTypes.CREATE_TEXT_NODE: {
        code = `const n${oper.id} = createTextNode(${oper.value})\n`
        vaporHelpers.add('createTextNode')
        break
      }

      case IRNodeTypes.INSERT_NODE: {
        const elements = ([] as number[]).concat(oper.element)
        let element = elements.map((el) => `n${el}`).join(', ')
        if (elements.length > 1) element = `[${element}]`
        code = `insert(${element}, n${oper.parent}${`, n${oper.anchor}`})\n`
        vaporHelpers.add('insert')
        break
      }
      case IRNodeTypes.PREPEND_NODE: {
        code = `prepend(n${oper.parent}, ${oper.elements
          .map((el) => `n${el}`)
          .join(', ')})\n`
        vaporHelpers.add('prepend')
        break
      }
      case IRNodeTypes.APPEND_NODE: {
        code = `append(n${oper.parent}, ${oper.elements
          .map((el) => `n${el}`)
          .join(', ')})\n`
        vaporHelpers.add('append')
        break
      }
      default:
        checkNever(oper)
    }

    return code
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
