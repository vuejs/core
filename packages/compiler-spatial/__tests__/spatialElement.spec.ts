import { describe, expect, test } from 'vitest'
import { getSwiftLines } from './utils'

describe('spatial: element mapping', () => {
  test('VStack', () => {
    const lines = getSwiftLines(`<v-stack><text>Hello</text></v-stack>`)
    expect(lines).toContain('VStack {')
    expect(lines.some(l => l.includes('Text("Hello")'))).toBe(true)
    expect(lines).toContain('}')
  })

  test('VStack with spacing', () => {
    const lines = getSwiftLines(
      `<v-stack spacing="16"><text>A</text></v-stack>`,
    )
    expect(lines.some(l => l.includes('VStack(spacing: 16)'))).toBe(true)
  })

  test('HStack', () => {
    const lines = getSwiftLines(`<h-stack><text>A</text></h-stack>`)
    expect(lines.some(l => l.includes('HStack {'))).toBe(true)
  })

  test('ZStack', () => {
    const lines = getSwiftLines(`<z-stack><text>A</text></z-stack>`)
    expect(lines.some(l => l.includes('ZStack {'))).toBe(true)
  })

  test('Text with static content', () => {
    const lines = getSwiftLines(`<text>Hello World</text>`)
    expect(lines.some(l => l.includes('Text("Hello World")'))).toBe(true)
  })

  test('Text with font modifier', () => {
    const lines = getSwiftLines(`<text font="largeTitle">Title</text>`)
    expect(lines.some(l => l.includes('Text("Title")'))).toBe(true)
    expect(lines.some(l => l.includes('.font(.largeTitle)'))).toBe(true)
  })

  test('Text with opacity modifier', () => {
    const lines = getSwiftLines(`<text opacity="0.7">Faded</text>`)
    expect(lines.some(l => l.includes('.opacity(0.7)'))).toBe(true)
  })

  test('Divider', () => {
    const lines = getSwiftLines(`<divider />`)
    expect(lines.some(l => l.includes('Divider()'))).toBe(true)
  })

  test('Spacer', () => {
    const lines = getSwiftLines(`<spacer />`)
    expect(lines.some(l => l.includes('Spacer()'))).toBe(true)
  })

  test('sf-symbol', () => {
    const lines = getSwiftLines(`<sf-symbol name="plus.circle.fill" />`)
    expect(
      lines.some(l => l.includes('Image(systemName: "plus.circle.fill")')),
    ).toBe(true)
  })

  test('image with src', () => {
    const lines = getSwiftLines(`<image src="photo" />`)
    expect(lines.some(l => l.includes('Image("photo")'))).toBe(true)
  })

  test('Button with @tap and children', () => {
    const lines = getSwiftLines(
      `<button @tap="increment"><text>Click</text></button>`,
    )
    expect(
      lines.some(l => l.includes('Button(action: { vm.emit("increment") })')),
    ).toBe(true)
  })

  test('Label element', () => {
    const lines = getSwiftLines(
      `<label><text>Title</text><sf-symbol name="star" /></label>`,
    )
    expect(lines.some(l => l.includes('Label {'))).toBe(true)
  })

  test('Model3D', () => {
    const lines = getSwiftLines(`<model3d src="earth.usdz" />`)
    expect(lines.some(l => l.includes('Model3D(named: "earth.usdz")'))).toBe(
      true,
    )
  })

  test('unknown element fallback', () => {
    const lines = getSwiftLines(`<custom-thing><text>Hi</text></custom-thing>`)
    // Unknown hyphenated tags are classified as Vue components by the parser
    expect(lines.some(l => l.includes('// Component: custom-thing'))).toBe(true)
  })
})
