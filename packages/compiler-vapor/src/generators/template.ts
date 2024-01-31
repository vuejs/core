import { type CodeFragment, type CodegenContext, NEWLINE } from '../generate'
import {
  type FragmentFactoryIRNode,
  IRNodeTypes,
  type TemplateFactoryIRNode,
} from '../ir'

export function genTemplate(
  node: TemplateFactoryIRNode | FragmentFactoryIRNode,
  index: number,
  { vaporHelper }: CodegenContext,
): CodeFragment[] {
  if (node.type === IRNodeTypes.TEMPLATE_FACTORY) {
    // TODO source map?
    return [
      NEWLINE,
      `const t${index} = ${vaporHelper('template')}(${JSON.stringify(
        node.template,
      )})`,
    ]
  } else {
    // fragment
    return [NEWLINE, `const t${index} = ${vaporHelper('fragment')}()`]
  }
}
