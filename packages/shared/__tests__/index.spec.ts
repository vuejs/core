import { uniq } from '@vue/shared'

describe('shared', () => {
  describe('uniq', () => {
    it('should return the same items', () => {
      const uniqueItems = ['1', '2', '3']

      expect(uniq(uniqueItems)).toMatchObject(uniqueItems)
    })
    it('should get unique items', () => {
      const uniqueItems = ['1', '2', '3']
      const array = Array.from(uniqueItems, x => [x, x, x]).reduce((p, c) => {
        p.push(...c)
        return p
      }, [])

      expect(uniq(array)).toMatchObject(uniqueItems)
    })

    it('should get unique functions', () => {
      const uniqueItems = [() => '1', () => '2', () => '3']
      const array = Array.from(uniqueItems, x => [x, x, x]).reduce((p, c) => {
        p.push(...c)
        return p
      }, [])

      expect(uniq(array)).toMatchObject(uniqueItems)
    })
  })
})
