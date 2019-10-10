import {
  parse,
  NodeTypes,
  ElementNode,
  TextNode,
  ErrorCodes,
  ElementTypes,
  InterpolationNode
} from '@vue/compiler-core'
import {
  parserOptionsMinimal as parserOptions,
  DOMNamespaces
} from '../src/parserOptionsMinimal'

describe('DOM parser', () => {
  describe('Text', () => {
    test('textarea handles comments/elements as just text', () => {
      const ast = parse(
        '<textarea>some<div>text</div>and<!--comment--></textarea>',
        parserOptions
      )
      const element = ast.children[0] as ElementNode
      const text = element.children[0] as TextNode

      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'some<div>text</div>and<!--comment-->',
        isEmpty: false,
        loc: {
          start: { offset: 10, line: 1, column: 11 },
          end: { offset: 46, line: 1, column: 47 },
          source: 'some<div>text</div>and<!--comment-->'
        }
      })
    })

    test('textarea handles character references', () => {
      const ast = parse('<textarea>&amp;</textarea>', parserOptions)
      const element = ast.children[0] as ElementNode
      const text = element.children[0] as TextNode

      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: '&',
        isEmpty: false,
        loc: {
          start: { offset: 10, line: 1, column: 11 },
          end: { offset: 15, line: 1, column: 16 },
          source: '&amp;'
        }
      })
    })

    test('style handles comments/elements as just a text', () => {
      const ast = parse(
        '<style>some<div>text</div>and<!--comment--></style>',
        parserOptions
      )
      const element = ast.children[0] as ElementNode
      const text = element.children[0] as TextNode

      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'some<div>text</div>and<!--comment-->',
        isEmpty: false,
        loc: {
          start: { offset: 7, line: 1, column: 8 },
          end: { offset: 43, line: 1, column: 44 },
          source: 'some<div>text</div>and<!--comment-->'
        }
      })
    })

    test("style doesn't handle character references", () => {
      const ast = parse('<style>&amp;</style>', parserOptions)
      const element = ast.children[0] as ElementNode
      const text = element.children[0] as TextNode

      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: '&amp;',
        isEmpty: false,
        loc: {
          start: { offset: 7, line: 1, column: 8 },
          end: { offset: 12, line: 1, column: 13 },
          source: '&amp;'
        }
      })
    })

    test('CDATA', () => {
      const ast = parse('<svg><![CDATA[some text]]></svg>', parserOptions)
      const text = (ast.children[0] as ElementNode).children![0] as TextNode

      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'some text',
        isEmpty: false,
        loc: {
          start: { offset: 14, line: 1, column: 15 },
          end: { offset: 23, line: 1, column: 24 },
          source: 'some text'
        }
      })
    })
  })

  describe('Interpolation', () => {
    test('HTML entities in interpolation should be translated for backward compatibility.', () => {
      const ast = parse('<div>{{ a &lt; b }}</div>', parserOptions)
      const element = ast.children[0] as ElementNode
      const interpolation = element.children[0] as InterpolationNode

      expect(interpolation).toStrictEqual({
        type: NodeTypes.INTERPOLATION,
        content: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `a < b`,
          isStatic: false,
          loc: {
            start: { offset: 8, line: 1, column: 9 },
            end: { offset: 16, line: 1, column: 17 },
            source: 'a &lt; b'
          }
        },
        loc: {
          start: { offset: 5, line: 1, column: 6 },
          end: { offset: 19, line: 1, column: 20 },
          source: '{{ a &lt; b }}'
        }
      })
    })
  })

  describe('Element', () => {
    test('void element', () => {
      const ast = parse('<img>after', parserOptions)
      const element = ast.children[0] as ElementNode

      expect(element).toStrictEqual({
        type: NodeTypes.ELEMENT,
        ns: DOMNamespaces.HTML,
        tag: 'img',
        tagType: ElementTypes.ELEMENT,
        props: [],
        isSelfClosing: false,
        children: [],
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 5, line: 1, column: 6 },
          source: '<img>'
        },
        codegenNode: undefined
      })
    })

    test('Strict end tag detection for textarea.', () => {
      const ast = parse(
        '<textarea>hello</textarea</textarea0></texTArea a="<>">',
        {
          ...parserOptions,
          onError: err => {
            if (err.code !== ErrorCodes.END_TAG_WITH_ATTRIBUTES) {
              throw err
            }
          }
        }
      )
      const element = ast.children[0] as ElementNode
      const text = element.children[0] as TextNode

      expect(ast.children.length).toBe(1)
      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'hello</textarea</textarea0>',
        isEmpty: false,
        loc: {
          start: { offset: 10, line: 1, column: 11 },
          end: { offset: 37, line: 1, column: 38 },
          source: 'hello</textarea</textarea0>'
        }
      })
    })
  })
})
