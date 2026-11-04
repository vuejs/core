import { EditedString, type SourceMapOptions } from '../src/editedString'

// each segment as the generated text it covers, then the line and column it
// maps to and its name; a segment without a source is its text alone
function segments(
  s: EditedString,
  hires?: SourceMapOptions['hires'],
): string[][] {
  const lines = s.toString().split('\n')
  const { mappings, names } = s.generateDecodedMap({ hires })
  return mappings.map((segs, line) =>
    segs.map((seg, i) => {
      const text = JSON.stringify(
        lines[line].slice(
          seg[0],
          i + 1 < segs.length ? segs[i + 1][0] : undefined,
        ),
      )
      if (seg.length === 1) return text
      const name = seg.length === 5 ? ` ${names[seg[4]]}` : ''
      return `${text} ${seg[2] + 1}:${seg[3]}${name}`
    }),
  )
}

describe('compiler sfc: EditedString source maps', () => {
  test('kept text maps at the start of each token, line and piece', () => {
    const s = new EditedString('let a_b = $(1)\n  x++')
    expect(segments(s, true)).toEqual([
      [
        '"let" 1:0',
        '" " 1:3',
        '"a" 1:4',
        '"_" 1:5',
        '"b" 1:6',
        '" " 1:7',
        '"=" 1:8',
        '" " 1:9',
        '"$" 1:10',
        '"(" 1:11',
        '"1" 1:12',
        '")" 1:13',
      ],
      ['"  " 2:0', '"x" 2:2', '"+" 2:3', '"+" 2:4'],
    ])
    expect(segments(s, 'boundary')).toEqual(segments(s, true))

    const t = new EditedString('fooBar baz')
    t.remove(0, 3)
    expect(segments(t, true)).toEqual([['"Bar" 1:3', '" " 1:6', '"baz" 1:7']])
  })

  test('a replacement maps to the start of its range on each of its lines', () => {
    const s = new EditedString('foo(bar)')
    s.overwrite(4, 7, 'x\n  y', { storeName: true })
    expect(segments(s, true)).toEqual([
      ['"foo" 1:0', '"(" 1:3', '"x" 1:4 bar'],
      ['"  y" 1:4', '")" 1:7'],
    ])
  })

  test('inserted text maps nowhere and ends the mapping before it', () => {
    const s = new EditedString('a = 1\nb')
    s.prepend('// head\n')
    s.appendLeft(5, ' + x')
    s.append('\n// tail')
    expect(segments(s, true)).toEqual([
      ['"// head"'],
      ['"a" 1:0', '" " 1:1', '"=" 1:2', '" " 1:3', '"1" 1:4', '" + x"'],
      ['"b" 2:0'],
      ['"// tail"'],
      // a segment without a source that ended the mappings would be read as
      // keeping the source position before it
      [],
    ])
    expect(segments(s)).toEqual([
      ['"// head"'],
      ['"a = 1" 1:0', '" + x"'],
      ['"b" 2:0'],
      ['"// tail"'],
      [],
    ])
  })

  test('hires false maps the start of each line and piece, and the positions of addSourcemapLocation', () => {
    const s = new EditedString('const foo = bar(baz)\nlet x = 1')
    s.overwrite(6, 9, 'qux', { storeName: true })
    expect(segments(s)).toEqual([
      ['"const " 1:0', '"qux" 1:6 foo', '" = bar(baz)" 1:9'],
      ['"let x = 1" 2:0'],
    ])
    expect(segments(s, false)).toEqual(segments(s))

    s.addSourcemapLocation(12)
    s.addSourcemapLocation(23)
    expect(segments(s)).toEqual([
      ['"const " 1:0', '"qux" 1:6 foo', '" = " 1:9', '"bar(baz)" 1:12'],
      ['"le" 2:0', '"t x = 1" 2:2'],
    ])
  })

  test('addSourcemapLocation maps only with hires false, at a char of kept text', () => {
    const s = new EditedString('foo bar\nbaz')
    const hires = segments(s, true)
    // inside a word, on a line end, at a line start
    for (const at of [5, 7, 8]) s.addSourcemapLocation(at)
    expect(segments(s, true)).toEqual(hires)
    expect(segments(s, 'boundary')).toEqual(hires)
    expect(segments(s)).toEqual([['"foo b" 1:0', '"ar" 1:5'], ['"baz" 2:0']])
  })

  test('names are the originals of storeName replacements in the map', () => {
    const s = new EditedString('foo(foo, bar)')
    s.overwrite(0, 3, 'a', { storeName: true })
    s.overwrite(4, 7, 'a', { storeName: true })
    s.overwrite(9, 12, 'b')
    expect(s.generateMap({ hires: true }).names).toEqual(['foo'])
    expect(segments(s, true)).toEqual([
      [
        '"a" 1:0 foo',
        '"(" 1:3',
        '"a" 1:4 foo',
        '"," 1:7',
        '" " 1:8',
        '"b" 1:9',
        '")" 1:12',
      ],
    ])

    const t = new EditedString('foo bar')
    t.overwrite(0, 3, 'x', { storeName: true })
    expect(t.clone().generateMap({ hires: true }).names).toEqual([])
    t.remove(0, 4)
    expect(t.generateMap({ hires: true }).names).toEqual([])
  })

  test('every segment of kept text maps to the same text', () => {
    const src = 'const a = 1\nfunction f(x) {\n  return x * 2\n}\n'
    const s = new EditedString(src)
    s.prependRight(28, '  debugger\n')
    s.appendLeft(23, 'y, ')
    s.remove(30, 37)
    s.move(0, 12, src.length)
    s.addSourcemapLocation(40)
    const out = s.toString().split('\n')
    const lines = src.split('\n')
    for (const hires of [true, 'boundary', false] as const) {
      const { mappings } = s.generateDecodedMap({ hires })
      let sourced = 0
      mappings.forEach((segs, line) =>
        segs.forEach((seg, i) => {
          if (seg.length === 1) return
          sourced++
          const text = out[line].slice(
            seg[0],
            i + 1 < segs.length ? segs[i + 1][0] : undefined,
          )
          expect(lines[seg[2]].slice(seg[3], seg[3] + text.length)).toBe(text)
        }),
      )
      expect(sourced).toBeGreaterThan(0)
    }
  })
})
