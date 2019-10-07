import {
    parse,
    transform,
    CompilerOptions,
    ElementNode,
    NodeTypes,
  } from '@vue/compiler-core'
import { transformPre } from '../../src/transforms/vPre'
  
  function transformWithStyleTransform(
    template: string,
    options: CompilerOptions = {}
  ) {
    const ast = parse(template)
    transform(ast, {
      nodeTransforms: [transformPre],
      ...options
    })
    return {
      root: ast,
      node: ast.children[0] as ElementNode
    }
  }
  

describe('compiler: pre transform', function () {
    it('should not compile on root node', function () {
        const {node} = transformWithStyleTransform("<div v-pre>{{ a }}</div>");

        expect(node.props).toHaveLength(0);
        expect(node.children).toHaveLength(1);
        expect(node.children[0]).toMatchObject({
            type: NodeTypes.TEXT,
            content: "{{ a }}"
        })
      })

    it('should not compile inner content', function () {
      const {node} = transformWithStyleTransform(`<div>
          <div v-pre>{{ a }}</div>
          <div>{{ a }}</div>
          <div v-pre>
            <component is="div"></component>
          </div>
        </div>`)
      expect(node).toMatchSnapshot();
    })
  })
  