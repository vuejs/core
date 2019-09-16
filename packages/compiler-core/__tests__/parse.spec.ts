import { parse, ParserOptions } from '../src/parser'
import {
  AttributeNode,
  CommentNode,
  DirectiveNode,
  ElementNode,
  ElementTypes,
  ExpressionNode,
  Namespaces,
  NodeTypes,
  Position,
  TextNode
} from '../src/ast'
import { ParserErrorTypes } from '../src/errorTypes'
import { parserOptionsMinimal as parserOptions } from '../src/parserOptionsMinimal'

describe('parser/parse', () => {
  describe('Text', () => {
    test('simple text', () => {
      const ast = parse('some text', parserOptions)
      const text = ast.children[0] as TextNode

      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'some text',
        isEmpty: false,
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 9, line: 1, column: 10 },
          source: 'some text'
        }
      })
    })

    test('simple text with invalid end tag', () => {
      const ast = parse('some text</div>', {
        ...parserOptions,
        onError: () => {}
      })
      const text = ast.children[0] as TextNode

      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'some text',
        isEmpty: false,
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 9, line: 1, column: 10 },
          source: 'some text'
        }
      })
    })

    test('text with interpolation', () => {
      const ast = parse('some {{ foo + bar }} text', parserOptions)
      const text1 = ast.children[0] as TextNode
      const text2 = ast.children[2] as TextNode

      expect(text1).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'some ',
        isEmpty: false,
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 5, line: 1, column: 6 },
          source: 'some '
        }
      })
      expect(text2).toStrictEqual({
        type: NodeTypes.TEXT,
        content: ' text',
        isEmpty: false,
        loc: {
          start: { offset: 20, line: 1, column: 21 },
          end: { offset: 25, line: 1, column: 26 },
          source: ' text'
        }
      })
    })

    test('text with interpolation which has `<`', () => {
      const ast = parse('some {{ a<b && c>d }} text', parserOptions)
      const text1 = ast.children[0] as TextNode
      const text2 = ast.children[2] as TextNode

      expect(text1).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'some ',
        isEmpty: false,
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 5, line: 1, column: 6 },
          source: 'some '
        }
      })
      expect(text2).toStrictEqual({
        type: NodeTypes.TEXT,
        content: ' text',
        isEmpty: false,
        loc: {
          start: { offset: 21, line: 1, column: 22 },
          end: { offset: 26, line: 1, column: 27 },
          source: ' text'
        }
      })
    })

    test('text with mix of tags and interpolations', () => {
      const ast = parse(
        'some <span>{{ foo < bar + foo }} text</span>',
        parserOptions
      )
      const text1 = ast.children[0] as TextNode
      const text2 = (ast.children[1] as ElementNode).children![1] as TextNode

      expect(text1).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'some ',
        isEmpty: false,
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 5, line: 1, column: 6 },
          source: 'some '
        }
      })
      expect(text2).toStrictEqual({
        type: NodeTypes.TEXT,
        content: ' text',
        isEmpty: false,
        loc: {
          start: { offset: 32, line: 1, column: 33 },
          end: { offset: 37, line: 1, column: 38 },
          source: ' text'
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

    test('lonly "<" don\'t separate nodes', () => {
      const ast = parse('a < b', {
        ...parserOptions,
        onError: errorCode => {
          if (
            errorCode !== ParserErrorTypes.INVALID_FIRST_CHARACTER_OF_TAG_NAME
          ) {
            throw new Error(`${errorCode}`)
          }
        }
      })
      const text = ast.children[0] as TextNode

      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'a < b',
        isEmpty: false,
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 5, line: 1, column: 6 },
          source: 'a < b'
        }
      })
    })

    test('lonly "{{" don\'t separate nodes', () => {
      const ast = parse('a {{ b', {
        ...parserOptions,
        onError: errorCode => {
          if (errorCode !== ParserErrorTypes.X_MISSING_INTERPOLATION_END) {
            throw new Error(`${errorCode}`)
          }
        }
      })
      const text = ast.children[0] as TextNode

      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'a {{ b',
        isEmpty: false,
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 6, line: 1, column: 7 },
          source: 'a {{ b'
        }
      })
    })

    test('textarea handles comments/elements as just a text', () => {
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

    test('Some control character reference should be replaced.', () => {
      const spy = jest.fn()
      const ast = parse('&#x86;', { ...parserOptions, onError: spy })
      const text = ast.children[0] as TextNode

      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: '†',
        isEmpty: false,
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 6, line: 1, column: 7 },
          source: '&#x86;'
        }
      })
      expect(spy.mock.calls).toEqual([
        [
          ParserErrorTypes.CONTROL_CHARACTER_REFERENCE,
          { offset: 0, line: 1, column: 1 }
        ]
      ])
    })
  })

  describe('Interpolation', () => {
    test('simple interpolation', () => {
      const ast = parse('{{message}}', parserOptions)
      const interpolation = ast.children[0] as ExpressionNode

      expect(interpolation).toStrictEqual({
        type: NodeTypes.EXPRESSION,
        content: 'message',
        isStatic: false,
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 11, line: 1, column: 12 },
          source: '{{message}}'
        }
      })
    })

    test('it can have tag-like notation', () => {
      const ast = parse('{{ a<b }}', parserOptions)
      const interpolation = ast.children[0] as ExpressionNode

      expect(interpolation).toStrictEqual({
        type: NodeTypes.EXPRESSION,
        content: 'a<b',
        isStatic: false,
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 9, line: 1, column: 10 },
          source: '{{ a<b }}'
        }
      })
    })

    test('it can have tag-like notation (2)', () => {
      const ast = parse('{{ a<b }}{{ c>d }}', parserOptions)
      const interpolation1 = ast.children[0] as ExpressionNode
      const interpolation2 = ast.children[1] as ExpressionNode

      expect(interpolation1).toStrictEqual({
        type: NodeTypes.EXPRESSION,
        content: 'a<b',
        isStatic: false,
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 9, line: 1, column: 10 },
          source: '{{ a<b }}'
        }
      })
      expect(interpolation2).toStrictEqual({
        type: NodeTypes.EXPRESSION,
        content: 'c>d',
        isStatic: false,
        loc: {
          start: { offset: 9, line: 1, column: 10 },
          end: { offset: 18, line: 1, column: 19 },
          source: '{{ c>d }}'
        }
      })
    })

    test('it can have tag-like notation (3)', () => {
      const ast = parse('<div>{{ "</div>" }}</div>', parserOptions)
      const element = ast.children[0] as ElementNode
      const interpolation = element.children[0] as ExpressionNode

      expect(interpolation).toStrictEqual({
        type: NodeTypes.EXPRESSION,
        content: '"</div>"',
        isStatic: false,
        loc: {
          start: { offset: 5, line: 1, column: 6 },
          end: { offset: 19, line: 1, column: 20 },
          source: '{{ "</div>" }}'
        }
      })
    })

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

  describe('Comment', () => {
    test('empty comment', () => {
      const ast = parse('<!---->', parserOptions)
      const comment = ast.children[0] as CommentNode

      expect(comment).toStrictEqual({
        type: NodeTypes.COMMENT,
        content: '',
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 7, line: 1, column: 8 },
          source: '<!---->'
        }
      })
    })

    test('simple comment', () => {
      const ast = parse('<!--abc-->', parserOptions)
      const comment = ast.children[0] as CommentNode

      expect(comment).toStrictEqual({
        type: NodeTypes.COMMENT,
        content: 'abc',
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 10, line: 1, column: 11 },
          source: '<!--abc-->'
        }
      })
    })

    test('two comments', () => {
      const ast = parse('<!--abc--><!--def-->', parserOptions)
      const comment1 = ast.children[0] as CommentNode
      const comment2 = ast.children[1] as CommentNode

      expect(comment1).toStrictEqual({
        type: NodeTypes.COMMENT,
        content: 'abc',
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 10, line: 1, column: 11 },
          source: '<!--abc-->'
        }
      })
      expect(comment2).toStrictEqual({
        type: NodeTypes.COMMENT,
        content: 'def',
        loc: {
          start: { offset: 10, line: 1, column: 11 },
          end: { offset: 20, line: 1, column: 21 },
          source: '<!--def-->'
        }
      })
    })
  })

  describe('Element', () => {
    test('simple div', () => {
      const ast = parse('<div>hello</div>', parserOptions)
      const element = ast.children[0] as ElementNode

      expect(element).toStrictEqual({
        type: NodeTypes.ELEMENT,
        ns: Namespaces.HTML,
        tag: 'div',
        tagType: ElementTypes.ELEMENT,
        props: [],
        isSelfClosing: false,
        children: [
          {
            type: NodeTypes.TEXT,
            content: 'hello',
            isEmpty: false,
            loc: {
              start: { offset: 5, line: 1, column: 6 },
              end: { offset: 10, line: 1, column: 11 },
              source: 'hello'
            }
          }
        ],
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 16, line: 1, column: 17 },
          source: '<div>hello</div>'
        }
      })
    })

    test('empty', () => {
      const ast = parse('<div></div>', parserOptions)
      const element = ast.children[0] as ElementNode

      expect(element).toStrictEqual({
        type: NodeTypes.ELEMENT,
        ns: Namespaces.HTML,
        tag: 'div',
        tagType: ElementTypes.ELEMENT,
        props: [],
        isSelfClosing: false,
        children: [],
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 11, line: 1, column: 12 },
          source: '<div></div>'
        }
      })
    })

    test('self closing', () => {
      const ast = parse('<div/>after', parserOptions)
      const element = ast.children[0] as ElementNode

      expect(element).toStrictEqual({
        type: NodeTypes.ELEMENT,
        ns: Namespaces.HTML,
        tag: 'div',
        tagType: ElementTypes.ELEMENT,
        props: [],
        isSelfClosing: true,
        children: [],
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 6, line: 1, column: 7 },
          source: '<div/>'
        }
      })
    })

    test('void element', () => {
      const ast = parse('<img>after', parserOptions)
      const element = ast.children[0] as ElementNode

      expect(element).toStrictEqual({
        type: NodeTypes.ELEMENT,
        ns: Namespaces.HTML,
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

    test('attribute with no value', () => {
      const ast = parse('<div id></div>', parserOptions)
      const element = ast.children[0] as ElementNode

      expect(element).toStrictEqual({
        type: NodeTypes.ELEMENT,
        ns: Namespaces.HTML,
        tag: 'div',
        tagType: ElementTypes.ELEMENT,
        props: [
          {
            type: NodeTypes.ATTRIBUTE,
            name: 'id',
            value: undefined,
            loc: {
              start: { offset: 5, line: 1, column: 6 },
              end: { offset: 7, line: 1, column: 8 },
              source: 'id'
            }
          }
        ],
        isSelfClosing: false,
        children: [],
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 14, line: 1, column: 15 },
          source: '<div id></div>'
        }
      })
    })

    test('attribute with empty value, double quote', () => {
      const ast = parse('<div id=""></div>', parserOptions)
      const element = ast.children[0] as ElementNode

      expect(element).toStrictEqual({
        type: NodeTypes.ELEMENT,
        ns: Namespaces.HTML,
        tag: 'div',
        tagType: ElementTypes.ELEMENT,
        props: [
          {
            type: NodeTypes.ATTRIBUTE,
            name: 'id',
            value: {
              type: NodeTypes.TEXT,
              content: '',
              isEmpty: true,
              loc: {
                start: { offset: 8, line: 1, column: 9 },
                end: { offset: 10, line: 1, column: 11 },
                source: '""'
              }
            },
            loc: {
              start: { offset: 5, line: 1, column: 6 },
              end: { offset: 10, line: 1, column: 11 },
              source: 'id=""'
            }
          }
        ],
        isSelfClosing: false,
        children: [],
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 17, line: 1, column: 18 },
          source: '<div id=""></div>'
        }
      })
    })

    test('attribute with empty value, single quote', () => {
      const ast = parse("<div id=''></div>", parserOptions)
      const element = ast.children[0] as ElementNode

      expect(element).toStrictEqual({
        type: NodeTypes.ELEMENT,
        ns: Namespaces.HTML,
        tag: 'div',
        tagType: ElementTypes.ELEMENT,
        props: [
          {
            type: NodeTypes.ATTRIBUTE,
            name: 'id',
            value: {
              type: NodeTypes.TEXT,
              content: '',
              isEmpty: true,
              loc: {
                start: { offset: 8, line: 1, column: 9 },
                end: { offset: 10, line: 1, column: 11 },
                source: "''"
              }
            },
            loc: {
              start: { offset: 5, line: 1, column: 6 },
              end: { offset: 10, line: 1, column: 11 },
              source: "id=''"
            }
          }
        ],
        isSelfClosing: false,
        children: [],
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 17, line: 1, column: 18 },
          source: "<div id=''></div>"
        }
      })
    })

    test('attribute with value, double quote', () => {
      const ast = parse('<div id=">\'"></div>', parserOptions)
      const element = ast.children[0] as ElementNode

      expect(element).toStrictEqual({
        type: NodeTypes.ELEMENT,
        ns: Namespaces.HTML,
        tag: 'div',
        tagType: ElementTypes.ELEMENT,
        props: [
          {
            type: NodeTypes.ATTRIBUTE,
            name: 'id',
            value: {
              type: NodeTypes.TEXT,
              content: ">'",
              isEmpty: false,
              loc: {
                start: { offset: 8, line: 1, column: 9 },
                end: { offset: 12, line: 1, column: 13 },
                source: '">\'"'
              }
            },
            loc: {
              start: { offset: 5, line: 1, column: 6 },
              end: { offset: 12, line: 1, column: 13 },
              source: 'id=">\'"'
            }
          }
        ],
        isSelfClosing: false,
        children: [],
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 19, line: 1, column: 20 },
          source: '<div id=">\'"></div>'
        }
      })
    })

    test('attribute with value, single quote', () => {
      const ast = parse("<div id='>\"'></div>", parserOptions)
      const element = ast.children[0] as ElementNode

      expect(element).toStrictEqual({
        type: NodeTypes.ELEMENT,
        ns: Namespaces.HTML,
        tag: 'div',
        tagType: ElementTypes.ELEMENT,
        props: [
          {
            type: NodeTypes.ATTRIBUTE,
            name: 'id',
            value: {
              type: NodeTypes.TEXT,
              content: '>"',
              isEmpty: false,
              loc: {
                start: { offset: 8, line: 1, column: 9 },
                end: { offset: 12, line: 1, column: 13 },
                source: "'>\"'"
              }
            },
            loc: {
              start: { offset: 5, line: 1, column: 6 },
              end: { offset: 12, line: 1, column: 13 },
              source: "id='>\"'"
            }
          }
        ],
        isSelfClosing: false,
        children: [],
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 19, line: 1, column: 20 },
          source: "<div id='>\"'></div>"
        }
      })
    })

    test('attribute with value, unquoted', () => {
      const ast = parse('<div id=a/></div>', parserOptions)
      const element = ast.children[0] as ElementNode

      expect(element).toStrictEqual({
        type: NodeTypes.ELEMENT,
        ns: Namespaces.HTML,
        tag: 'div',
        tagType: ElementTypes.ELEMENT,
        props: [
          {
            type: NodeTypes.ATTRIBUTE,
            name: 'id',
            value: {
              type: NodeTypes.TEXT,
              content: 'a/',
              isEmpty: false,
              loc: {
                start: { offset: 8, line: 1, column: 9 },
                end: { offset: 10, line: 1, column: 11 },
                source: 'a/'
              }
            },
            loc: {
              start: { offset: 5, line: 1, column: 6 },
              end: { offset: 10, line: 1, column: 11 },
              source: 'id=a/'
            }
          }
        ],
        isSelfClosing: false,
        children: [],
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 17, line: 1, column: 18 },
          source: '<div id=a/></div>'
        }
      })
    })

    test('multiple attributes', () => {
      const ast = parse(
        '<div id=a class="c" inert style=\'\'></div>',
        parserOptions
      )
      const element = ast.children[0] as ElementNode

      expect(element).toStrictEqual({
        type: NodeTypes.ELEMENT,
        ns: Namespaces.HTML,
        tag: 'div',
        tagType: ElementTypes.ELEMENT,
        props: [
          {
            type: NodeTypes.ATTRIBUTE,
            name: 'id',
            value: {
              type: NodeTypes.TEXT,
              content: 'a',
              isEmpty: false,
              loc: {
                start: { offset: 8, line: 1, column: 9 },
                end: { offset: 9, line: 1, column: 10 },
                source: 'a'
              }
            },
            loc: {
              start: { offset: 5, line: 1, column: 6 },
              end: { offset: 9, line: 1, column: 10 },
              source: 'id=a'
            }
          },
          {
            type: NodeTypes.ATTRIBUTE,
            name: 'class',
            value: {
              type: NodeTypes.TEXT,
              content: 'c',
              isEmpty: false,
              loc: {
                start: { offset: 16, line: 1, column: 17 },
                end: { offset: 19, line: 1, column: 20 },
                source: '"c"'
              }
            },
            loc: {
              start: { offset: 10, line: 1, column: 11 },
              end: { offset: 19, line: 1, column: 20 },
              source: 'class="c"'
            }
          },
          {
            type: NodeTypes.ATTRIBUTE,
            name: 'inert',
            value: undefined,
            loc: {
              start: { offset: 20, line: 1, column: 21 },
              end: { offset: 25, line: 1, column: 26 },
              source: 'inert'
            }
          },
          {
            type: NodeTypes.ATTRIBUTE,
            name: 'style',
            value: {
              type: NodeTypes.TEXT,
              content: '',
              isEmpty: true,
              loc: {
                start: { offset: 32, line: 1, column: 33 },
                end: { offset: 34, line: 1, column: 35 },
                source: "''"
              }
            },
            loc: {
              start: { offset: 26, line: 1, column: 27 },
              end: { offset: 34, line: 1, column: 35 },
              source: "style=''"
            }
          }
        ],
        isSelfClosing: false,
        children: [],
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 41, line: 1, column: 42 },
          source: '<div id=a class="c" inert style=\'\'></div>'
        }
      })
    })

    test('directive with no value', () => {
      const ast = parse('<div v-if/>', parserOptions)
      const directive = (ast.children[0] as ElementNode)
        .props[0] as DirectiveNode

      expect(directive).toStrictEqual({
        type: NodeTypes.DIRECTIVE,
        name: 'if',
        arg: undefined,
        modifiers: [],
        exp: undefined,
        loc: {
          start: { offset: 5, line: 1, column: 6 },
          end: { offset: 9, line: 1, column: 10 },
          source: 'v-if'
        }
      })
    })

    test('directive with value', () => {
      const ast = parse('<div v-if="a"/>', parserOptions)
      const directive = (ast.children[0] as ElementNode)
        .props[0] as DirectiveNode

      expect(directive).toStrictEqual({
        type: NodeTypes.DIRECTIVE,
        name: 'if',
        arg: undefined,
        modifiers: [],
        exp: {
          type: NodeTypes.EXPRESSION,
          content: 'a',
          isStatic: false,
          loc: {
            start: { offset: 10, line: 1, column: 11 },
            end: { offset: 13, line: 1, column: 14 },
            source: '"a"'
          }
        },
        loc: {
          start: { offset: 5, line: 1, column: 6 },
          end: { offset: 13, line: 1, column: 14 },
          source: 'v-if="a"'
        }
      })
    })

    test('directive with argument', () => {
      const ast = parse('<div v-on:click/>', parserOptions)
      const directive = (ast.children[0] as ElementNode)
        .props[0] as DirectiveNode

      expect(directive).toStrictEqual({
        type: NodeTypes.DIRECTIVE,
        name: 'on',
        arg: {
          type: 4,
          content: 'click',
          isStatic: true,
          loc: {
            source: 'click',
            start: {
              column: 11,
              line: 1,
              offset: 10
            },
            end: {
              column: 16,
              line: 1,
              offset: 15
            }
          }
        },
        modifiers: [],
        exp: undefined,
        loc: {
          start: { offset: 5, line: 1, column: 6 },
          end: { offset: 15, line: 1, column: 16 },
          source: 'v-on:click'
        }
      })
    })

    test('directive with a modifier', () => {
      const ast = parse('<div v-on.enter/>', parserOptions)
      const directive = (ast.children[0] as ElementNode)
        .props[0] as DirectiveNode

      expect(directive).toStrictEqual({
        type: NodeTypes.DIRECTIVE,
        name: 'on',
        arg: undefined,
        modifiers: ['enter'],
        exp: undefined,
        loc: {
          start: { offset: 5, line: 1, column: 6 },
          end: { offset: 15, line: 1, column: 16 },
          source: 'v-on.enter'
        }
      })
    })

    test('directive with two modifiers', () => {
      const ast = parse('<div v-on.enter.exact/>', parserOptions)
      const directive = (ast.children[0] as ElementNode)
        .props[0] as DirectiveNode

      expect(directive).toStrictEqual({
        type: NodeTypes.DIRECTIVE,
        name: 'on',
        arg: undefined,
        modifiers: ['enter', 'exact'],
        exp: undefined,
        loc: {
          start: { offset: 5, line: 1, column: 6 },
          end: { offset: 21, line: 1, column: 22 },
          source: 'v-on.enter.exact'
        }
      })
    })

    test('directive with argument and modifiers', () => {
      const ast = parse('<div v-on:click.enter.exact/>', parserOptions)
      const directive = (ast.children[0] as ElementNode)
        .props[0] as DirectiveNode

      expect(directive).toStrictEqual({
        type: NodeTypes.DIRECTIVE,
        name: 'on',
        arg: {
          type: 4,
          content: 'click',
          isStatic: true,
          loc: {
            source: 'click',
            start: {
              column: 11,
              line: 1,
              offset: 10
            },
            end: {
              column: 16,
              line: 1,
              offset: 15
            }
          }
        },
        modifiers: ['enter', 'exact'],
        exp: undefined,
        loc: {
          start: { offset: 5, line: 1, column: 6 },
          end: { offset: 27, line: 1, column: 28 },
          source: 'v-on:click.enter.exact'
        }
      })
    })

    test('v-bind shorthand', () => {
      const ast = parse('<div :a=b />', parserOptions)
      const directive = (ast.children[0] as ElementNode)
        .props[0] as DirectiveNode

      expect(directive).toStrictEqual({
        type: NodeTypes.DIRECTIVE,
        name: 'bind',
        arg: {
          type: 4,
          content: 'a',
          isStatic: true,
          loc: {
            source: 'a',
            start: {
              column: 7,
              line: 1,
              offset: 6
            },
            end: {
              column: 8,
              line: 1,
              offset: 7
            }
          }
        },
        modifiers: [],
        exp: {
          type: NodeTypes.EXPRESSION,
          content: 'b',
          isStatic: false,
          loc: {
            start: { offset: 8, line: 1, column: 9 },
            end: { offset: 9, line: 1, column: 10 },
            source: 'b'
          }
        },
        loc: {
          start: { offset: 5, line: 1, column: 6 },
          end: { offset: 9, line: 1, column: 10 },
          source: ':a=b'
        }
      })
    })

    test('v-bind shorthand with modifier', () => {
      const ast = parse('<div :a.sync=b />', parserOptions)
      const directive = (ast.children[0] as ElementNode)
        .props[0] as DirectiveNode

      expect(directive).toStrictEqual({
        type: NodeTypes.DIRECTIVE,
        name: 'bind',
        arg: {
          type: 4,
          content: 'a',
          isStatic: true,
          loc: {
            source: 'a',
            start: {
              column: 7,
              line: 1,
              offset: 6
            },
            end: {
              column: 8,
              line: 1,
              offset: 7
            }
          }
        },
        modifiers: ['sync'],
        exp: {
          type: NodeTypes.EXPRESSION,
          content: 'b',
          isStatic: false,
          loc: {
            start: { offset: 13, line: 1, column: 14 },
            end: { offset: 14, line: 1, column: 15 },
            source: 'b'
          }
        },
        loc: {
          start: { offset: 5, line: 1, column: 6 },
          end: { offset: 14, line: 1, column: 15 },
          source: ':a.sync=b'
        }
      })
    })

    test('v-on shorthand', () => {
      const ast = parse('<div @a=b />', parserOptions)
      const directive = (ast.children[0] as ElementNode)
        .props[0] as DirectiveNode

      expect(directive).toStrictEqual({
        type: NodeTypes.DIRECTIVE,
        name: 'on',
        arg: {
          type: 4,
          content: 'a',
          isStatic: true,
          loc: {
            source: 'a',
            start: {
              column: 7,
              line: 1,
              offset: 6
            },
            end: {
              column: 8,
              line: 1,
              offset: 7
            }
          }
        },
        modifiers: [],
        exp: {
          type: NodeTypes.EXPRESSION,
          content: 'b',
          isStatic: false,
          loc: {
            start: { offset: 8, line: 1, column: 9 },
            end: { offset: 9, line: 1, column: 10 },
            source: 'b'
          }
        },
        loc: {
          start: { offset: 5, line: 1, column: 6 },
          end: { offset: 9, line: 1, column: 10 },
          source: '@a=b'
        }
      })
    })

    test('v-on shorthand with modifier', () => {
      const ast = parse('<div @a.enter=b />', parserOptions)
      const directive = (ast.children[0] as ElementNode)
        .props[0] as DirectiveNode

      expect(directive).toStrictEqual({
        type: NodeTypes.DIRECTIVE,
        name: 'on',
        arg: {
          type: 4,
          content: 'a',
          isStatic: true,
          loc: {
            source: 'a',
            start: {
              column: 7,
              line: 1,
              offset: 6
            },
            end: {
              column: 8,
              line: 1,
              offset: 7
            }
          }
        },
        modifiers: ['enter'],
        exp: {
          type: NodeTypes.EXPRESSION,
          content: 'b',
          isStatic: false,
          loc: {
            start: { offset: 14, line: 1, column: 15 },
            end: { offset: 15, line: 1, column: 16 },
            source: 'b'
          }
        },
        loc: {
          start: { offset: 5, line: 1, column: 6 },
          end: { offset: 15, line: 1, column: 16 },
          source: '@a.enter=b'
        }
      })
    })

    test('end tags are case-insensitive.', () => {
      const ast = parse('<div>hello</DIV>after', parserOptions)
      const element = ast.children[0] as ElementNode
      const text = element.children[0] as TextNode

      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'hello',
        isEmpty: false,
        loc: {
          start: { offset: 5, line: 1, column: 6 },
          end: { offset: 10, line: 1, column: 11 },
          source: 'hello'
        }
      })
    })

    test('Strict end tag detection.', () => {
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

  test('self closing single tag', () => {
    const ast = parse('<div :class="{ some: condition }" />', parserOptions)

    expect(ast.children).toHaveLength(1)
    expect(ast.children[0]).toMatchObject({ tag: 'div' })
  })

  test('self closing multiple tag', () => {
    const ast = parse(
      `<div :class="{ some: condition }" />\n` +
        `<p v-bind:style="{ color: 'red' }"/>`,
      parserOptions
    )

    expect(ast).toMatchSnapshot()

    expect(ast.children).toHaveLength(2)
    expect(ast.children[0]).toMatchObject({ tag: 'div' })
    expect(ast.children[1]).toMatchObject({ tag: 'p' })
  })

  test('valid html', () => {
    const ast = parse(
      `<div :class="{ some: condition }">\n` +
        `  <p v-bind:style="{ color: 'red' }"/>\n` +
        `  <!-- a comment with <html> inside it -->\n` +
        `</div>`,
      parserOptions
    )

    expect(ast).toMatchSnapshot()

    expect(ast.children).toHaveLength(1)
    const el = ast.children[0] as any
    expect(el).toMatchObject({
      tag: 'div'
    })
    expect(el.children).toHaveLength(2)
    expect(el.children[0]).toMatchObject({
      tag: 'p'
    })
    expect(el.children[1]).toMatchObject({
      type: NodeTypes.COMMENT
    })
  })

  test('invalid html', () => {
    expect(() => {
      parse(`<div>\n<span>\n</div>\n</span>`, parserOptions)
    }).toThrow('End tag was not found. (3:1)')

    const spy = jest.fn()
    const ast = parse(`<div>\n<span>\n</div>\n</span>`, {
      ...parserOptions,
      onError: spy
    })

    expect(spy).toBeCalledWith(ParserErrorTypes.X_MISSING_END_TAG, {
      offset: 13,
      line: 3,
      column: 1
    })
    expect(spy).toBeCalledWith(ParserErrorTypes.X_INVALID_END_TAG, {
      offset: 20,
      line: 4,
      column: 1
    })
    expect(ast).toMatchSnapshot()
  })

  test('parse with correct location info', () => {
    const [foo, bar, but, baz] = parse(
      'foo \n is {{ bar }} but {{ baz }}',
      parserOptions
    ).children

    let offset = 0
    expect(foo.loc.start).toEqual({ line: 1, column: 1, offset })
    offset += foo.loc.source.length
    expect(foo.loc.end).toEqual({ line: 2, column: 4, offset })

    expect(bar.loc.start).toEqual({ line: 2, column: 4, offset })
    offset += bar.loc.source.length
    expect(bar.loc.end).toEqual({ line: 2, column: 13, offset })

    expect(but.loc.start).toEqual({ line: 2, column: 13, offset })
    offset += but.loc.source.length
    expect(but.loc.end).toEqual({ line: 2, column: 18, offset })

    expect(baz.loc.start).toEqual({ line: 2, column: 18, offset })
    offset += baz.loc.source.length
    expect(baz.loc.end).toEqual({ line: 2, column: 27, offset })
  })

  describe('namedCharacterReferences option', () => {
    test('use the given map', () => {
      const ast: any = parse('&amp;&cups;', {
        ...parserOptions,
        namedCharacterReferences: {
          'cups;': '\u222A\uFE00' // UNION with serifs
        },
        onError: () => {} // Ignore errors
      })

      expect(ast.children.length).toBe(1)
      expect(ast.children[0].type).toBe(NodeTypes.TEXT)
      expect(ast.children[0].content).toBe('&amp;\u222A\uFE00')
    })
  })

  describe('onError option', () => {
    const patterns: {
      [key: string]: Array<{
        code: string
        errors: Array<{ type: ParserErrorTypes; loc: Position }>
        options?: Partial<ParserOptions>
      }>
    } = {
      ABRUPT_CLOSING_OF_EMPTY_COMMENT: [
        {
          code: '<template><!--></template>',
          errors: [
            {
              type: ParserErrorTypes.ABRUPT_CLOSING_OF_EMPTY_COMMENT,
              loc: { offset: 10, line: 1, column: 11 }
            }
          ]
        },
        {
          code: '<template><!---></template>',
          errors: [
            {
              type: ParserErrorTypes.ABRUPT_CLOSING_OF_EMPTY_COMMENT,
              loc: { offset: 10, line: 1, column: 11 }
            }
          ]
        },
        {
          code: '<template><!----></template>',
          errors: []
        }
      ],
      ABSENCE_OF_DIGITS_IN_NUMERIC_CHARACTER_REFERENCE: [
        {
          code: '<template>&#a;</template>',
          errors: [
            {
              type:
                ParserErrorTypes.ABSENCE_OF_DIGITS_IN_NUMERIC_CHARACTER_REFERENCE,
              loc: { offset: 10, line: 1, column: 11 }
            }
          ]
        },
        {
          code: '<template>&#xg;</template>',
          errors: [
            {
              type:
                ParserErrorTypes.ABSENCE_OF_DIGITS_IN_NUMERIC_CHARACTER_REFERENCE,
              loc: { offset: 10, line: 1, column: 11 }
            }
          ]
        },
        {
          code: '<template>&#99;</template>',
          errors: []
        },
        {
          code: '<template>&#xff;</template>',
          errors: []
        },
        {
          code: '<template attr="&#a;"></template>',
          errors: [
            {
              type:
                ParserErrorTypes.ABSENCE_OF_DIGITS_IN_NUMERIC_CHARACTER_REFERENCE,
              loc: { offset: 16, line: 1, column: 17 }
            }
          ]
        },
        {
          code: '<template attr="&#xg;"></template>',
          errors: [
            {
              type:
                ParserErrorTypes.ABSENCE_OF_DIGITS_IN_NUMERIC_CHARACTER_REFERENCE,
              loc: { offset: 16, line: 1, column: 17 }
            }
          ]
        },
        {
          code: '<template attr="&#99;"></template>',
          errors: []
        },
        {
          code: '<template attr="&#xff;"></template>',
          errors: []
        }
      ],
      CDATA_IN_HTML_CONTENT: [
        {
          code: '<template><![CDATA[cdata]]></template>',
          errors: [
            {
              type: ParserErrorTypes.CDATA_IN_HTML_CONTENT,
              loc: { offset: 10, line: 1, column: 11 }
            }
          ]
        },
        {
          code: '<template><svg><![CDATA[cdata]]></svg></template>',
          errors: []
        }
      ],
      CHARACTER_REFERENCE_OUTSIDE_UNICODE_RANGE: [
        {
          code: '<template>&#1234567;</template>',
          errors: [
            {
              type: ParserErrorTypes.CHARACTER_REFERENCE_OUTSIDE_UNICODE_RANGE,
              loc: { offset: 10, line: 1, column: 11 }
            }
          ]
        }
      ],
      CONTROL_CHARACTER_REFERENCE: [
        {
          code: '<template>&#0003;</template>',
          errors: [
            {
              type: ParserErrorTypes.CONTROL_CHARACTER_REFERENCE,
              loc: { offset: 10, line: 1, column: 11 }
            }
          ]
        },
        {
          code: '<template>&#x7F;</template>',
          errors: [
            {
              type: ParserErrorTypes.CONTROL_CHARACTER_REFERENCE,
              loc: { offset: 10, line: 1, column: 11 }
            }
          ]
        }
      ],
      DUPLICATE_ATTRIBUTE: [
        {
          code: '<template><div id="" id=""></div></template>',
          errors: [
            {
              type: ParserErrorTypes.DUPLICATE_ATTRIBUTE,
              loc: { offset: 21, line: 1, column: 22 }
            }
          ]
        }
      ],
      END_TAG_WITH_ATTRIBUTES: [
        {
          code: '<template><div></div id=""></template>',
          errors: [
            {
              type: ParserErrorTypes.END_TAG_WITH_ATTRIBUTES,
              loc: { offset: 21, line: 1, column: 22 }
            }
          ]
        }
      ],
      END_TAG_WITH_TRAILING_SOLIDUS: [
        {
          code: '<template><div></div/></template>',
          errors: [
            {
              type: ParserErrorTypes.END_TAG_WITH_TRAILING_SOLIDUS,
              loc: { offset: 20, line: 1, column: 21 }
            }
          ]
        }
      ],
      EOF_BEFORE_TAG_NAME: [
        {
          code: '<template><',
          errors: [
            {
              type: ParserErrorTypes.EOF_BEFORE_TAG_NAME,
              loc: { offset: 11, line: 1, column: 12 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 11, line: 1, column: 12 }
            }
          ]
        },
        {
          code: '<template></',
          errors: [
            {
              type: ParserErrorTypes.EOF_BEFORE_TAG_NAME,
              loc: { offset: 12, line: 1, column: 13 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 12, line: 1, column: 13 }
            }
          ]
        }
      ],
      EOF_IN_CDATA: [
        {
          code: '<template><svg><![CDATA[cdata',
          errors: [
            {
              type: ParserErrorTypes.EOF_IN_CDATA,
              loc: { offset: 29, line: 1, column: 30 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 29, line: 1, column: 30 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 29, line: 1, column: 30 }
            }
          ]
        },
        {
          code: '<template><svg><![CDATA[',
          errors: [
            {
              type: ParserErrorTypes.EOF_IN_CDATA,
              loc: { offset: 24, line: 1, column: 25 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 24, line: 1, column: 25 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 24, line: 1, column: 25 }
            }
          ]
        }
      ],
      EOF_IN_COMMENT: [
        {
          code: '<template><!--comment',
          errors: [
            {
              type: ParserErrorTypes.EOF_IN_COMMENT,
              loc: { offset: 21, line: 1, column: 22 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 21, line: 1, column: 22 }
            }
          ]
        },
        {
          code: '<template><!--',
          errors: [
            {
              type: ParserErrorTypes.EOF_IN_COMMENT,
              loc: { offset: 14, line: 1, column: 15 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 14, line: 1, column: 15 }
            }
          ]
        },
        // Bogus comments don't throw eof-in-comment error.
        // https://html.spec.whatwg.org/multipage/parsing.html#bogus-comment-state
        {
          code: '<template><!',
          errors: [
            {
              type: ParserErrorTypes.INCORRECTLY_OPENED_COMMENT,
              loc: { offset: 10, line: 1, column: 11 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 12, line: 1, column: 13 }
            }
          ]
        },
        {
          code: '<template><!-',
          errors: [
            {
              type: ParserErrorTypes.INCORRECTLY_OPENED_COMMENT,
              loc: { offset: 10, line: 1, column: 11 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 13, line: 1, column: 14 }
            }
          ]
        },
        {
          code: '<template><!abc',
          errors: [
            {
              type: ParserErrorTypes.INCORRECTLY_OPENED_COMMENT,
              loc: { offset: 10, line: 1, column: 11 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 15, line: 1, column: 16 }
            }
          ]
        }
      ],
      EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT: [
        {
          code: "<script><!--console.log('hello')",
          errors: [
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 32, line: 1, column: 33 }
            },
            {
              type: ParserErrorTypes.EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT,
              loc: { offset: 32, line: 1, column: 33 }
            }
          ]
        },
        {
          code: "<script>console.log('hello')",
          errors: [
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 28, line: 1, column: 29 }
            }
          ]
        }
      ],
      EOF_IN_TAG: [
        {
          code: '<template><div',
          errors: [
            {
              type: ParserErrorTypes.EOF_IN_TAG,
              loc: { offset: 14, line: 1, column: 15 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 14, line: 1, column: 15 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 14, line: 1, column: 15 }
            }
          ]
        },
        {
          code: '<template><div ',
          errors: [
            {
              type: ParserErrorTypes.EOF_IN_TAG,
              loc: { offset: 15, line: 1, column: 16 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 15, line: 1, column: 16 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 15, line: 1, column: 16 }
            }
          ]
        },
        {
          code: '<template><div id',
          errors: [
            {
              type: ParserErrorTypes.EOF_IN_TAG,
              loc: { offset: 17, line: 1, column: 18 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 17, line: 1, column: 18 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 17, line: 1, column: 18 }
            }
          ]
        },
        {
          code: '<template><div id ',
          errors: [
            {
              type: ParserErrorTypes.EOF_IN_TAG,
              loc: { offset: 18, line: 1, column: 19 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 18, line: 1, column: 19 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 18, line: 1, column: 19 }
            }
          ]
        },
        {
          code: '<template><div id =',
          errors: [
            {
              type: ParserErrorTypes.MISSING_ATTRIBUTE_VALUE,
              loc: { offset: 19, line: 1, column: 20 }
            },
            {
              type: ParserErrorTypes.EOF_IN_TAG,
              loc: { offset: 19, line: 1, column: 20 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 19, line: 1, column: 20 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 19, line: 1, column: 20 }
            }
          ]
        },
        {
          code: "<template><div id='abc",
          errors: [
            {
              type: ParserErrorTypes.EOF_IN_TAG,
              loc: { offset: 22, line: 1, column: 23 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 22, line: 1, column: 23 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 22, line: 1, column: 23 }
            }
          ]
        },
        {
          code: '<template><div id="abc',
          errors: [
            {
              type: ParserErrorTypes.EOF_IN_TAG,
              loc: { offset: 22, line: 1, column: 23 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 22, line: 1, column: 23 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 22, line: 1, column: 23 }
            }
          ]
        },
        {
          code: "<template><div id='abc'",
          errors: [
            {
              type: ParserErrorTypes.EOF_IN_TAG,
              loc: { offset: 23, line: 1, column: 24 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 23, line: 1, column: 24 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 23, line: 1, column: 24 }
            }
          ]
        },
        {
          code: '<template><div id="abc"',
          errors: [
            {
              type: ParserErrorTypes.EOF_IN_TAG,
              loc: { offset: 23, line: 1, column: 24 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 23, line: 1, column: 24 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 23, line: 1, column: 24 }
            }
          ]
        },
        {
          code: '<template><div id=abc',
          errors: [
            {
              type: ParserErrorTypes.EOF_IN_TAG,
              loc: { offset: 21, line: 1, column: 22 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 21, line: 1, column: 22 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 21, line: 1, column: 22 }
            }
          ]
        },
        {
          code: "<template><div id='abc'/",
          errors: [
            {
              type: ParserErrorTypes.UNEXPECTED_SOLIDUS_IN_TAG,
              loc: { offset: 23, line: 1, column: 24 }
            },
            {
              type: ParserErrorTypes.EOF_IN_TAG,
              loc: { offset: 24, line: 1, column: 25 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 24, line: 1, column: 25 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 24, line: 1, column: 25 }
            }
          ]
        },
        {
          code: '<template><div id="abc"/',
          errors: [
            {
              type: ParserErrorTypes.UNEXPECTED_SOLIDUS_IN_TAG,
              loc: { offset: 23, line: 1, column: 24 }
            },
            {
              type: ParserErrorTypes.EOF_IN_TAG,
              loc: { offset: 24, line: 1, column: 25 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 24, line: 1, column: 25 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 24, line: 1, column: 25 }
            }
          ]
        },
        {
          code: '<template><div id=abc /',
          errors: [
            {
              type: ParserErrorTypes.UNEXPECTED_SOLIDUS_IN_TAG,
              loc: { offset: 22, line: 1, column: 23 }
            },
            {
              type: ParserErrorTypes.EOF_IN_TAG,
              loc: { offset: 23, line: 1, column: 24 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 23, line: 1, column: 24 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 23, line: 1, column: 24 }
            }
          ]
        }
      ],
      INCORRECTLY_CLOSED_COMMENT: [
        {
          code: '<template><!--comment--!></template>',
          errors: [
            {
              type: ParserErrorTypes.INCORRECTLY_CLOSED_COMMENT,
              loc: { offset: 10, line: 1, column: 11 }
            }
          ]
        }
      ],
      INCORRECTLY_OPENED_COMMENT: [
        {
          code: '<template><!></template>',
          errors: [
            {
              type: ParserErrorTypes.INCORRECTLY_OPENED_COMMENT,
              loc: { offset: 10, line: 1, column: 11 }
            }
          ]
        },
        {
          code: '<template><!-></template>',
          errors: [
            {
              type: ParserErrorTypes.INCORRECTLY_OPENED_COMMENT,
              loc: { offset: 10, line: 1, column: 11 }
            }
          ]
        },
        {
          code: '<template><!ELEMENT br EMPTY></template>',
          errors: [
            {
              type: ParserErrorTypes.INCORRECTLY_OPENED_COMMENT,
              loc: { offset: 10, line: 1, column: 11 }
            }
          ]
        },
        // Just ignore doctype.
        {
          code: '<!DOCTYPE html>',
          errors: []
        }
      ],
      INVALID_FIRST_CHARACTER_OF_TAG_NAME: [
        {
          code: '<template>a < b</template>',
          errors: [
            {
              type: ParserErrorTypes.INVALID_FIRST_CHARACTER_OF_TAG_NAME,
              loc: { offset: 13, line: 1, column: 14 }
            }
          ]
        },
        {
          code: '<template><�></template>',
          errors: [
            {
              type: ParserErrorTypes.INVALID_FIRST_CHARACTER_OF_TAG_NAME,
              loc: { offset: 11, line: 1, column: 12 }
            }
          ]
        },
        {
          code: '<template>a </ b</template>',
          errors: [
            {
              type: ParserErrorTypes.INVALID_FIRST_CHARACTER_OF_TAG_NAME,
              loc: { offset: 14, line: 1, column: 15 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 27, line: 1, column: 28 }
            }
          ]
        },
        {
          code: '<template></�></template>',
          errors: [
            {
              type: ParserErrorTypes.INVALID_FIRST_CHARACTER_OF_TAG_NAME,
              loc: { offset: 12, line: 1, column: 13 }
            }
          ]
        },
        // Don't throw invalid-first-character-of-tag-name in interpolation
        {
          code: '<template>{{a < b}}</template>',
          errors: []
        }
      ],
      MISSING_ATTRIBUTE_VALUE: [
        {
          code: '<template><div id=></div></template>',
          errors: [
            {
              type: ParserErrorTypes.MISSING_ATTRIBUTE_VALUE,
              loc: { offset: 18, line: 1, column: 19 }
            }
          ]
        },
        {
          code: '<template><div id= ></div></template>',
          errors: [
            {
              type: ParserErrorTypes.MISSING_ATTRIBUTE_VALUE,
              loc: { offset: 19, line: 1, column: 20 }
            }
          ]
        },
        {
          code: '<template><div id= /></div></template>',
          errors: []
        }
      ],
      MISSING_END_TAG_NAME: [
        {
          code: '<template></></template>',
          errors: [
            {
              type: ParserErrorTypes.MISSING_END_TAG_NAME,
              loc: { offset: 12, line: 1, column: 13 }
            }
          ]
        }
      ],
      MISSING_SEMICOLON_AFTER_CHARACTER_REFERENCE: [
        {
          code: '<template>&amp</template>',
          options: { namedCharacterReferences: { amp: '&' } },
          errors: [
            {
              type:
                ParserErrorTypes.MISSING_SEMICOLON_AFTER_CHARACTER_REFERENCE,
              loc: { offset: 14, line: 1, column: 15 }
            }
          ]
        },
        {
          code: '<template>&#40</template>',
          errors: [
            {
              type:
                ParserErrorTypes.MISSING_SEMICOLON_AFTER_CHARACTER_REFERENCE,
              loc: { offset: 14, line: 1, column: 15 }
            }
          ]
        },
        {
          code: '<template>&#x40</template>',
          errors: [
            {
              type:
                ParserErrorTypes.MISSING_SEMICOLON_AFTER_CHARACTER_REFERENCE,
              loc: { offset: 15, line: 1, column: 16 }
            }
          ]
        }
      ],
      MISSING_WHITESPACE_BETWEEN_ATTRIBUTES: [
        {
          code: '<template><div id="foo"class="bar"></div></template>',
          errors: [
            {
              type: ParserErrorTypes.MISSING_WHITESPACE_BETWEEN_ATTRIBUTES,
              loc: { offset: 23, line: 1, column: 24 }
            }
          ]
        },
        // CR doesn't appear in tokenization phase, but all CR are removed in preprocessing.
        // https://html.spec.whatwg.org/multipage/parsing.html#preprocessing-the-input-stream
        {
          code: '<template><div id="foo"\r\nclass="bar"></div></template>',
          errors: []
        }
      ],
      NESTED_COMMENT: [
        {
          code: '<template><!--a<!--b--></template>',
          errors: [
            {
              type: ParserErrorTypes.NESTED_COMMENT,
              loc: { offset: 15, line: 1, column: 16 }
            }
          ]
        },
        {
          code: '<template><!--a<!--b<!--c--></template>',
          errors: [
            {
              type: ParserErrorTypes.NESTED_COMMENT,
              loc: { offset: 15, line: 1, column: 16 }
            },
            {
              type: ParserErrorTypes.NESTED_COMMENT,
              loc: { offset: 20, line: 1, column: 21 }
            }
          ]
        },
        {
          code: '<template><!--a<!--></template>',
          errors: []
        },
        {
          code: '<template><!--a<!--',
          errors: [
            {
              type: ParserErrorTypes.EOF_IN_COMMENT,
              loc: { offset: 19, line: 1, column: 20 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 19, line: 1, column: 20 }
            }
          ]
        }
      ],
      NONCHARACTER_CHARACTER_REFERENCE: [
        {
          code: '<template>&#xFFFE;</template>',
          errors: [
            {
              type: ParserErrorTypes.NONCHARACTER_CHARACTER_REFERENCE,
              loc: { offset: 10, line: 1, column: 11 }
            }
          ]
        },
        {
          code: '<template>&#x1FFFF;</template>',
          errors: [
            {
              type: ParserErrorTypes.NONCHARACTER_CHARACTER_REFERENCE,
              loc: { offset: 10, line: 1, column: 11 }
            }
          ]
        }
      ],
      NULL_CHARACTER_REFERENCE: [
        {
          code: '<template>&#0000;</template>',
          errors: [
            {
              type: ParserErrorTypes.NULL_CHARACTER_REFERENCE,
              loc: { offset: 10, line: 1, column: 11 }
            }
          ]
        }
      ],
      SURROGATE_CHARACTER_REFERENCE: [
        {
          code: '<template>&#xD800;</template>',
          errors: [
            {
              type: ParserErrorTypes.SURROGATE_CHARACTER_REFERENCE,
              loc: { offset: 10, line: 1, column: 11 }
            }
          ]
        }
      ],
      UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME: [
        {
          code: "<template><div a\"bc=''></div></template>",
          errors: [
            {
              type: ParserErrorTypes.UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME,
              loc: { offset: 16, line: 1, column: 17 }
            }
          ]
        },
        {
          code: "<template><div a'bc=''></div></template>",
          errors: [
            {
              type: ParserErrorTypes.UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME,
              loc: { offset: 16, line: 1, column: 17 }
            }
          ]
        },
        {
          code: "<template><div a<bc=''></div></template>",
          errors: [
            {
              type: ParserErrorTypes.UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME,
              loc: { offset: 16, line: 1, column: 17 }
            }
          ]
        }
      ],
      UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE: [
        {
          code: '<template><div foo=bar"></div></template>',
          errors: [
            {
              type:
                ParserErrorTypes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE,
              loc: { offset: 22, line: 1, column: 23 }
            }
          ]
        },
        {
          code: "<template><div foo=bar'></div></template>",
          errors: [
            {
              type:
                ParserErrorTypes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE,
              loc: { offset: 22, line: 1, column: 23 }
            }
          ]
        },
        {
          code: '<template><div foo=bar<div></div></template>',
          errors: [
            {
              type:
                ParserErrorTypes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE,
              loc: { offset: 22, line: 1, column: 23 }
            }
          ]
        },
        {
          code: '<template><div foo=bar=baz></div></template>',
          errors: [
            {
              type:
                ParserErrorTypes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE,
              loc: { offset: 22, line: 1, column: 23 }
            }
          ]
        },
        {
          code: '<template><div foo=bar`></div></template>',
          errors: [
            {
              type:
                ParserErrorTypes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE,
              loc: { offset: 22, line: 1, column: 23 }
            }
          ]
        }
      ],
      UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME: [
        {
          code: '<template><div =foo=bar></div></template>',
          errors: [
            {
              type:
                ParserErrorTypes.UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME,
              loc: { offset: 15, line: 1, column: 16 }
            }
          ]
        },
        {
          code: '<template><div =></div></template>',
          errors: [
            {
              type:
                ParserErrorTypes.UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME,
              loc: { offset: 15, line: 1, column: 16 }
            }
          ]
        }
      ],
      UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME: [
        {
          code: '<template><?xml?></template>',
          errors: [
            {
              type:
                ParserErrorTypes.UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME,
              loc: { offset: 11, line: 1, column: 12 }
            }
          ]
        }
      ],
      UNEXPECTED_SOLIDUS_IN_TAG: [
        {
          code: '<template><div a/b></div></template>',
          errors: [
            {
              type: ParserErrorTypes.UNEXPECTED_SOLIDUS_IN_TAG,
              loc: { offset: 16, line: 1, column: 17 }
            }
          ]
        }
      ],
      UNKNOWN_NAMED_CHARACTER_REFERENCE: [
        {
          code: '<template>&unknown;</template>',
          errors: [
            {
              type: ParserErrorTypes.UNKNOWN_NAMED_CHARACTER_REFERENCE,
              loc: { offset: 10, line: 1, column: 11 }
            }
          ]
        }
      ],
      X_INVALID_END_TAG: [
        {
          code: '<template></div></template>',
          errors: [
            {
              type: ParserErrorTypes.X_INVALID_END_TAG,
              loc: { offset: 10, line: 1, column: 11 }
            }
          ]
        },
        {
          code: '<template></div></div></template>',
          errors: [
            {
              type: ParserErrorTypes.X_INVALID_END_TAG,
              loc: { offset: 10, line: 1, column: 11 }
            },
            {
              type: ParserErrorTypes.X_INVALID_END_TAG,
              loc: { offset: 16, line: 1, column: 17 }
            }
          ]
        },
        {
          code: "<template>{{'</div>'}}</template>",
          errors: []
        },
        {
          code: '<textarea></div></textarea>',
          errors: []
        },
        {
          code: '<svg><![CDATA[</div>]]></svg>',
          errors: []
        },
        {
          code: '<svg><!--</div>--></svg>',
          errors: []
        }
      ],
      X_MISSING_END_TAG: [
        {
          code: '<template><div></template>',
          errors: [
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 15, line: 1, column: 16 }
            }
          ]
        },
        {
          code: '<template><div>',
          errors: [
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 15, line: 1, column: 16 }
            },
            {
              type: ParserErrorTypes.X_MISSING_END_TAG,
              loc: { offset: 15, line: 1, column: 16 }
            }
          ]
        }
      ],
      X_MISSING_INTERPOLATION_END: [
        {
          code: '{{ foo',
          errors: [
            {
              type: ParserErrorTypes.X_MISSING_INTERPOLATION_END,
              loc: { offset: 0, line: 1, column: 1 }
            }
          ]
        },
        {
          code: '{{',
          errors: [
            {
              type: ParserErrorTypes.X_MISSING_INTERPOLATION_END,
              loc: { offset: 0, line: 1, column: 1 }
            }
          ]
        },
        {
          code: '{{}}',
          errors: []
        }
      ]
    }

    for (const key of Object.keys(patterns) as (keyof (typeof patterns))[]) {
      describe(key, () => {
        for (const { code, errors, options } of patterns[key]) {
          test(
            code.replace(
              /[\r\n]/g,
              c => `\\x0${c.codePointAt(0)!.toString(16)};`
            ),
            () => {
              const spy = jest.fn()
              const ast = parse(code, {
                ...parserOptions,
                ...options,
                onError: spy
              })

              expect(spy.mock.calls).toEqual(
                errors.map(({ type, loc }) => [type, loc])
              )
              expect(ast).toMatchSnapshot()
            }
          )
        }
      })
    }
  })
})
