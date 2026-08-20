import {
  VaporTeleport,
  createComponent,
  createVaporSSRApp,
  defineVaporComponent,
  template,
  useVaporCssVars,
} from '../../src'
import { nextTick, reactive, ref } from '@vue/runtime-dom'
import type { VaporComponentInstance } from '../../src/component'
import type { TeleportFragment } from '../../src/components/Teleport'
import { VueServerRenderer, compile, runtimeDom } from '../_utils'
import {
  compileVaporComponent,
  formatHtml,
  mountWithHydration,
  setupHydrationTest,
  triggerEvent,
} from './_helpers'

setupHydrationTest()

describe('Vapor Mode hydration', () => {
  describe('teleport', () => {
    test('basic', async () => {
      const data = ref({
        msg: ref('foo'),
        disabled: ref(false),
        fn: vi.fn(),
      })

      const teleportContainer = document.createElement('div')
      teleportContainer.id = 'teleport'
      teleportContainer.innerHTML =
        `<!--teleport start anchor-->` +
        `<span>foo</span>` +
        `<span class="foo"></span>` +
        `<!--teleport anchor-->`
      document.body.appendChild(teleportContainer)

      const { block, container } = await mountWithHydration(
        '<!--teleport start--><!--teleport end-->',
        `<teleport to="#teleport" :disabled="data.disabled">
          <span>{{data.msg}}</span>
          <span :class="data.msg" @click="data.fn"></span>
        </teleport>`,
        data,
      )

      const teleport = block as TeleportFragment
      expect(teleport.anchor).toBe(container.lastChild)
      expect(teleport.target).toBe(teleportContainer)
      expect(teleport.targetStart).toBe(teleportContainer.childNodes[0])
      expect((teleport.nodes as Node[])[0]).toBe(
        teleportContainer.childNodes[1],
      )
      expect((teleport.nodes as Node[])[1]).toBe(
        teleportContainer.childNodes[2],
      )
      expect(teleport.targetAnchor).toBe(teleportContainer.childNodes[3])

      expect(container.innerHTML).toMatchInlineSnapshot(
        `"<!--teleport start--><!--teleport end-->"`,
      )

      // event handler
      triggerEvent('click', teleportContainer.querySelector('.foo')!)
      expect(data.value.fn).toHaveBeenCalled()

      data.value.msg = 'bar'
      await nextTick()
      expect(formatHtml(teleportContainer.innerHTML)).toBe(
        `<!--teleport start anchor-->` +
          `<span>bar</span>` +
          `<span class="bar"></span>` +
          `<!--teleport anchor-->`,
      )

      data.value.disabled = true
      await nextTick()
      expect(container.innerHTML).toBe(
        `<!--teleport start-->` +
          `<span>bar</span>` +
          `<span class="bar"></span>` +
          `<!--teleport end-->`,
      )
      expect(formatHtml(teleportContainer.innerHTML)).toMatchInlineSnapshot(
        `"<!--teleport start anchor--><!--teleport anchor-->"`,
      )

      data.value.msg = 'baz'
      await nextTick()
      expect(container.innerHTML).toBe(
        `<!--teleport start-->` +
          `<span>baz</span>` +
          `<span class="baz"></span>` +
          `<!--teleport end-->`,
      )

      data.value.disabled = false
      await nextTick()
      expect(container.innerHTML).toMatchInlineSnapshot(
        `"<!--teleport start--><!--teleport end-->"`,
      )
      expect(formatHtml(teleportContainer.innerHTML)).toBe(
        `<!--teleport start anchor-->` +
          `<span>baz</span>` +
          `<span class="baz"></span>` +
          `<!--teleport anchor-->`,
      )
    })

    test('multiple + integration', async () => {
      const data = ref({
        msg: ref('foo'),
        fn1: vi.fn(),
        fn2: vi.fn(),
      })

      const code = `
          <teleport to="#teleport2">
            <span>{{data.msg}}</span>
            <span :class="data.msg" @click="data.fn1"></span>
          </teleport>
          <teleport to="#teleport2">
            <span>{{data.msg}}2</span>
            <span :class="data.msg + 2" @click="data.fn2"></span>
          </teleport>`

      const SSRComp = compileVaporComponent(code, data, undefined, true)
      const teleportContainer = document.createElement('div')
      teleportContainer.id = 'teleport2'
      const ctx = {} as any
      const mainHtml = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRComp),
        ctx,
      )
      expect(mainHtml).toBe(
        `<!--[-->` +
          `<!--teleport start--><!--teleport end-->` +
          `<!--teleport start--><!--teleport end-->` +
          `<!--]-->`,
      )

      const teleportHtml = ctx.teleports!['#teleport2']
      expect(teleportHtml).toBe(
        `<!--teleport start anchor-->` +
          `<span>foo</span><span class="foo"></span>` +
          `<!--teleport anchor-->` +
          `<!--teleport start anchor-->` +
          `<span>foo2</span><span class="foo2"></span>` +
          `<!--teleport anchor-->`,
      )

      teleportContainer.innerHTML = teleportHtml
      document.body.appendChild(teleportContainer)

      const { block, container } = await mountWithHydration(
        mainHtml,
        code,
        data,
      )

      const teleports = block as any as TeleportFragment[]
      const teleport1 = teleports[0]
      const teleport2 = teleports[1]
      expect(teleport1.anchor).toBe(container.childNodes[2])
      expect(teleport2.anchor).toBe(container.childNodes[4])

      expect(teleport1.target).toBe(teleportContainer)
      expect(teleport1.targetStart).toBe(teleportContainer.childNodes[0])
      expect((teleport1.nodes as Node[])[0]).toBe(
        teleportContainer.childNodes[1],
      )
      expect(teleport1.targetAnchor).toBe(teleportContainer.childNodes[3])

      expect(teleport2.target).toBe(teleportContainer)
      expect(teleport2.targetStart).toBe(teleportContainer.childNodes[4])
      expect((teleport2.nodes as Node[])[0]).toBe(
        teleportContainer.childNodes[5],
      )
      expect(teleport2.targetAnchor).toBe(teleportContainer.childNodes[7])

      expect(container.innerHTML).toBe(
        `<!--[-->` +
          `<!--teleport start--><!--teleport end-->` +
          `<!--teleport start--><!--teleport end-->` +
          `<!--]-->`,
      )

      // event handler
      triggerEvent('click', teleportContainer.querySelector('.foo')!)
      expect(data.value.fn1).toHaveBeenCalled()

      triggerEvent('click', teleportContainer.querySelector('.foo2')!)
      expect(data.value.fn2).toHaveBeenCalled()

      data.value.msg = 'bar'
      await nextTick()
      expect(teleportContainer.innerHTML).toBe(
        `<!--teleport start anchor-->` +
          `<span>bar</span>` +
          `<span class="bar"></span>` +
          `<!--teleport anchor-->` +
          `<!--teleport start anchor-->` +
          `<span>bar2</span>` +
          `<span class="bar2"></span>` +
          `<!--teleport anchor-->`,
      )
    })

    test('disabled', async () => {
      const data = ref({
        msg: ref('foo'),
        fn1: vi.fn(),
        fn2: vi.fn(),
      })

      const code = `
          <div>foo</div>
          <teleport to="#teleport3" disabled="true">
            <span>{{data.msg}}</span>
            <span :class="data.msg" @click="data.fn1"></span>
          </teleport>
          <div :class="data.msg + 2" @click="data.fn2">bar</div>
          `

      const SSRComp = compileVaporComponent(code, data, undefined, true)
      const teleportContainer = document.createElement('div')
      teleportContainer.id = 'teleport3'
      const ctx = {} as any
      const mainHtml = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRComp),
        ctx,
      )
      expect(mainHtml).toBe(
        `<!--[-->` +
          `<div>foo</div>` +
          `<!--teleport start-->` +
          `<span>foo</span>` +
          `<span class="foo"></span>` +
          `<!--teleport end-->` +
          `<div class="foo2">bar</div>` +
          `<!--]-->`,
      )

      const teleportHtml = ctx.teleports!['#teleport3']
      expect(teleportHtml).toMatchInlineSnapshot(
        `"<!--teleport start anchor--><!--teleport anchor-->"`,
      )

      teleportContainer.innerHTML = teleportHtml
      document.body.appendChild(teleportContainer)

      const { block, container } = await mountWithHydration(
        mainHtml,
        code,
        data,
      )

      const blocks = block as any[]
      expect(blocks[0]).toBe(container.childNodes[1])

      const teleport = blocks[1] as TeleportFragment
      expect((teleport.nodes as Node[])[0]).toBe(container.childNodes[3])
      expect((teleport.nodes as Node[])[1]).toBe(container.childNodes[4])
      expect(teleport.anchor).toBe(container.childNodes[5])
      expect(teleport.target).toBe(teleportContainer)
      expect(teleport.targetStart).toBe(teleportContainer.childNodes[0])
      expect(teleport.targetAnchor).toBe(teleportContainer.childNodes[1])
      expect(blocks[2]).toBe(container.childNodes[6])

      expect(container.innerHTML).toBe(
        `<!--[-->` +
          `<div>foo</div>` +
          `<!--teleport start-->` +
          `<span>foo</span>` +
          `<span class="foo"></span>` +
          `<!--teleport end-->` +
          `<div class="foo2">bar</div>` +
          `<!--]-->`,
      )

      // event handler
      triggerEvent('click', container.querySelector('.foo')!)
      expect(data.value.fn1).toHaveBeenCalled()

      triggerEvent('click', container.querySelector('.foo2')!)
      expect(data.value.fn2).toHaveBeenCalled()

      data.value.msg = 'bar'
      await nextTick()
      expect(container.innerHTML).toBe(
        `<!--[-->` +
          `<div>foo</div>` +
          `<!--teleport start-->` +
          `<span>bar</span>` +
          `<span class="bar"></span>` +
          `<!--teleport end-->` +
          `<div class="bar2">bar</div>` +
          `<!--]-->`,
      )
    })

    test('nested disabled teleport hydration should locate correct end anchor', async () => {
      const data = ref({ msg: ref('after') })
      const { block, container } = await mountWithHydration(
        `<!--[-->` +
          `<!--teleport start-->` +
          `<div>outer</div>` +
          `<!--teleport start-->` +
          `<div>inner</div>` +
          `<!--teleport end-->` +
          `<!--teleport end-->` +
          `<div>after</div>` +
          `<!--]-->`,
        `<teleport to="body" disabled>
          <div>outer</div>
          <teleport to="body" disabled>
            <div>inner</div>
          </teleport>
        </teleport>
        <div>{{data.msg}}</div>`,
        data,
      )

      const blocks = block as any[]
      const outerTeleport = blocks[0] as TeleportFragment
      // The outer teleport's anchor must be the LAST <!--teleport end-->,
      // NOT the inner one. If locateTeleportEndAnchor doesn't handle nesting,
      // it would incorrectly pick the inner <!--teleport end-->.
      const allEndComments = Array.from(container.childNodes).filter(
        n => n.nodeType === 8 && (n as Comment).data === 'teleport end',
      )
      expect(allEndComments.length).toBe(2)
      expect(outerTeleport.anchor).toBe(allEndComments[1]) // must be the LAST one

      // The sibling <div>after</div> should hydrate correctly
      // If the outer anchor is wrong, the hydration cursor is misaligned
      // and the sibling element won't match.
      expect(container.innerHTML).toBe(
        `<!--[-->` +
          `<!--teleport start-->` +
          `<div>outer</div>` +
          `<!--teleport start-->` +
          `<div>inner</div>` +
          `<!--teleport end-->` +
          `<!--teleport end-->` +
          `<div>after</div>` +
          `<!--]-->`,
      )
      expect(`mismatch`).not.toHaveBeenWarned()
    })

    test('multiple disabled teleports hydrating to the same target should consume distinct target anchors', async () => {
      const teleportContainer = document.createElement('div')
      teleportContainer.id = 'teleport-disabled-shared'
      teleportContainer.innerHTML =
        `<!--teleport start anchor-->` +
        `<!--teleport anchor-->` +
        `<!--teleport start anchor-->` +
        `<!--teleport anchor-->`
      document.body.appendChild(teleportContainer)

      const { block } = await mountWithHydration(
        `<!--[-->` +
          `<!--teleport start--><div>one</div><!--teleport end-->` +
          `<!--teleport start--><div>two</div><!--teleport end-->` +
          `<!--]-->`,
        `<teleport to="#teleport-disabled-shared" disabled>
            <div>one</div>
          </teleport>
          <teleport to="#teleport-disabled-shared" disabled>
            <div>two</div>
          </teleport>`,
      )

      const teleports = block as TeleportFragment[]
      expect(teleports[0].targetStart).toBe(teleportContainer.childNodes[0])
      expect(teleports[0].targetAnchor).toBe(teleportContainer.childNodes[1])
      expect(teleports[1].targetStart).toBe(teleportContainer.childNodes[2])
      expect(teleports[1].targetAnchor).toBe(teleportContainer.childNodes[3])
    })

    test('disabled + as component root', async () => {
      const { container } = await mountWithHydration(
        `<!--[-->` +
          `<div>Parent fragment</div>` +
          `<!--teleport start--><div>Teleport content</div><!--teleport end-->` +
          `<!--]-->`,
        `
          <div>Parent fragment</div>
          <teleport to="body" disabled>
            <div>Teleport content</div>
          </teleport>
        `,
      )
      expect(container.innerHTML).toBe(
        `<!--[-->` +
          `<div>Parent fragment</div>` +
          `<!--teleport start-->` +
          `<div>Teleport content</div>` +
          `<!--teleport end-->` +
          `<!--]-->`,
      )
      expect(`mismatch`).not.toHaveBeenWarned()
    })

    test('as component root', async () => {
      const teleportContainer = document.createElement('div')
      teleportContainer.id = 'teleport4'
      teleportContainer.innerHTML = `<!--teleport start anchor-->hello<!--teleport anchor-->`
      document.body.appendChild(teleportContainer)

      const { block, container } = await mountWithHydration(
        '<!--teleport start--><!--teleport end-->',
        `<components.Wrapper></components.Wrapper>`,
        undefined,
        {
          Wrapper: compileVaporComponent(
            `<teleport to="#teleport4">hello</teleport>`,
          ),
        },
      )

      const teleport = (block as VaporComponentInstance)
        .block as TeleportFragment
      expect(teleport.anchor).toBe(container.childNodes[1])
      expect(teleport.target).toBe(teleportContainer)
      expect(teleport.targetStart).toBe(teleportContainer.childNodes[0])
      expect(teleport.nodes).toBe(teleportContainer.childNodes[1])
      expect(teleport.targetAnchor).toBe(teleportContainer.childNodes[2])
    })

    test('nested', async () => {
      const teleportContainer = document.createElement('div')
      teleportContainer.id = 'teleport5'
      teleportContainer.innerHTML =
        `<!--teleport start anchor-->` +
        `<!--teleport start--><!--teleport end-->` +
        `<!--teleport anchor-->` +
        `<!--teleport start anchor-->` +
        `<div>child</div>` +
        `<!--teleport anchor-->`
      document.body.appendChild(teleportContainer)

      const { block, container } = await mountWithHydration(
        '<!--teleport start--><!--teleport end-->',
        `<teleport to="#teleport5">
          <teleport to="#teleport5"><div>child</div></teleport>
        </teleport>`,
      )

      const teleport = block as TeleportFragment
      expect(teleport.anchor).toBe(container.childNodes[1])
      expect(teleport.targetStart).toBe(teleportContainer.childNodes[0])
      expect(teleport.targetAnchor).toBe(teleportContainer.childNodes[3])

      const childTeleport = teleport.nodes as TeleportFragment
      expect(childTeleport.anchor).toBe(teleportContainer.childNodes[2])
      expect(childTeleport.targetStart).toBe(teleportContainer.childNodes[4])
      expect(childTeleport.targetAnchor).toBe(teleportContainer.childNodes[6])
      expect(childTeleport.nodes).toBe(teleportContainer.childNodes[5])
    })

    test('unmount (full integration)', async () => {
      const targetId = 'teleport6'
      const data = ref({
        toggle: ref(true),
      })

      const template1 = `<Teleport to="#${targetId}"><span>Teleported Comp1</span></Teleport>`
      const Comp1 = compileVaporComponent(template1)
      const SSRComp1 = compileVaporComponent(
        template1,
        undefined,
        undefined,
        true,
      )

      const template2 = `<div>Comp2</div>`
      const Comp2 = compileVaporComponent(template2)
      const SSRComp2 = compileVaporComponent(
        template2,
        undefined,
        undefined,
        true,
      )

      const appCode = `
        <div>
          <components.Comp1 v-if="data.toggle"/>
          <components.Comp2 v-else/>
        </div>
      `

      const SSRApp = compileVaporComponent(
        appCode,
        data,
        {
          Comp1: SSRComp1,
          Comp2: SSRComp2,
        },
        true,
      )

      const teleportContainer = document.createElement('div')
      teleportContainer.id = targetId
      document.body.appendChild(teleportContainer)

      const ctx = {} as any
      const mainHtml = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
        ctx,
      )
      expect(mainHtml).toBe(
        '<div><!--teleport start--><!--teleport end--></div>',
      )
      teleportContainer.innerHTML = ctx.teleports![`#${targetId}`]

      const { container } = await mountWithHydration(mainHtml, appCode, data, {
        Comp1,
        Comp2,
      })

      expect(container.innerHTML).toBe(
        '<div><!--teleport start--><!--teleport end--><!--if--></div>',
      )
      expect(teleportContainer.innerHTML).toBe(
        `<!--teleport start anchor-->` +
          `<span>Teleported Comp1</span>` +
          `<!--teleport anchor-->`,
      )
      expect(`mismatch`).not.toHaveBeenWarned()

      data.value.toggle = false
      await nextTick()
      expect(container.innerHTML).toBe('<div><div>Comp2</div><!--if--></div>')
      expect(teleportContainer.innerHTML).toBe('')
    })

    test('unmount (mismatch + full integration)', async () => {
      const targetId = 'teleport7'
      const data = ref({
        toggle: ref(true),
      })

      const template1 = `<Teleport to="#${targetId}"><span>Teleported Comp1</span></Teleport>`
      const Comp1 = compileVaporComponent(template1)
      const SSRComp1 = compileVaporComponent(
        template1,
        undefined,
        undefined,
        true,
      )

      const template2 = `<div>Comp2</div>`
      const Comp2 = compileVaporComponent(template2)
      const SSRComp2 = compileVaporComponent(
        template2,
        undefined,
        undefined,
        true,
      )

      const appCode = `
        <div>
          <components.Comp1 v-if="data.toggle"/>
          <components.Comp2 v-else/>
        </div>
      `

      const SSRApp = compileVaporComponent(
        appCode,
        data,
        {
          Comp1: SSRComp1,
          Comp2: SSRComp2,
        },
        true,
      )

      const teleportContainer = document.createElement('div')
      teleportContainer.id = targetId
      document.body.appendChild(teleportContainer)

      const mainHtml = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )
      expect(mainHtml).toBe(
        '<div><!--teleport start--><!--teleport end--></div>',
      )
      expect(teleportContainer.innerHTML).toBe('')

      const { container } = await mountWithHydration(mainHtml, appCode, data, {
        Comp1,
        Comp2,
      })

      expect(container.innerHTML).toBe(
        '<div><!--teleport start--><!--teleport end--><!--if--></div>',
      )
      expect(teleportContainer.innerHTML).toBe(`<span>Teleported Comp1</span>`)
      expect(`Hydration children mismatch`).toHaveBeenWarned()

      data.value.toggle = false
      await nextTick()
      expect(container.innerHTML).toBe('<div><div>Comp2</div><!--if--></div>')
      expect(teleportContainer.innerHTML).toBe('')
    })

    test('target change (mismatch + full integration)', async () => {
      const targetId1 = 'teleport8-1'
      const targetId2 = 'teleport8-2'
      const data = ref({
        target: ref(targetId1),
        msg: ref('foo'),
      })

      const template = `<Teleport :to="'#' + data.target"><span>{{data.msg}}</span></Teleport>`
      const Comp = compileVaporComponent(template, data)
      const SSRComp = compileVaporComponent(template, data, undefined, true)

      const teleportContainer1 = document.createElement('div')
      teleportContainer1.id = targetId1
      const teleportContainer2 = document.createElement('div')
      teleportContainer2.id = targetId2
      document.body.appendChild(teleportContainer1)
      document.body.appendChild(teleportContainer2)

      // server render
      const mainHtml = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRComp),
      )
      expect(mainHtml).toBe(`<!--teleport start--><!--teleport end-->`)
      expect(teleportContainer1.innerHTML).toBe('')
      expect(teleportContainer2.innerHTML).toBe('')

      // hydrate
      const { container } = await mountWithHydration(mainHtml, template, data, {
        Comp,
      })

      expect(container.innerHTML).toBe(
        `<!--teleport start--><!--teleport end-->`,
      )
      expect(teleportContainer1.innerHTML).toBe(`<span>foo</span>`)
      expect(teleportContainer2.innerHTML).toBe('')
      expect(`Hydration children mismatch`).toHaveBeenWarned()

      data.value.target = targetId2
      data.value.msg = 'bar'
      await nextTick()
      expect(container.innerHTML).toBe(
        `<!--teleport start--><!--teleport end-->`,
      )
      expect(teleportContainer1.innerHTML).toBe('')
      expect(teleportContainer2.innerHTML).toBe(`<span>bar</span>`)
    })

    test('with disabled teleport + undefined target', async () => {
      const data = ref({
        msg: ref('foo'),
      })

      const { container } = await mountWithHydration(
        '<!--teleport start--><span>foo</span><!--teleport end-->',
        `<teleport :to="undefined" :disabled="true">
          <span>{{data.msg}}</span>
        </teleport>`,
        data,
      )

      expect(container.innerHTML).toBe(
        `<!--teleport start--><span>foo</span><!--teleport end-->`,
      )

      data.value.msg = 'bar'
      await nextTick()
      expect(container.innerHTML).toBe(
        `<!--teleport start--><span>bar</span><!--teleport end-->`,
      )
    })

    test('disabled teleport with null target hydration', async () => {
      const { block, container } = await mountWithHydration(
        '<!--teleport start--><div>content</div><!--teleport end-->',
        `<teleport :to="undefined" :disabled="true">
          <div>content</div>
        </teleport>`,
      )
      expect(container.innerHTML).toBe(
        `<!--teleport start--><div>content</div><!--teleport end-->`,
      )
      expect(`mismatch`).not.toHaveBeenWarned()

      // targetStart must NOT be set when there's no target
      const teleport = block as TeleportFragment
      expect(teleport.targetStart).toBeNull()
      expect(teleport.targetAnchor).toBeNull()
    })

    test('enabled teleport hydration should preserve existing target end anchor when target is empty', async () => {
      const data = ref({ msg: 'foo' })

      const teleportContainer = document.createElement('div')
      teleportContainer.id = 'teleport-empty-anchors'
      teleportContainer.innerHTML =
        `<!--teleport start anchor-->` + `<!--teleport anchor-->`
      document.body.appendChild(teleportContainer)

      const { container } = await mountWithHydration(
        '<!--teleport start--><!--teleport end-->',
        `<teleport to="#teleport-empty-anchors">
          <span>{{data.msg}}</span>
        </teleport>`,
        data,
      )

      expect(container.innerHTML).toBe(
        `<!--teleport start--><!--teleport end-->`,
      )
      expect(`Hydration node mismatch`).toHaveBeenWarned()
      expect(`Hydration text mismatch`).not.toHaveBeenWarned()
      expect(teleportContainer.innerHTML).toBe(
        `<!--teleport start anchor--><span>foo</span><!--teleport anchor-->`,
      )

      data.value.msg = 'bar'
      await nextTick()
      expect(teleportContainer.innerHTML).toBe(
        `<!--teleport start anchor--><span>bar</span><!--teleport anchor-->`,
      )
    })

    test('enabled teleport hydration with empty v-if should preserve target anchors', async () => {
      const data = ref({ ok: false, msg: 'foo' })

      const teleportContainer = document.createElement('div')
      teleportContainer.id = 'teleport-empty-if'
      teleportContainer.innerHTML =
        `<!--teleport start anchor-->` + `<!--teleport anchor-->`
      document.body.appendChild(teleportContainer)

      const { container } = await mountWithHydration(
        '<!--teleport start--><!--teleport end-->',
        `<teleport to="#teleport-empty-if">
          <span v-if="data.ok">{{data.msg}}</span>
        </teleport>`,
        data,
      )
      await nextTick()

      expect(container.innerHTML).toBe(
        `<!--teleport start--><!--teleport end-->`,
      )
      expect(teleportContainer.innerHTML).toBe(
        `<!--teleport start anchor--><!--if--><!--teleport anchor-->`,
      )

      data.value.ok = true
      await nextTick()
      expect(teleportContainer.innerHTML).toBe(
        `<!--teleport start anchor--><span>foo</span><!--if--><!--teleport anchor-->`,
      )
    })

    test('disabled teleport hydration over empty main-view range should preserve teleport end anchor', async () => {
      const data = ref({ msg: 'foo' })

      const { container } = await mountWithHydration(
        '<!--teleport start--><!--teleport end-->',
        `<teleport :to="undefined" :disabled="true">
          <span>{{data.msg}}</span>
        </teleport>`,
        data,
      )

      expect(`Hydration node mismatch`).toHaveBeenWarned()
      expect(`Hydration text mismatch`).not.toHaveBeenWarned()
      expect(container.innerHTML).toBe(
        `<!--teleport start--><span>foo</span><!--teleport end-->`,
      )

      data.value.msg = 'bar'
      await nextTick()
      expect(container.innerHTML).toBe(
        `<!--teleport start--><span>bar</span><!--teleport end-->`,
      )
    })

    test('disabled teleport range should count as one logical child during hydration', async () => {
      const data = ref({ msg: 'after' })

      const { container } = await mountWithHydration(
        '<div><!--teleport start--><span>teleported</span><!--teleport end--><p>after</p></div>',
        `<div>
          <teleport :to="undefined" :disabled="true">
            <span>teleported</span>
          </teleport>
          <p>{{data.msg}}</p>
        </div>`,
        data,
      )

      expect(container.innerHTML).toBe(
        '<div><!--teleport start--><span>teleported</span><!--teleport end--><p>after</p></div>',
      )

      data.value.msg = 'updated'
      await nextTick()
      expect(container.innerHTML).toBe(
        '<div><!--teleport start--><span>teleported</span><!--teleport end--><p>updated</p></div>',
      )
    })

    test('enabled teleport with null target', async () => {
      const { container } = await mountWithHydration(
        '<!--teleport start--><!--teleport end-->',
        `<teleport to="#non-existent-target-hydrate">
          <div>content</div>
        </teleport>`,
      )

      // Align with VDOM Teleport behavior
      expect(container.innerHTML).toBe(
        `<!--teleport start--><!--teleport end-->`,
      )
      expect('Failed to locate Teleport target').toHaveBeenWarned()
    })

    test('disabled teleport with null target should preserve trailing sibling when re-enabled without target', async () => {
      const data = ref({
        disabled: true,
        target: undefined as string | undefined,
        tail: 'tail',
      })

      const { container } = await mountWithHydration(
        '<!--[--><!--teleport start--><div>content</div><!--teleport end--><span>tail</span><!--]-->',
        `<teleport :to="data.target" :disabled="data.disabled">
          <div>content</div>
        </teleport>
        <span>{{data.tail}}</span>`,
        data,
      )

      expect(container.innerHTML).toBe(
        '<!--[--><!--teleport start--><div>content</div><!--teleport end--><span>tail</span><!--]-->',
      )
      expect(`Hydration text mismatch`).not.toHaveBeenWarned()

      data.value.tail = 'tail-updated'
      await nextTick()
      expect(container.innerHTML).toBe(
        '<!--[--><!--teleport start--><div>content</div><!--teleport end--><span>tail-updated</span><!--]-->',
      )
      expect('Invalid Teleport target').not.toHaveBeenWarned()

      data.value.disabled = false
      await nextTick()
      expect('Invalid Teleport target').toHaveBeenWarned()
      expect(container.innerHTML).toBe(
        '<!--[--><!--teleport start--><div>content</div><!--teleport end--><span>tail-updated</span><!--]-->',
      )
    })

    test('enabled teleport with null target should preserve trailing sibling when toggling disabled', async () => {
      const data = ref({
        disabled: false,
        target: '#non-existent-target-hydrate-sibling' as string | undefined,
        tail: 'tail',
      })

      const { container } = await mountWithHydration(
        '<!--[--><!--teleport start--><!--teleport end--><span>tail</span><!--]-->',
        `<teleport :to="data.target" :disabled="data.disabled">
          <div>content</div>
        </teleport>
        <span>{{data.tail}}</span>`,
        data,
      )

      expect(container.innerHTML).toBe(
        '<!--[--><!--teleport start--><!--teleport end--><span>tail</span><!--]-->',
      )
      expect('Failed to locate Teleport target').toHaveBeenWarned()

      data.value.tail = 'tail-updated'
      await nextTick()
      expect(container.innerHTML).toBe(
        '<!--[--><!--teleport start--><!--teleport end--><span>tail-updated</span><!--]-->',
      )

      data.value.disabled = true
      data.value.target = undefined
      await nextTick()
      expect(container.innerHTML).toBe(
        '<!--[--><!--teleport start--><div>content</div><!--teleport end--><span>tail-updated</span><!--]-->',
      )

      data.value.disabled = false
      data.value.target = '#non-existent-target-hydrate-sibling'
      await nextTick()
      expect('Invalid Teleport target on mount').toHaveBeenWarned()
      expect(container.innerHTML).toBe(
        '<!--[--><!--teleport start--><div>content</div><!--teleport end--><span>tail-updated</span><!--]-->',
      )
    })

    test('enabled teleport with null target should delay child setup until target becomes available', async () => {
      const data = ref<{
        version: string
        target: string | Element
        setups: string[]
      }>({
        version: 'one',
        target: '#non-existent-target-hydrate-late',
        setups: [],
      })
      const Child = compile(
        `<script setup>
          const props = defineProps(['msg'])
          const data = _data
          data.value.setups.push(String(props.msg))
        </script>
        <template><div>{{ props.msg }}</div></template>`,
        data,
      )
      const App = compile(
        `<template>
          <teleport :to="data.target">
            <components.Child :msg="data.version" />
          </teleport>
        </template>`,
        data,
        { Child },
      )

      const container = document.createElement('div')
      container.innerHTML = '<!--teleport start--><!--teleport end-->'
      document.body.appendChild(container)

      const app = createVaporSSRApp(App)
      app.mount(container)

      expect(container.innerHTML).toBe(
        `<!--teleport start--><!--teleport end-->`,
      )
      expect(data.value.setups).toEqual([])
      expect('Failed to locate Teleport target').toHaveBeenWarned()

      data.value.version = 'two'
      await nextTick()
      data.value.version = 'three'
      await nextTick()
      expect(data.value.setups).toEqual([])

      const targetEl = document.createElement('div')
      data.value.target = targetEl
      await nextTick()

      expect(data.value.setups).toEqual(['three'])
      expect(targetEl.innerHTML).toBe('<div>three</div>')
    })

    test('should apply css vars after hydration', async () => {
      const state = reactive({ color: 'red' })

      const teleportContainer = document.createElement('div')
      teleportContainer.id = 'teleport-css-vars'
      teleportContainer.innerHTML =
        `<!--teleport start anchor-->` +
        `<span>content</span>` +
        `<!--teleport anchor-->`
      document.body.appendChild(teleportContainer)

      const App = defineVaporComponent({
        setup() {
          useVaporCssVars(() => state)
          return createComponent(
            VaporTeleport,
            { to: () => '#teleport-css-vars' },
            { default: () => template('<span>content</span>', 1)() },
          )
        },
      })

      const container = document.createElement('div')
      container.innerHTML = '<!--teleport start--><!--teleport end-->'
      document.body.appendChild(container)

      const app = createVaporSSRApp(App)
      app.mount(container)

      await nextTick()

      // css vars should be applied after hydration
      const span = teleportContainer.querySelector('span') as HTMLElement
      expect(span).toBeTruthy()
      expect(span.style.getPropertyValue('--color')).toBe('red')
      expect(span.hasAttribute('data-v-owner')).toBe(true)

      // css vars should update reactively
      state.color = 'green'
      await nextTick()
      expect(span.style.getPropertyValue('--color')).toBe('green')
    })
  })
})
