import {
  isRelativeUrl,
  isExternalUrl
} from '../../compiler-sfc/src/templateUtils'

describe('compiler sfc:templateUtils isRelativeUrl', () => {
  test('should return true when The first character of the string path is .', () => {
    const url = './**.vue'
    const result = isRelativeUrl(url)
    expect(result).toBe(true)
  })

  test('should return true when The first character of the string path is ~', () => {
    const url = '~/xx.vue'
    const result = isRelativeUrl(url)
    expect(result).toBe(true)
  })

  test('should return true when The first character of the string path is @', () => {
    const url = '@/xx.vue'
    const result = isRelativeUrl(url)
    expect(result).toBe(true)
  })
})

describe('compiler sfc:templateUtils isExternalUrl', () => {
  test('should return true when String starts with http://', () => {
    const url = 'http://vuejs.org/'
    const result = isExternalUrl(url)
    expect(result).toBe(true)
  })

  test('should return true when String starts with https://', () => {
    const url = 'https://vuejs.org/'
    const result = isExternalUrl(url)
    expect(result).toBe(true)
  })
})
