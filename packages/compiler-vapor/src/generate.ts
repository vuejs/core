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
    code += `const n${ir.children.id} = t0()\n`
    if (Object.keys(ir.children.children).length) {
      code += `const {${genChildren(ir.children.children)}} = children(n${
        ir.children.id
      })\n`
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
    code += `return n${ir.children.id}\n`
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

  function genOperation(operation: OperationNode) {
    let code = ''

    // TODO: cache old value
    switch (operation.type) {
      case IRNodeTypes.SET_PROP: {
        code = `setAttr(n${operation.element}, ${JSON.stringify(
          operation.name,
        )}, undefined, ${operation.value})\n`
        vaporHelpers.add('setAttr')
        break
      }

      case IRNodeTypes.SET_TEXT: {
        code = `setText(n${operation.element}, undefined, ${operation.value})\n`
        vaporHelpers.add('setText')
        break
      }

      case IRNodeTypes.SET_EVENT: {
        code = `on(n${operation.element}, ${JSON.stringify(operation.name)}, ${
          operation.value
        })\n`
        vaporHelpers.add('on')
        break
      }

      case IRNodeTypes.SET_HTML: {
        code = `setHtml(n${operation.element}, undefined, ${operation.value})\n`
        vaporHelpers.add('setHtml')
        break
      }

      case IRNodeTypes.CREATE_TEXT_NODE: {
        code = `const n${operation.id} = createTextNode(${operation.value})\n`
        vaporHelpers.add('createTextNode')
        break
      }

      case IRNodeTypes.INSERT_NODE: {
        let anchor = ''
        if (typeof operation.anchor === 'number') {
          anchor = `, n${operation.anchor}`
        } else if (operation.anchor === 'first') {
          anchor = `, 0 /* InsertPosition.FIRST */`
        }
        code = `insert(n${operation.element}, n${operation.parent}${anchor})\n`
        vaporHelpers.add('insert')
        break
      }

      default:
        checkNever(operation)
    }

    return code
  }
}

function genChildren(children: DynamicChildren) {
  let str = ''
  for (const [index, child] of Object.entries(children)) {
    str += ` ${index}: [`
    if (child.store) {
      str += `n${child.id}`
    }
    if (Object.keys(child.children).length) {
      str += `, {${genChildren(child.children)}}`
    }
    str += '],'
  }
  return str
}
