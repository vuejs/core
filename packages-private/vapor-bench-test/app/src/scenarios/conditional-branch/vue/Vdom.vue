<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  CONDITIONAL_BRANCH_CONFIG,
  CONDITIONAL_BRANCH_COUNT,
  CONDITIONAL_BRANCH_HOT_BRANCH,
  createBranchGroups,
  createBranches,
  getAllBranchIndices,
  getGroupBranchIndices,
} from '../data.mjs'
import { installConditionalBranchBenchmark } from '../ready'

const branches = createBranches().map(branch => ({
  ...branch,
  expanded: ref(branch.expanded),
}))
const groups = createBranchGroups(branches)
const flips = ref(0)
const hotIndices = new Set([
  CONDITIONAL_BRANCH_HOT_BRANCH,
  ...getGroupBranchIndices(),
])

function toggleIndices(indices: number[]) {
  flips.value += 1

  for (const index of indices) {
    const branch = branches[index]
    branch.expanded.value = !branch.expanded.value
  }
}

onMounted(() => {
  installConditionalBranchBenchmark('vdom', operation => {
    if (operation === 'toggle-one-branch') {
      toggleIndices([CONDITIONAL_BRANCH_HOT_BRANCH])
    } else if (operation === 'toggle-one-group') {
      toggleIndices(getGroupBranchIndices())
    } else if (operation === 'toggle-all-branches') {
      toggleIndices(getAllBranchIndices())
    }
  })
})
</script>

<template>
  <main
    class="branch-shell"
    data-scenario="conditional-branch"
    data-target="vdom"
  >
    <header class="branch-header">
      <div>
        <p>Branch churn</p>
        <h1>Conditional branch churn</h1>
      </div>
      <div class="branch-summary" aria-label="Branch summary">
        <span>{{ CONDITIONAL_BRANCH_CONFIG.groupCount }} groups</span>
        <span>{{ CONDITIONAL_BRANCH_COUNT }} branches</span>
        <span>{{ flips }} flips</span>
      </div>
    </header>

    <span hidden data-bench-state>
      {{ flips }}:{{
        branches[CONDITIONAL_BRANCH_HOT_BRANCH].expanded.value
      }}:{{ branches[0].expanded.value }}:{{ branches[479].expanded.value }}
    </span>

    <section class="branch-groups" aria-label="Conditional branch groups">
      <div v-for="group in groups" :key="group.id" class="branch-group">
        <h2>{{ group.label }}</h2>
        <div class="branch-list">
          <div
            v-for="branch in group.branches"
            :key="branch.id"
            class="branch-slot"
          >
            <article
              v-if="branch.expanded.value"
              class="branch-card branch-card--expanded"
              :class="{ hot: hotIndices.has(branch.id) }"
            >
              <div>
                <p class="branch-title">{{ branch.title }}</p>
                <span class="branch-owner">{{ branch.owner }}</span>
              </div>
              <strong class="branch-score">{{ branch.score }}</strong>
              <div class="branch-detail">
                <span>Delta {{ branch.delta }}</span>
                <span>Load {{ branch.load }}</span>
              </div>
              <div class="branch-badges">
                <span>{{ branch.code }}</span>
                <span>open</span>
                <span>live</span>
              </div>
            </article>
            <section
              v-else
              class="branch-card branch-card--compact"
              :class="{ hot: hotIndices.has(branch.id) }"
            >
              <p class="branch-compact-title">{{ branch.title }}</p>
              <span class="branch-code">{{ branch.code }}</span>
              <span class="branch-load">{{ branch.load }}</span>
              <div class="branch-badges">
                <span>idle</span>
                <span>{{ branch.owner }}</span>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
