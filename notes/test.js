let createApp = () => {
  const app = Object.create(null, {
    test: {
      configurable: true,
      writable: true,
      enumerable: true,
      value: a => {
        console.log('run test', a)
      }
    }
  })
  const test = app.test
  app.test = a => {
    a += 'validate'
    return test(a)
  }
  return app
}

let app = createApp()
app.test('input')
