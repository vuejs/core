import Vue from '@vue/compat'

describe('compat: global API', () => {
  beforeEach(() => Vue.configureCompat({ MODE: 2 }))
  afterEach(() => Vue.configureCompat({ MODE: 3 }))

  test('should work', () => {
    const el = document.createElement('div')
    el.innerHTML = `{{ msg }}`
    new Vue({
      el,
      data() {
        return {
          msg: 'hello'
        }
      }
    })
    expect('global app bootstrapping API has changed').toHaveBeenWarned()
    expect(el.innerHTML).toBe('hello')
  })
})
