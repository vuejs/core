import {
  parse,
  NodeTypes,
  ElementNode,
  TextNode,
  AttributeNode,
  ParserErrorTypes,
  ExpressionNode,
  ElementTypes
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

    test('HTML entities compatibility in text (https://html.spec.whatwg.org/multipage/parsing.html#named-character-reference-state).', () => {
      const spy = jest.fn()
      const ast = parse('&ampersand;', {
        ...parserOptions,
        namedCharacterReferences: { amp: '&' },
        onError: spy
      })
      const text = ast.children[0] as TextNode

      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: '&ersand;',
        isEmpty: false,
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 11, line: 1, column: 12 },
          source: '&ampersand;'
        }
      })
      expect(spy.mock.calls).toEqual([
        [
          ParserErrorTypes.MISSING_SEMICOLON_AFTER_CHARACTER_REFERENCE,
          { offset: 4, line: 1, column: 5 }
        ]
      ])
    })

    test('HTML entities compatibility in attribute (https://html.spec.whatwg.org/multipage/parsing.html#named-character-reference-state).', () => {
      const spy = jest.fn()
      const ast = parse(
        '<div a="&ampersand;" b="&amp;ersand;" c="&amp!"></div>',
        {
          ...parserOptions,
          namedCharacterReferences: { amp: '&', 'amp;': '&' },
          onError: spy
        }
      )
      const element = ast.children[0] as ElementNode
      const text1 = (element.props[0] as AttributeNode).value
      const text2 = (element.props[1] as AttributeNode).value
      const text3 = (element.props[2] as AttributeNode).value

      expect(text1).toStrictEqual({
        type: NodeTypes.TEXT,
        content: '&ampersand;',
        isEmpty: false,
        loc: {
          start: { offset: 7, line: 1, column: 8 },
          end: { offset: 20, line: 1, column: 21 },
          source: '"&ampersand;"'
        }
      })
      expect(text2).toStrictEqual({
        type: NodeTypes.TEXT,
        content: '&ersand;',
        isEmpty: false,
        loc: {
          start: { offset: 23, line: 1, column: 24 },
          end: { offset: 37, line: 1, column: 38 },
          source: '"&amp;ersand;"'
        }
      })
      expect(text3).toStrictEqual({
        type: NodeTypes.TEXT,
        content: '&!',
        isEmpty: false,
        loc: {
          start: { offset: 40, line: 1, column: 41 },
          end: { offset: 47, line: 1, column: 48 },
          source: '"&amp!"'
        }
      })
      expect(spy.mock.calls).toEqual([
        [
          ParserErrorTypes.MISSING_SEMICOLON_AFTER_CHARACTER_REFERENCE,
          { offset: 45, line: 1, column: 46 }
        ]
      ])
    })
  })

  describe('Interpolation', () => {
    test('HTML entities in interpolation should be translated for backward compatibility.', () => {
      const ast = parse('<div>{{ a &lt; b }}</div>', parserOptions)
      const element = ast.children[0] as ElementNode
      const interpolation = element.children[0] as ExpressionNode

      expect(interpolation).toStrictEqual({
        type: NodeTypes.EXPRESSION,
        content: 'a < b',
        isStatic: false,
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
        }
      })
    })

    test('Strict end tag detection for textarea.', () => {
      const ast = parse(
        '<textarea>hello</textarea</textarea0></texTArea a="<>">',
        {
          ...parserOptions,
          onError: type => {
            if (type !== ParserErrorTypes.END_TAG_WITH_ATTRIBUTES) {
              throw new Error(String(type))
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
