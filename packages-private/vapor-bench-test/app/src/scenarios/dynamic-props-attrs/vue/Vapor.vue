<script setup vapor lang="ts">
import { onMounted, ref } from 'vue'
import {
  DYNAMIC_PROPS_ATTRS_CONFIG,
  DYNAMIC_PROPS_ATTRS_COUNT,
  createAttrGroups,
  createAttrItems,
  createDynamicPropBag,
  getNextActiveId,
  getNextVariantSeed,
} from '../data.mjs'
import { installDynamicPropsAttrsBenchmark } from '../ready'
import AttrCard from './VaporAttrCard.vue'

const items = createAttrItems()
const groups = createAttrGroups(items)
const activeId = ref(0)
const attrRevision = ref(0)
const variantSeed = ref(0)

function dynamicPropsFor(item: any) {
  return createDynamicPropBag(item, {
    activeId: activeId.value,
    attrRevision: attrRevision.value,
    variantSeed: variantSeed.value,
  })
}

onMounted(() => {
  installDynamicPropsAttrsBenchmark('vapor', operation => {
    if (operation === 'retarget-active-attrs') {
      activeId.value = getNextActiveId(activeId.value)
    } else if (operation === 'update-fallthrough-attrs') {
      attrRevision.value += 1
    } else if (operation === 'rotate-prop-bag') {
      variantSeed.value = getNextVariantSeed(variantSeed.value)
    }
  })
})
</script>

<template>
  <main
    class="attrs-shell"
    data-scenario="dynamic-props-attrs"
    data-target="vapor"
  >
    <header class="attrs-header">
      <div>
        <p>Dynamic props</p>
        <h1>Dynamic props / attrs fallthrough</h1>
      </div>
      <div class="attrs-summary" aria-label="Dynamic props summary">
        <span>{{ DYNAMIC_PROPS_ATTRS_CONFIG.groupCount }} groups</span>
        <span>{{ DYNAMIC_PROPS_ATTRS_COUNT }} cards</span>
        <span>revision {{ attrRevision }}</span>
      </div>
    </header>

    <span hidden data-bench-state>
      {{ activeId }}:{{ attrRevision }}:{{ variantSeed }}
    </span>

    <section class="attrs-groups" aria-label="Dynamic props groups">
      <div v-for="group in groups" :key="group.id" class="attrs-group">
        <h2>{{ group.label }}</h2>
        <div class="attrs-list">
          <AttrCard
            v-for="item in group.items"
            :key="item.id"
            :item="item"
            :revision="attrRevision"
            v-bind="dynamicPropsFor(item)"
          />
        </div>
      </div>
    </section>
  </main>
</template>
