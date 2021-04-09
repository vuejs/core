import Vue from '@vue/compat'

describe('compat: global API', () => {
  test('should work', async () => {
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
