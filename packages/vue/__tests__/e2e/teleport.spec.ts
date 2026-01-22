import { once } from 'node:events'
import { createServer } from 'node:http'
import path from 'node:path'
import { beforeAll } from 'vitest'
import serveHandler from 'serve-handler'

import { E2E_TIMEOUT, setupPuppeteer } from './e2eUtils'

const serverRoot = path.resolve(import.meta.dirname, '../../')
const testPort = 9091
const basePath = path.relative(
  serverRoot,
  path.resolve(import.meta.dirname, './teleport.html'),
)
const baseUrl = `http://localhost:${testPort}/${basePath}`

const { page, click, html } = setupPuppeteer()

let server: ReturnType<typeof createServer>
beforeAll(async () => {
  server = createServer((req, res) => {
    return serveHandler(req, res, {
      public: serverRoot,
      cleanUrls: false,
    })
  })

  server.listen(testPort)
  await once(server, 'listening')
})

afterAll(async () => {
  server.close()
  await once(server, 'close')
})

describe('e2e: Teleport', () => {
  beforeEach(async () => {
    await page().goto(baseUrl)
    await page().waitForSelector('#app')
  })

  test(
    'should preserve video playback state when toggling disabled',
    async () => {
      await page().evaluate(() => {
        const { createApp, ref, h, Teleport } = (window as any).Vue

        createApp({
          setup() {
            const disabled = ref(true)
            return () =>
              h('div', [
                h(
                  'button',
                  {
                    id: 'toggle',
                    onClick: () => {
                      disabled.value = !disabled.value
                    },
                  },
                  'Toggle',
                ),
                h(
                  Teleport,
                  { to: '#target', disabled: disabled.value },
                  h('video', {
                    id: 'video',
                    src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm',
                    controls: true,
                    muted: true,
                    loop: true,
                    autoplay: true,
                  }),
                ),
              ])
          },
        }).mount('#app')
      })

      // Wait for video element
      await page().waitForSelector('#video')

      // Start playing the video and get initial currentTime
      await page().evaluate(() => {
        const video = document.querySelector('#video') as HTMLVideoElement
        video.currentTime = 5
        video.play()
      })

      // Wait a bit for playback
      await page().evaluate(
        () => new Promise(resolve => setTimeout(resolve, 100)),
      )

      // Get currentTime before toggle
      const timeBefore = await page().evaluate(() => {
        const video = document.querySelector('#video') as HTMLVideoElement
        return video.currentTime
      })

      // Toggle disabled (move from main container to target)
      await click('#toggle')

      // Wait for DOM update
      await page().evaluate(
        () => new Promise(resolve => setTimeout(resolve, 50)),
      )

      // Get currentTime after toggle
      const timeAfter = await page().evaluate(() => {
        const video = document.querySelector('#video') as HTMLVideoElement
        return video.currentTime
      })

      // Video should be in target now
      expect(await html('#target')).toContain('<video')

      // If moveBefore is supported, the time difference should be small
      // (playback continues). If not supported, video restarts from 0.
      // We check that the video didn't restart (time didn't reset to near 0)
      const supportsMoveBefore = await page().evaluate(() => {
        return 'moveBefore' in HTMLElement.prototype
      })

      if (supportsMoveBefore) {
        // With moveBefore, playback state should be preserved
        // timeAfter should be >= timeBefore (or very close, accounting for playback)
        expect(timeAfter).toBeGreaterThanOrEqual(timeBefore)
      }
    },
    E2E_TIMEOUT,
  )
})
