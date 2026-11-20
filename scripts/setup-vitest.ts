import type { MockInstance } from 'vitest'

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

interface CustomMatchers<R = unknown> {
  toHaveBeenWarned(): R
  toHaveBeenWarnedLast(): R
  toHaveBeenWarnedTimes(n: number): R
  toHaveBeenErrored(): R
}

vi.stubGlobal('MathMLElement', class MathMLElement {})

expect.extend({
  toHaveBeenWarned(received: string) {
    const passed = warn.mock.calls.some(args => args[0].includes(received))
    if (passed) {
      asserted.add(received)
      return {
        pass: true,
        message: () => `expected "${received}" not to have been warned.`,
      }
    } else {
      const msgs = warn.mock.calls.map(args => args[0]).join('\n - ')
      return {
        pass: false,
        message: () =>
          `expected "${received}" to have been warned` +
          (msgs.length
            ? `.\n\nActual messages:\n\n - ${msgs}`
            : ` but no warning was recorded.`),
      }
    }
  },

  toHaveBeenWarnedLast(received: string) {
    const passed =
      warn.mock.calls[warn.mock.calls.length - 1][0].includes(received)
    if (passed) {
      asserted.add(received)
      return {
        pass: true,
        message: () => `expected "${received}" not to have been warned last.`,
      }
    } else {
      const msgs = warn.mock.calls.map(args => args[0]).join('\n - ')
      return {
        pass: false,
        message: () =>
          `expected "${received}" to have been warned last.\n\nActual messages:\n\n - ${msgs}`,
      }
    }
  },

  toHaveBeenWarnedTimes(received: string, n: number) {
    let found = 0
    warn.mock.calls.forEach(args => {
      if (args[0].includes(received)) {
        found++
      }
    })

    if (found === n) {
      asserted.add(received)
      return {
        pass: true,
        message: () => `expected "${received}" to have been warned ${n} times.`,
      }
    } else {
      return {
        pass: false,
        message: () =>
          `expected "${received}" to have been warned ${n} times but got ${found}.`,
      }
    }
  },

  toHaveBeenErrored(received: string) {
    const passed = error.mock.calls.some(args =>
      String(args[0]).includes(received),
    )
    if (passed) {
      assertedErrors.add(received)
    }
    return {
      pass: passed,
      message: () =>
        passed
          ? `expected "${received}" not to have been errored.`
          : `expected "${received}" to have been errored.`,
    }
  },
})

let warn: MockInstance
let error: MockInstance
const asserted: Set<string> = new Set()
const assertedErrors: Set<string> = new Set()

beforeEach(() => {
  asserted.clear()
  assertedErrors.clear()
  warn = vi.spyOn(console, 'warn')
  warn.mockImplementation(() => {})
  error = vi.spyOn(console, 'error')
  error.mockImplementation(() => {})
})

afterEach(() => {
  const assertedArray = Array.from(asserted)
  const nonAssertedWarnings = warn.mock.calls
    .map(args => args[0])
    .filter(received => {
      return !assertedArray.some(assertedMsg => {
        return received.includes(assertedMsg)
      })
    })
  const nonAssertedErrors = error.mock.calls.filter(
    args =>
      !Array.from(assertedErrors).some(assertedMsg =>
        String(args[0]).includes(assertedMsg),
      ),
  )
  warn.mockRestore()
  error.mockRestore()
  // keep the errors that the test did not check in the output
  nonAssertedErrors.forEach(args => console.error(...args))
  if (nonAssertedWarnings.length) {
    throw new Error(
      `test case threw unexpected warnings:\n - ${nonAssertedWarnings.join(
        '\n - ',
      )}`,
    )
  }
})
