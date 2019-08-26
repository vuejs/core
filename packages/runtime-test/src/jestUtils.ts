declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenWarned(): R
      toHaveBeenWarnedLast(): R
      toHaveBeenWarnedTimes(n: number): R
    }
  }
}

export function mockWarn() {
  expect.extend({
    toHaveBeenWarned(received: string) {
      const passed = warn.mock.calls.some(
        args => args[0].indexOf(received) > -1
      )
      if (passed) {
        return {
          pass: true,
          message: () => `expected "${received}" not to have been warned.`
        }
      } else {
        const msgs = warn.mock.calls.map(args => args[0]).join('\n - ')
        return {
          pass: false,
          message: () =>
            `expected "${received}" to have been warned.\n\nActual messages:\n\n - ${msgs}`
        }
      }
    },

    toHaveBeenWarnedLast(received: string) {
      const passed =
        warn.mock.calls[warn.mock.calls.length - 1][0].indexOf(received) > -1
      if (passed) {
        return {
          pass: true,
          message: () => `expected "${received}" not to have been warned last.`
        }
      } else {
        const msgs = warn.mock.calls.map(args => args[0]).join('\n - ')
        return {
          pass: false,
          message: () =>
            `expected "${received}" to have been warned last.\n\nActual messages:\n\n - ${msgs}`
        }
      }
    },

    toHaveBeenWarnedTimes(received: string, n: number) {
      let found = 0
      warn.mock.calls.forEach(args => {
        if (args[0].indexOf(received) > -1) {
          found++
        }
      })
      if (found > 0) {
        return {
          pass: true,
          message: () =>
            `expected "${received}" not to have been warned ${n} times.`
        }
      } else {
        return {
          pass: false,
          message: () =>
            `expected "${received}" to have been warned ${n} times but got ${found}.`
        }
      }
    }
  })

  let warn: jest.SpyInstance

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn')
    warn.mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })
}
