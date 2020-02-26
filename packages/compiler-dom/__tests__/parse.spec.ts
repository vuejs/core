import {
  baseParse as parse,
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
        loc: {
          start: { offset: 14, line: 1, column: 15 },
          end: { offset: 23, line: 1, column: 24 },
          source: 'some text'
        }
      })
    })

    test('<pre> tag should preserve raw whitespace', () => {
      const rawText = `  \na    b    \n   c`
      const ast = parse(`<pre>${rawText}</pre>`, parserOptions)
      expect((ast.children[0] as ElementNode).children[0]).toMatchObject({
        type: NodeTypes.TEXT,
        content: rawText
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
          isConstant: false,
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

    test('native element', () => {
      const ast = parse('<div></div><comp></comp><Comp></Comp>', parserOptions)

      expect(ast.children[0]).toMatchObject({
        type: NodeTypes.ELEMENT,
        tag: 'div',
        tagType: ElementTypes.ELEMENT
      })

      expect(ast.children[1]).toMatchObject({
        type: NodeTypes.ELEMENT,
        tag: 'comp',
        tagType: ElementTypes.COMPONENT
      })

      expect(ast.children[2]).toMatchObject({
        type: NodeTypes.ELEMENT,
        tag: 'Comp',
        tagType: ElementTypes.COMPONENT
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
        loc: {
          start: { offset: 10, line: 1, column: 11 },
          end: { offset: 37, line: 1, column: 38 },
          source: 'hello</textarea</textarea0>'
        }
      })
    })
  })

  describe('Namespaces', () => {
    test('HTML namespace', () => {
      const ast = parse('<html>test</html>', parserOptions)
      const element = ast.children[0] as ElementNode

      expect(element.ns).toBe(DOMNamespaces.HTML)
    })

    test('SVG namespace', () => {
      const ast = parse('<svg>test</svg>', parserOptions)
      const element = ast.children[0] as ElementNode

      expect(element.ns).toBe(DOMNamespaces.SVG)
    })

    test('MATH_ML namespace', () => {
      const ast = parse('<math>test</math>', parserOptions)
      const element = ast.children[0] as ElementNode

      expect(element.ns).toBe(DOMNamespaces.MATH_ML)
    })

    test('SVG in MATH_ML namespace', () => {
      const ast = parse(
        '<math><annotation-xml><svg></svg></annotation-xml></math>',
        parserOptions
      )
      const elementMath = ast.children[0] as ElementNode
      const elementAnnotation = elementMath.children[0] as ElementNode
      const elementSvg = elementAnnotation.children[0] as ElementNode

      expect(elementMath.ns).toBe(DOMNamespaces.MATH_ML)
      expect(elementSvg.ns).toBe(DOMNamespaces.SVG)
    })

    test('html text/html in MATH_ML namespace', () => {
      const ast = parse(
        '<math><annotation-xml encoding="text/html"><test/></annotation-xml></math>',
        parserOptions
      )

      const elementMath = ast.children[0] as ElementNode
      const elementAnnotation = elementMath.children[0] as ElementNode
      const element = elementAnnotation.children[0] as ElementNode

      expect(elementMath.ns).toBe(DOMNamespaces.MATH_ML)
      expect(element.ns).toBe(DOMNamespaces.HTML)
    })

    test('html application/xhtml+xml in MATH_ML namespace', () => {
      const ast = parse(
        '<math><annotation-xml encoding="application/xhtml+xml"><test/></annotation-xml></math>',
        parserOptions
      )
      const elementMath = ast.children[0] as ElementNode
      const elementAnnotation = elementMath.children[0] as ElementNode
      const element = elementAnnotation.children[0] as ElementNode

      expect(elementMath.ns).toBe(DOMNamespaces.MATH_ML)
      expect(element.ns).toBe(DOMNamespaces.HTML)
    })

    test('mtext malignmark in MATH_ML namespace', () => {
      const ast = parse(
        '<math><mtext><malignmark/></mtext></math>',
        parserOptions
      )
      const elementMath = ast.children[0] as ElementNode
      const elementText = elementMath.children[0] as ElementNode
      const element = elementText.children[0] as ElementNode

      expect(elementMath.ns).toBe(DOMNamespaces.MATH_ML)
      expect(element.ns).toBe(DOMNamespaces.MATH_ML)
    })

    test('mtext and not malignmark tag in MATH_ML namespace', () => {
      const ast = parse('<math><mtext><test/></mtext></math>', parserOptions)
      const elementMath = ast.children[0] as ElementNode
      const elementText = elementMath.children[0] as ElementNode
      const element = elementText.children[0] as ElementNode

      expect(elementMath.ns).toBe(DOMNamespaces.MATH_ML)
      expect(element.ns).toBe(DOMNamespaces.HTML)
    })

    test('foreignObject tag in SVG namespace', () => {
      const ast = parse(
        '<svg><foreignObject><test/></foreignObject></svg>',
        parserOptions
      )
      const elementSvg = ast.children[0] as ElementNode
      const elementForeignObject = elementSvg.children[0] as ElementNode
      const element = elementForeignObject.children[0] as ElementNode

      expect(elementSvg.ns).toBe(DOMNamespaces.SVG)
      expect(element.ns).toBe(DOMNamespaces.HTML)
    })

    test('desc tag in SVG namespace', () => {
      const ast = parse('<svg><desc><test/></desc></svg>', parserOptions)
      const elementSvg = ast.children[0] as ElementNode
      const elementDesc = elementSvg.children[0] as ElementNode
      const element = elementDesc.children[0] as ElementNode

      expect(elementSvg.ns).toBe(DOMNamespaces.SVG)
      expect(element.ns).toBe(DOMNamespaces.HTML)
    })

    test('title tag in SVG namespace', () => {
      const ast = parse('<svg><title><test/></title></svg>', parserOptions)
      const elementSvg = ast.children[0] as ElementNode
      const elementTitle = elementSvg.children[0] as ElementNode
      const element = elementTitle.children[0] as ElementNode

      expect(elementSvg.ns).toBe(DOMNamespaces.SVG)
      expect(element.ns).toBe(DOMNamespaces.HTML)
    })

    test('SVG in HTML namespace', () => {
      const ast = parse('<html><svg></svg></html>', parserOptions)
      const elementHtml = ast.children[0] as ElementNode
      const element = elementHtml.children[0] as ElementNode

      expect(elementHtml.ns).toBe(DOMNamespaces.HTML)
      expect(element.ns).toBe(DOMNamespaces.SVG)
    })

    test('MATH in HTML namespace', () => {
      const ast = parse('<html><math></math></html>', parserOptions)
      const elementHtml = ast.children[0] as ElementNode
      const element = elementHtml.children[0] as ElementNode

      expect(elementHtml.ns).toBe(DOMNamespaces.HTML)
      expect(element.ns).toBe(DOMNamespaces.MATH_ML)
    })
  })
})
