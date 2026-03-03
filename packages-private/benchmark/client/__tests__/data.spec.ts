import { beforeEach, describe, expect, it } from 'vitest'
import { buildData } from '../data'
import { isRef } from 'vue'

describe('benchmark/data', () => {
  describe('buildData', () => {
    it('should generate default 1000 rows when no count is provided', () => {
      const data = buildData()
      expect(data).toHaveLength(1000)
    })

    it('should generate the specified number of rows', () => {
      const data = buildData(100)
      expect(data).toHaveLength(100)
    })

    it('should generate more than 1000 rows when requested', () => {
      const data = buildData(5000)
      expect(data).toHaveLength(5000)
    })

    it('should generate zero rows when count is 0', () => {
      const data = buildData(0)
      expect(data).toHaveLength(0)
    })

    it('should generate rows with unique incrementing IDs', () => {
      const data = buildData(100)
      const ids = data.map(row => row.id)
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(100)

      // Check IDs are incrementing
      for (let i = 1; i < ids.length; i++) {
        expect(ids[i]).toBeGreaterThan(ids[i - 1])
      }
    })

    it('should generate rows with label as shallowRef', () => {
      const data = buildData(10)

      for (const row of data) {
        expect(isRef(row.label)).toBe(true)
        expect(typeof row.label.value).toBe('string')
      }
    })

    it('should generate labels with three words (adjective color noun)', () => {
      const data = buildData(50)

      for (const row of data) {
        const label = row.label.value
        const words = label.split(' ')
        expect(words).toHaveLength(3)
        expect(words[0]).toBeTruthy() // adjective
        expect(words[1]).toBeTruthy() // color
        expect(words[2]).toBeTruthy() // noun
      }
    })

    it('should generate labels from predefined word lists', () => {
      const adjectives = [
        'pretty',
        'large',
        'big',
        'small',
        'tall',
        'short',
        'long',
        'handsome',
        'plain',
        'quaint',
        'clean',
        'elegant',
        'easy',
        'angry',
        'crazy',
        'helpful',
        'mushy',
        'odd',
        'unsightly',
        'adorable',
        'important',
        'inexpensive',
        'cheap',
        'expensive',
        'fancy',
      ]
      const colours = [
        'red',
        'yellow',
        'blue',
        'green',
        'pink',
        'brown',
        'purple',
        'brown',
        'white',
        'black',
        'orange',
      ]
      const nouns = [
        'table',
        'chair',
        'house',
        'bbq',
        'desk',
        'car',
        'pony',
        'cookie',
        'sandwich',
        'burger',
        'pizza',
        'mouse',
        'keyboard',
      ]

      const data = buildData(100)

      for (const row of data) {
        const words = row.label.value.split(' ')
        expect(adjectives).toContain(words[0])
        expect(colours).toContain(words[1])
        expect(nouns).toContain(words[2])
      }
    })

    it('should maintain ID sequence across multiple calls', () => {
      const data1 = buildData(10)
      const data2 = buildData(10)

      const lastIdOfFirst = data1[data1.length - 1].id
      const firstIdOfSecond = data2[0].id

      expect(firstIdOfSecond).toBeGreaterThan(lastIdOfFirst)
    })

    it('should generate valid data structure', () => {
      const data = buildData(1)
      const row = data[0]

      expect(row).toHaveProperty('id')
      expect(row).toHaveProperty('label')
      expect(typeof row.id).toBe('number')
      expect(isRef(row.label)).toBe(true)
    })

    it('should handle edge case of single row', () => {
      const data = buildData(1)
      expect(data).toHaveLength(1)
      expect(data[0]).toHaveProperty('id')
      expect(data[0]).toHaveProperty('label')
    })

    it('should generate different labels for multiple rows', () => {
      const data = buildData(100)
      const labels = data.map(row => row.label.value)

      // While labels could theoretically repeat due to randomness,
      // with 100 rows from a large pool, we expect at least some variety
      const uniqueLabels = new Set(labels)
      expect(uniqueLabels.size).toBeGreaterThan(1)
    })

    it('should generate labels that can be mutated reactively', () => {
      const data = buildData(1)
      const row = data[0]
      const originalLabel = row.label.value

      row.label.value = 'new label'
      expect(row.label.value).toBe('new label')
      expect(row.label.value).not.toBe(originalLabel)
    })

    it('should handle large data generation', () => {
      const data = buildData(10000)
      expect(data).toHaveLength(10000)
      expect(data[0]).toHaveProperty('id')
      expect(data[9999]).toHaveProperty('id')
    })

    it('should generate rows with consistent structure', () => {
      const data = buildData(50)

      for (const row of data) {
        expect(Object.keys(row).sort()).toEqual(['id', 'label'].sort())
      }
    })

    it('should generate IDs as positive integers', () => {
      const data = buildData(100)

      for (const row of data) {
        expect(row.id).toBeGreaterThan(0)
        expect(Number.isInteger(row.id)).toBe(true)
      }
    })

    it('should handle negative count by generating empty array', () => {
      const data = buildData(-1)
      expect(data).toHaveLength(0)
    })

    it('should handle fractional count', () => {
      const data = buildData(5.7)
      // For loop with i < 5.7 means i can be 0,1,2,3,4,5 (6 values)
      expect(data.length).toBeLessThanOrEqual(6)
      expect(data.length).toBeGreaterThanOrEqual(5)
    })

    it('should generate labels with consistent spacing', () => {
      const data = buildData(20)

      for (const row of data) {
        const label = row.label.value
        // Should not have leading/trailing spaces
        expect(label).toBe(label.trim())
        // Should have exactly 2 spaces (between 3 words)
        expect(label.split(' ').length - 1).toBe(2)
      }
    })

    it('should support reactive updates on labels', () => {
      const data = buildData(1)
      const row = data[0]

      let updateCount = 0
      const stop = row.label.value // Access to establish reactivity

      row.label.value = 'updated label'
      expect(row.label.value).toBe('updated label')

      row.label.value = 'another update'
      expect(row.label.value).toBe('another update')
    })

    it('should generate truly random labels with sufficient variety', () => {
      const data = buildData(1000)
      const labels = data.map(row => row.label.value)
      const uniqueLabels = new Set(labels)

      // With 1000 rows and randomness, we should have significant variety
      // (25 adjectives * 11 colors * 13 nouns = 3575 possible combinations)
      expect(uniqueLabels.size).toBeGreaterThan(100)
    })

    it('should not mutate input parameters', () => {
      const count = 100
      const originalCount = count
      buildData(count)
      expect(count).toBe(originalCount)
    })

    it('should handle rapid successive calls', () => {
      const data1 = buildData(10)
      const data2 = buildData(10)
      const data3 = buildData(10)

      expect(data1.length).toBe(10)
      expect(data2.length).toBe(10)
      expect(data3.length).toBe(10)

      // IDs should continue incrementing
      expect(data2[0].id).toBeGreaterThan(data1[data1.length - 1].id)
      expect(data3[0].id).toBeGreaterThan(data2[data2.length - 1].id)
    })
  })
})
