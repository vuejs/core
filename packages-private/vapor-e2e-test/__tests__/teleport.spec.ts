import path from 'node:path'
import {
  E2E_TIMEOUT,
  setupPuppeteer,
} from '../../../packages/vue/__tests__/e2e/e2eUtils'
import connect from 'connect'
import sirv from 'sirv'

const { page, click, html } = setupPuppeteer()

describe('vapor teleport', () => {
  let server: any
  const port = '8197'

  beforeAll(() => {
    server = connect()
      .use(sirv(path.resolve(import.meta.dirname, '../dist')))
      .listen(port)
    process.on('SIGTERM', () => server && server.close())
  })

  afterAll(() => {
    server.close()
  })

  beforeEach(async () => {
    const baseUrl = `http://localhost:${port}/teleport/`
    await page().goto(baseUrl)
    await page().waitForSelector('#app')
  })

  describe('teleport with moveBefore', () => {
    test(
      'should preserve video playback state when toggling disabled',
      async () => {
        const btnSelector = '#toggleDisabled'
        const targetSelector = '.teleport-move-test > .target'
        const mainSelector = '.teleport-move-test > .main'

        // wait for video to start playing
        await page().waitForFunction(() => {
          const video = document.querySelector(
            '.teleport-move-test video',
          ) as HTMLVideoElement
          return video && video.currentTime > 0
        })

        // video should be in target initially (disabled=false)
        expect(await html(targetSelector)).toContain('<video')
        expect(await html(mainSelector)).not.toContain('<video')

        // record current time and playing state
        const timeBefore = await page().evaluate(() =>
          (window as any).getVideoTime(),
        )
        const playingBefore = await page().evaluate(() =>
          (window as any).isVideoPlaying(),
        )
        expect(playingBefore).toBe(true)
        expect(timeBefore).toBeGreaterThan(0)

        // toggle disabled (move to main)
        await click(btnSelector)

        // video should now be in main
        expect(await html(mainSelector)).toContain('<video')
        expect(await html(targetSelector)).not.toContain('<video')

        // check video state is preserved (time should be >= before, still playing)
        const timeAfter = await page().evaluate(() =>
          (window as any).getVideoTime(),
        )
        const playingAfter = await page().evaluate(() =>
          (window as any).isVideoPlaying(),
        )

        // video should still be playing
        expect(playingAfter).toBe(true)
        // time should have continued (not reset to 0)
        // allow small tolerance for timing
        expect(timeAfter).toBeGreaterThanOrEqual(timeBefore)

        // toggle back (move to target)
        await click(btnSelector)

        // video should be back in target
        expect(await html(targetSelector)).toContain('<video')
        expect(await html(mainSelector)).not.toContain('<video')

        // should still be playing
        const playingFinal = await page().evaluate(() =>
          (window as any).isVideoPlaying(),
        )
        expect(playingFinal).toBe(true)
      },
      E2E_TIMEOUT,
    )
  })
})
