import { type Locator, page, userEvent } from 'vitest/browser'

export const css = (css: string) => page.getByCSS(css)
export const E2E_TIMEOUT: number = 10 * 1000

const duration = 50
export function timeout(time: number) {
  return new Promise(r => {
    setTimeout(r, time)
  })
}

export const transitionFinish = (time = duration) => timeout(time)

export const nextFrame = () =>
  new Promise(resolve => {
    requestAnimationFrame(resolve)
  })

export const click = (selector: string) => {
  ;(css(selector).element() as HTMLButtonElement).click()
}

export async function enterValue(locator: Locator, text: string) {
  await locator.fill(text)
  await userEvent.type(locator, '{enter}')
}

export function expectTransitionSnapshotSequence(
  btnSelector: string,
  containerSelector: string,
  expectedSnapshots: string[],
  frameLimit = 20,
) {
  const button = css(btnSelector).element() as HTMLButtonElement
  const container = css(containerSelector).element() as HTMLElement

  return new Promise<string[]>((resolve, reject) => {
    const snapshots: string[] = []

    const finish = (
      fn: typeof resolve | typeof reject,
      value: string[] | Error,
    ) => {
      fn(value as never)
    }

    const capture = () => {
      const html = container.innerHTML
      if (snapshots[snapshots.length - 1] !== html) {
        snapshots.push(html)
      }
      const snapshotIndexes = expectedSnapshots.map(snapshot =>
        snapshots.indexOf(snapshot),
      )
      if (snapshotIndexes.every(index => index >= 0)) {
        const isInOrder = snapshotIndexes.every((index, current) => {
          return current === 0 || index > snapshotIndexes[current - 1]
        })

        if (isInOrder) {
          finish(resolve, snapshots)
          return
        }

        finish(
          reject,
          new Error(
            `Snapshots were captured out of order.\n${snapshots.join('\n---\n')}`,
          ),
        )
        return
      }
    }

    capture()
    button.click()
    Promise.resolve().then(() => {
      capture()

      let remainingFrames = frameLimit
      const poll = () => {
        capture()
        if (expectedSnapshots.every(snapshot => snapshots.includes(snapshot))) {
          return
        }
        if (remainingFrames-- === 0) {
          finish(
            reject,
            new Error(
              `Timed out waiting for snapshots.\n${snapshots.join('\n---\n')}`,
            ),
          )
          return
        }
        requestAnimationFrame(poll)
      }

      requestAnimationFrame(poll)
    })
  })
}
