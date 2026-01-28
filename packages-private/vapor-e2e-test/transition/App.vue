<script vapor>
import {
  createComponent,
  defineVaporComponent,
  ref,
  shallowRef,
  VaporTransition,
  createIf,
  template,
  defineVaporAsyncComponent,
  onUnmounted,
  onUpdated,
  setElementText,
  renderEffect,
  inject,
  provide,
  child,
  txt,
  applyVShow,
  setText,
  delegateEvents,
  toDisplayString,
} from 'vue'
import VaporCompA from './components/VaporCompA.vue'
import VaporCompB from './components/VaporCompB.vue'
import VDomComp from './components/VdomComp.vue'

const show = ref(true)
const toggle = ref(true)
const count = ref(0)

const timeout = (fn, time) => setTimeout(fn, time)
const duration = window.__TRANSITION_DURATION__ || 50

let calls = {
  basic: [],
  withoutAppear: [],
  withArgs: [],
  enterCancel: [],
  withAppear: [],
  cssFalse: [],
  ifInOut: [],

  show: [],
  showLeaveCancel: [],
  showAppear: [],
  notEnter: [],

  updated: [],
  unmount: [],
}
window.getCalls = key => calls[key]
window.resetCalls = key => (calls[key] = [])

const activeComponent = shallowRef(VaporCompB)
function toggleComponent() {
  activeComponent.value =
    activeComponent.value === VaporCompA ? VaporCompB : VaporCompA
}

const toggleVdom = ref(true)

const interopComponent = shallowRef(VDomComp)
function toggleInteropComponent() {
  interopComponent.value =
    interopComponent.value === VaporCompA ? VDomComp : VaporCompA
}

const name = ref('test')
const MyTransition = defineVaporComponent((props, { slots }) => {
  return createComponent(VaporTransition, { name: () => 'test' }, slots)
})

const MyTransitionFallthroughAttr = defineVaporComponent((props, { slots }) => {
  return createComponent(
    VaporTransition,
    { foo: () => 1, name: () => 'test' },
    slots,
  )
})

const One = defineVaporComponent({
  setup() {
    return createIf(
      () => false,
      () => template('<div>one</div>', true)(),
    )
  },
})

const Two = defineVaporComponent({
  setup() {
    return template('<div>two</div>', true)()
  },
})
const view = shallowRef(One)
function changeView() {
  view.value = view.value === One ? Two : One
}

const SimpleOne = defineVaporComponent({
  setup() {
    return template('<div>one</div>', true)()
  },
})
const viewInOut = shallowRef(SimpleOne)
function changeViewInOut() {
  viewInOut.value = viewInOut.value === SimpleOne ? Two : SimpleOne
}

const AsyncComp = defineVaporAsyncComponent(() => {
  return new Promise(resolve => setTimeout(() => resolve(VaporCompA), 50))
})

const AsyncCompResolved = defineVaporAsyncComponent(() =>
  Promise.resolve(VaporCompA),
)

const TrueBranch = defineVaporComponent({
  name: 'TrueBranch',
  setup() {
    onUnmounted(() => {
      calls.unmount.push('TrueBranch')
    })
    return template('<div>0</div>')()
  },
})
const includeRef = ref(['TrueBranch'])
const click = () => {
  toggle.value = !toggle.value
  if (toggle.value) {
    includeRef.value = ['TrueBranch']
  } else {
    includeRef.value = []
  }
}

const UnmountBranch = defineVaporComponent({
  name: 'UnmountBranch',
  setup() {
    onUnmounted(() => {
      calls.unmount.push('UnmountBranch')
    })
    return template('<div>0</div>')()
  },
})
const keepAliveUnmountRef = ref(null)
window.getKeepAliveUnmountStorageContainer = () =>
  keepAliveUnmountRef.value?.ctx?.getStorageContainer?.() ?? null
const unmountIncludeRef = ref(['UnmountBranch'])
const unmountToggle = ref(true)
const unmountClick = () => {
  unmountToggle.value = !unmountToggle.value
  if (unmountToggle.value) {
    unmountIncludeRef.value = ['UnmountBranch']
  } else {
    unmountIncludeRef.value = []
  }
}

const CompA = defineVaporComponent({
  name: 'CompA',
  setup() {
    onUpdated(() => {
      calls.updated.push('CompA updated')
    })
    return template('<div>CompA</div>')()
  },
})

const CompB = defineVaporComponent({
  name: 'CompB',
  setup() {
    return template('<div>CompB</div>')()
  },
})

const CompC = defineVaporComponent({
  name: 'CompC',
  setup() {
    onUnmounted(() => {
      calls.unmount.push('CompC unmounted')
    })
    return template('<div>CompC</div>')()
  },
})

const includeToChange = ref(['CompA', 'CompB', 'CompC'])
const currentView = shallowRef(CompA)
const switchToB = () => (currentView.value = CompB)
const switchToC = () => (currentView.value = CompC)
const switchToA = () => {
  currentView.value = CompA
  includeToChange.value = ['CompA']
}

const CompA2 = defineVaporComponent({
  name: 'CompA2',
  setup() {
    const current = inject('currentView2')
    const n0 = template('<div></div>')()
    renderEffect(() => setElementText(n0, toDisplayString(current.value.name)))
    return n0
  },
})
const CompB2 = defineVaporComponent({
  name: 'CompB2',
  setup() {
    onUnmounted(() => {
      calls.unmount.push('CompB2 unmounted')
    })
    const current = inject('currentView2')
    const n0 = template('<div></div>')()
    renderEffect(() => setElementText(n0, toDisplayString(current.value.name)))
    return n0
  },
})

const includeRef2 = ref(['CompA2'])
const currentView2 = shallowRef(CompA2)
provide('currentView2', currentView2)
const switchToB2 = () => {
  currentView2.value = CompB2
  includeRef2.value = ['CompA2', 'CompB2']
}
const switchToA2 = () => {
  currentView2.value = CompA2
  includeRef2.value = ['CompA2']
}

const show2 = ref(true)
const state = ref(1)
const Item = defineVaporComponent({
  name: 'Item',
  setup() {
    return createComponent(
      VaporTransition,
      { name: () => 'test', persisted: () => '' },
      {
        default: () => {
          const n1 = template('<div><h2> </h2></div>')()
          const n0 = child(n1)
          const x0 = txt(n0)
          applyVShow(n1, () => show2.value)
          renderEffect(() =>
            setText(
              x0,
              toDisplayString(
                show2.value ? 'I should show' : "I shouldn't show ",
              ),
            ),
          )
          return n1
        },
      },
    )
  },
})
const Comp1 = defineVaporComponent({
  name: 'Comp1',
  setup() {
    delegateEvents('click')
    const n0 = createComponent(Item)
    const n1 = template('<h2>This is page1</h2>')()
    const n2 = template('<button id="changeShowBtn"></button>')()
    n2.$evtclick = () => (show2.value = !show2.value)
    renderEffect(() => {
      setElementText(n2, show2.value)
    })
    return [n0, n1, n2]
  },
})
const Comp2 = defineVaporComponent({
  name: 'Comp2',
  setup() {
    return template('<h2>This is page2</h2>')()
  },
})
</script>

<template>
  <div class="transition-container">
    <!-- work with vif  -->
    <div class="if-basic">
      <div>
        <transition>
          <div v-if="toggle" class="test">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">basic toggle</button>
    </div>
    <div class="if-named">
      <div>
        <transition name="test">
          <div v-if="toggle" class="test">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <div class="if-custom-classes">
      <div>
        <transition
          enter-from-class="hello-from"
          enter-active-class="hello-active"
          enter-to-class="hello-to"
          leave-from-class="bye-from"
          leave-active-class="bye-active"
          leave-to-class="bye-to"
        >
          <div v-if="toggle" class="test">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <div class="if-dynamic-name">
      <div>
        <transition :name="name">
          <div v-if="toggle" class="test">content</div>
        </transition>
      </div>
      <button class="toggle" @click="toggle = !toggle">button</button>
      <button class="change" @click="name = 'changed'">{{ name }}</button>
    </div>
    <div class="if-events-without-appear">
      <div>
        <transition
          name="test"
          @before-enter="() => calls.withoutAppear.push('beforeEnter')"
          @enter="() => calls.withoutAppear.push('onEnter')"
          @after-enter="() => calls.withoutAppear.push('afterEnter')"
          @beforeLeave="() => calls.withoutAppear.push('beforeLeave')"
          @leave="() => calls.withoutAppear.push('onLeave')"
          @afterLeave="() => calls.withoutAppear.push('afterLeave')"
        >
          <div v-if="toggle" class="test">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <div class="if-events-with-args">
      <div>
        <transition
          :css="false"
          name="test"
          @before-enter="
            el => {
              calls.withArgs.push('beforeEnter')
              el.classList.add('before-enter')
            }
          "
          @enter="
            (el, done) => {
              calls.withArgs.push('onEnter')
              el.classList.add('enter')
              timeout(done, 200)
            }
          "
          @after-enter="
            el => {
              calls.withArgs.push('afterEnter')
              el.classList.add('after-enter')
            }
          "
          @before-leave="
            el => {
              calls.withArgs.push('beforeLeave')
              el.classList.add('before-leave')
            }
          "
          @leave="
            (el, done) => {
              calls.withArgs.push('onLeave')
              el.classList.add('leave')
              timeout(done, 200)
            }
          "
          @after-leave="
            () => {
              calls.withArgs.push('afterLeave')
            }
          "
        >
          <div v-if="toggle" class="test">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <div class="if-enter-cancelled">
      <div>
        <transition
          name="test"
          @enter-cancelled="
            () => {
              calls.enterCancel.push('enterCancelled')
            }
          "
        >
          <div v-if="!toggle" class="test">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">cancelled</button>
    </div>
    <div class="if-appear">
      <div>
        <transition
          name="test"
          appear
          appear-from-class="test-appear-from"
          appear-to-class="test-appear-to"
          appear-active-class="test-appear-active"
        >
          <div v-if="toggle" class="test">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <div class="if-events-with-appear">
      <div>
        <transition
          name="test"
          appear
          appear-from-class="test-appear-from"
          appear-to-class="test-appear-to"
          appear-active-class="test-appear-active"
          @beforeEnter="() => calls.withAppear.push('beforeEnter')"
          @enter="() => calls.withAppear.push('onEnter')"
          @afterEnter="() => calls.withAppear.push('afterEnter')"
          @beforeLeave="() => calls.withAppear.push('beforeLeave')"
          @leave="() => calls.withAppear.push('onLeave')"
          @afterLeave="() => calls.withAppear.push('afterLeave')"
          @beforeAppear="() => calls.withAppear.push('beforeAppear')"
          @appear="() => calls.withAppear.push('onAppear')"
          @afterAppear="() => calls.withAppear.push('afterAppear')"
        >
          <div v-if="toggle" class="test">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <div class="if-css-false">
      <div>
        <transition
          :css="false"
          name="test"
          @beforeEnter="() => calls.cssFalse.push('beforeEnter')"
          @enter="() => calls.cssFalse.push('onEnter')"
          @afterEnter="() => calls.cssFalse.push('afterEnter')"
          @beforeLeave="() => calls.cssFalse.push('beforeLeave')"
          @leave="() => calls.cssFalse.push('onLeave')"
          @afterLeave="() => calls.cssFalse.push('afterLeave')"
        >
          <div v-if="toggle" class="test">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle"></button>
    </div>
    <div class="if-no-trans">
      <div>
        <transition name="noop">
          <div v-if="toggle">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <div class="if-ani">
      <div>
        <transition name="test-anim">
          <div v-if="toggle">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <div class="if-ani-explicit-type">
      <div>
        <transition name="test-anim-long" type="animation">
          <div v-if="toggle">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <div class="if-high-order">
      <div>
        <MyTransition>
          <div v-if="toggle" class="test">content</div>
        </MyTransition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <div class="if-empty-root">
      <div>
        <transition name="test">
          <component class="test" :is="view"></component>
        </transition>
      </div>
      <button class="toggle" @click="toggle = !toggle">button</button>
      <button class="change" @click="changeView">changeView button</button>
    </div>
    <div class="if-at-component-root-level">
      <div>
        <transition name="test" mode="out-in">
          <component class="test" :is="view"></component>
        </transition>
      </div>
      <button class="toggle" @click="toggle = !toggle">button</button>
      <button class="change" @click="changeView">changeView button</button>
    </div>
    <div class="if-fallthrough-attr">
      <div>
        <MyTransitionFallthroughAttr>
          <div v-if="toggle">content</div>
        </MyTransitionFallthroughAttr>
      </div>
      <button @click="toggle = !toggle">button fallthrough</button>
    </div>
    <div class="if-fallthrough-attr-in-out">
      <div>
        <transition
          foo="1"
          name="test"
          mode="in-out"
          @beforeEnter="() => calls.ifInOut.push('beforeEnter')"
          @enter="() => calls.ifInOut.push('onEnter')"
          @afterEnter="() => calls.ifInOut.push('afterEnter')"
          @beforeLeave="() => calls.ifInOut.push('beforeLeave')"
          @leave="() => calls.ifInOut.push('onLeave')"
          @afterLeave="() => calls.ifInOut.push('afterLeave')"
        >
          <component :is="viewInOut"></component>
        </transition>
      </div>
      <button @click="changeViewInOut">button</button>
    </div>
    <!-- work with vif end -->

    <!-- work with vshow  -->
    <div class="show-named">
      <div>
        <transition name="test">
          <div v-show="toggle" class="test">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <div class="show-events">
      <div>
        <transition
          name="test"
          @beforeEnter="() => calls.show.push('beforeEnter')"
          @enter="() => calls.show.push('onEnter')"
          @afterEnter="() => calls.show.push('afterEnter')"
          @beforeLeave="() => calls.show.push('beforeLeave')"
          @leave="() => calls.show.push('onLeave')"
          @afterLeave="() => calls.show.push('afterLeave')"
        >
          <div v-show="toggle" class="test">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <div class="show-leave-cancelled">
      <div>
        <transition
          name="test"
          @leave-cancelled="() => calls.showLeaveCancel.push('leaveCancelled')"
        >
          <div v-show="toggle" class="test">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">leave cancelled</button>
    </div>
    <div class="show-appear">
      <div>
        <transition
          name="test"
          appear
          appear-from-class="test-appear-from"
          appear-to-class="test-appear-to"
          appear-active-class="test-appear-active"
          @beforeEnter="() => calls.showAppear.push('beforeEnter')"
          @enter="() => calls.showAppear.push('onEnter')"
          @afterEnter="() => calls.showAppear.push('afterEnter')"
        >
          <div v-show="toggle" class="test">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <div class="show-appear-not-enter">
      <div>
        <transition
          name="test"
          appear
          @beforeEnter="() => calls.notEnter.push('beforeEnter')"
          @enter="() => calls.notEnter.push('onEnter')"
          @afterEnter="() => calls.notEnter.push('afterEnter')"
        >
          <div v-show="!toggle" class="test">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <!-- work with vshow end -->

    <!-- explicit durations -->
    <div class="duration-single-value">
      <div>
        <transition name="test" :duration="duration * 2">
          <div v-if="toggle" class="test">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <div class="duration-enter">
      <div>
        <transition name="test" :duration="{ enter: duration * 2 }">
          <div v-if="toggle" class="test">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <div class="duration-leave">
      <div>
        <transition name="test" :duration="{ leave: duration * 2 }">
          <div v-if="toggle" class="test">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <div class="duration-enter-leave">
      <div>
        <transition
          name="test"
          :duration="{ enter: duration * 4, leave: duration * 2 }"
        >
          <div v-if="toggle" class="test">content</div>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <!-- explicit durations end -->

    <!-- keyed fragment -->
    <div class="keyed">
      <button @click="count++">inc</button>
      <Transition>
        <h1 style="position: absolute" :key="count">{{ count }}</h1>
      </Transition>
    </div>
    <!-- keyed fragment end -->

    <!-- mode -->
    <div class="out-in">
      <button @click="toggleComponent">toggle out-in</button>
      <div>
        <Transition name="fade" mode="out-in">
          <component :is="activeComponent"></component>
        </Transition>
      </div>
    </div>
    <div class="in-out">
      <button @click="toggleComponent">toggle in-out</button>
      <div>
        <Transition name="fade" mode="in-out">
          <component :is="activeComponent"></component>
        </Transition>
      </div>
    </div>
    <!-- mode end -->

    <!-- async component -->
    <div class="async">
      <div id="container">
        <transition>
          <AsyncComp v-if="!toggle"></AsyncComp>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <div class="async-resolved">
      <!-- Pre-resolve the async component by rendering it hidden -->
      <div id="hidden-async">
        <AsyncCompResolved v-show="false" />
      </div>
      <div id="container">
        <transition>
          <AsyncCompResolved v-if="!toggle"></AsyncCompResolved>
        </transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <!-- async component end -->

    <!-- with teleport -->
    <div class="with-teleport">
      <div class="target"></div>
      <div class="container">
        <Transition>
          <Teleport to=".target" defer>
            <!-- comment -->
            <VaporCompB v-if="!toggle" class="test"></VaporCompB>
          </Teleport>
        </Transition>
      </div>
      <button @click="toggle = !toggle">button</button>
    </div>
    <!-- with teleport end -->

    <!-- with keep-alive -->
    <div class="keep-alive">
      <div>
        <transition mode="out-in">
          <KeepAlive :include="includeRef">
            <TrueBranch v-if="toggle"></TrueBranch>
          </KeepAlive>
        </transition>
      </div>
      <button @click="click">button</button>
    </div>
    <div class="keep-alive-unmount-children">
      <div id="container">
        <transition>
          <KeepAlive ref="keepAliveUnmountRef" :include="unmountIncludeRef">
            <UnmountBranch v-if="unmountToggle"></UnmountBranch>
          </KeepAlive>
        </transition>
      </div>
      <button id="toggleBtn" @click="unmountClick">button</button>
    </div>
    <div class="keep-alive-update-include">
      <div>
        <transition mode="out-in">
          <KeepAlive :include="includeToChange">
            <component :is="currentView" />
          </KeepAlive>
        </transition>
      </div>
      <button id="switchToB" @click="switchToB">switchToB</button>
      <button id="switchToC" @click="switchToC">switchToC</button>
      <button id="switchToA" @click="switchToA">switchToA</button>
    </div>
    <div class="keep-alive-switch-then-update-include">
      <div>
        <transition name="test-anim" mode="out-in">
          <KeepAlive :include="includeRef2">
            <component :is="currentView2" />
          </KeepAlive>
        </transition>
      </div>
      <button id="switchToA" @click="switchToA2">switchToA</button>
      <button id="switchToB" @click="switchToB2">switchToB</button>
    </div>
    <div class="keep-alive-move-before-leave-finishes">
      <div>
        <KeepAlive :include="['Comp1', 'Comp2']">
          <component :is="state === 1 ? Comp1 : Comp2" />
        </KeepAlive>
      </div>
      <button @click="state = state === 1 ? 2 : 1">button</button>
    </div>
    <!-- with keep-alive end -->
    <!-- with svg -->
    <div class="svg">
      <svg id="container">
        <transition name="test">
          <circle v-if="toggle" cx="0" cy="0" r="10" class="test"></circle>
        </transition>
      </svg>
      <button id="toggleBtn" @click="toggle = !toggle">button</button>
    </div>
    <!-- with svg end -->

    <!-- vdom interop -->
    <div class="vdom">
      <button @click="toggleVdom = !toggleVdom">toggle vdom component</button>
      <div>
        <Transition>
          <VDomComp v-if="toggleVdom" />
        </Transition>
      </div>
    </div>
    <div class="vdom-vapor-out-in">
      <button @click="toggleInteropComponent">
        switch between vdom/vapor component out-in mode
      </button>
      <div>
        <Transition name="fade" mode="out-in">
          <component :is="interopComponent"></component>
        </Transition>
      </div>
    </div>
    <div class="vdom-vapor-in-out">
      <button @click="toggleVdom = !toggleVdom">
        switch between vdom/vapor component in-out mode
      </button>
      <div>
        <Transition name="fade" mode="in-out">
          <VaporCompA v-if="toggleVdom" />
          <VDomComp v-else></VDomComp>
        </Transition>
      </div>
    </div>
    <!-- vdom interop end -->
  </div>
</template>
<style>
.keyed {
  height: 100px;
}
</style>
<style>
.transition-container > div {
  padding: 15px;
  border: 1px solid #f7f7f7;
  margin-top: 15px;
}
</style>
