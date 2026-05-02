<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  COMPONENT_FANOUT_CONFIG,
  COMPONENT_FANOUT_COUNT,
  createFanoutGroups,
  createFanoutItems,
  getNextActiveId,
  getNextMode,
} from '../data.mjs'
import { installComponentFanoutBenchmark } from '../ready'
import FanoutCard from './VdomCard.vue'

const items = createFanoutItems()
const groups = createFanoutGroups(items)
const activeId = ref(0)
const revision = ref(0)
const mode = ref('steady')

onMounted(() => {
  installComponentFanoutBenchmark('vdom', operation => {
    if (operation === 'retarget-active-child') {
      activeId.value = getNextActiveId(activeId.value)
    } else if (operation === 'update-shared-revision') {
      revision.value += 1
    } else if (operation === 'cycle-display-mode') {
      mode.value = getNextMode(mode.value)
    }
  })
})
</script>

<template>
  <main
    class="fanout-shell"
    data-scenario="component-fanout"
    data-target="vdom"
  >
    <header class="fanout-header">
      <div>
        <p>Component fanout</p>
        <h1>Component fanout</h1>
      </div>
      <div class="fanout-summary" aria-label="Fanout summary">
        <span>{{ COMPONENT_FANOUT_CONFIG.groupCount }} groups</span>
        <span>{{ COMPONENT_FANOUT_COUNT }} children</span>
        <span>revision {{ revision }}</span>
      </div>
    </header>

    <span hidden data-bench-state
      >{{ activeId }}:{{ revision }}:{{ mode }}</span
    >

    <section class="fanout-groups" aria-label="Component fanout groups">
      <div v-for="group in groups" :key="group.id" class="fanout-group">
        <h2>{{ group.label }}</h2>
        <div class="fanout-list">
          <FanoutCard
            v-for="item in group.items"
            :key="item.id"
            :item="item"
            :active-id="activeId"
            :revision="revision"
            :mode="mode"
          />
        </div>
      </div>
    </section>
  </main>
</template>
