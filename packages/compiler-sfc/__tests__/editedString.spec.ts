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
})
