import type { CodeFragment, CodegenContext } from '../generate'
import {
  type FragmentFactoryIRNode,
  IRNodeTypes,
  type TemplateFactoryIRNode,
} from '../ir'

export function genTemplate(
  node: TemplateFactoryIRNode | FragmentFactoryIRNode,
  index: number,
  { newline, vaporHelper }: CodegenContext,
): CodeFragment[] {
  if (node.type === IRNodeTypes.TEMPLATE_FACTORY) {
    // TODO source map?
    return [
      newline(),
      `const t${index} = ${vaporHelper('template')}(${JSON.stringify(
        node.template,
      )})`,
    ]
  } else {
    // fragment
    return [newline(), `const t${index} = ${vaporHelper('fragment')}()`]
  }
}
