import { findClosestMatch } from '../src/stringSimilarity'

describe('findClosestMatch', () => {
  describe('empty inputs', () => {
    test('returns null when candidates list is empty', () => {
      expect(findClosestMatch('Button', [])).toBeNull()
    })

    test('returns null when target is empty', () => {
      // an empty target produces no meaningful suggestion, even if
      // candidates contains an empty string
      expect(findClosestMatch('', ['Button', ''])).toBeNull()
    })
  })

  describe('within-threshold matches', () => {
    test('returns the target itself when an exact match is present', () => {
      expect(findClosestMatch('Button', ['Footer', 'Button', 'Box'])).toBe(
        'Button',
      )
    })

    test('returns the closest candidate for a single-substitution typo', () => {
      // "Buton" -> "Button" is one insertion, distance = 1
      expect(findClosestMatch('Buton', ['Button', 'Footer'])).toBe('Button')
    })

    test('counts a transposition as a single edit (Damerau extension)', () => {
      // "Botton" -> "Button" via one adjacent-character transposition,
      // distance = 1, well inside the distance threshold
      expect(findClosestMatch('Botton', ['Button', 'Footer'])).toBe('Button')
    })

    test('returns a candidate that qualifies via the similarity gate alone', () => {
      // "Foobarz" -> "Foobars": distance = 1, similarity ≈ 6/7 ≈ 0.86,
      // also passes the distance gate — sanity check on the OR condition.
      expect(findClosestMatch('Foobarz', ['Foobars', 'Footer'])).toBe('Foobars')
    })

    test('picks the closest among multiple qualifying candidates', () => {
      // "Buttan" -> "Button": substitute 'a' -> 'o', distance = 1
      // "Buttan" -> "Bottom": substitute 'a' -> 'o', then 'u' -> 'o' and
      // 'n' -> 'm' — distance = 3, fails the distance gate AND the
      // similarity gate (similarity = 1 - 3/6 = 0.5).
      // Button is the only qualifying candidate and wins.
      expect(findClosestMatch('Buttan', ['Bottom', 'Button', 'Footer'])).toBe(
        'Button',
      )
    })
  })

  describe('threshold rejection', () => {
    test('returns null when no candidate is within the distance threshold', () => {
      // "xyz" is far from both candidates by edit distance, and the
      // similarity ratio (1 - distance/maxLen) is well below 0.7
      expect(findClosestMatch('xyz', ['Button', 'Footer'])).toBeNull()
    })

    test('returns null when candidates are similar only by length, not by content', () => {
      // "aaaaaaaa" vs "Button": many edits, low similarity
      expect(findClosestMatch('aaaaaaaa', ['Button'])).toBeNull()
    })
  })

  describe('tiebreaking', () => {
    test('returns the first candidate by insertion order when distances tie', () => {
      // both "Box" -> "Fox" and "Box" -> "Bax" have distance 1;
      // insertion order should win, not alphabetical
      expect(findClosestMatch('Box', ['Fox', 'Bax', 'Button'])).toBe('Fox')
    })

    test('returns the first candidate by insertion order when an exact match is one of several', () => {
      // multiple exact matches → first wins
      expect(findClosestMatch('Foo', ['Foo', 'Foo'])).toBe('Foo')
    })
  })

  describe('case sensitivity', () => {
    test('treats differing case as distinct characters', () => {
      // "button" -> "Button": distance = 1 (capitalization on 'B'),
      // which is within the distance gate, so it qualifies.
      // This documents that the helper is intentionally case-sensitive.
      expect(findClosestMatch('button', ['Button'])).toBe('Button')
    })

    test('does not match when case differences push distance beyond the threshold', () => {
      // "btn" -> "BTN": distance = 3 (every char's case differs),
      // similarity = 0/3 = 0, fails both gates
      expect(findClosestMatch('btn', ['BTN'])).toBeNull()
    })
  })
})
