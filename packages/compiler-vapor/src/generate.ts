import type { CodegenOptions, CodegenResult } from '@vue/compiler-dom'
import { type DynamicChildren, type RootIRNode, IRNodeTypes } from './ir'

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
  if (ir.template.length) {
    preamble += ir.template
      .map(
        (template, i) => `const t${i} = template(\`${template.template}\`)\n`,
      )
      .join('')
    vaporHelpers.add('template')
  }

  // TODO multiple-template
  code += `const root = t0()\n`
  if (ir.children[0]) {
    code += `const {${genChildren(ir.children[0].children)}} = children(root)\n`
    vaporHelpers.add('children')
  }

  for (const opration of ir.opration) {
    switch (opration.type) {
      case IRNodeTypes.TEXT_NODE: {
        // TODO handle by runtime: document.createTextNode
        code += `const n${opration.id} = document.createTextNode(${opration.content})\n`
        break
      }

      case IRNodeTypes.INSERT_NODE:
        {
          let anchor = ''
          if (typeof opration.anchor === 'number') {
            anchor = `, n${opration.anchor}`
          } else if (opration.anchor === 'first') {
            anchor = `, 0 /* InsertPosition.FIRST */`
          }
          code += `insert(n${opration.element}, n${opration.parent}${anchor})\n`
          vaporHelpers.add('insert')
        }
        break
    }
  }

  for (const [expr, effects] of Object.entries(ir.effect)) {
    // TODO don't use watchEffect from vue/core, implement `effect` function in runtime-vapor package
    let scope = `watchEffect(() => {\n`
    helpers.add('watchEffect')
    for (const effect of effects) {
      switch (effect.type) {
        case IRNodeTypes.SET_PROP: {
          scope += `setAttr(n${effect.element}, ${JSON.stringify(
            effect.name,
          )}, undefined, ${expr})\n`
          vaporHelpers.add('setAttr')
          break
        }
        case IRNodeTypes.SET_TEXT: {
          scope += `setText(n${effect.element}, undefined, ${expr})\n`
          vaporHelpers.add('setText')
          break
        }
        case IRNodeTypes.SET_EVENT: {
          scope += `on(n${effect.element}, ${JSON.stringify(
            effect.name,
          )}, ${expr})\n`
          vaporHelpers.add('on')
          break
        }
        case IRNodeTypes.SET_HTML: {
          scope += `setHtml(n${effect.element}, undefined, ${expr})\n`
          vaporHelpers.add('setHtml')
          break
        }
        default:
          checkNever(effect)
      }
    }
    scope += '})\n'
    code += scope
  }

  code += 'return root'

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
