<script setup vapor lang="ts">
defineProps<{
  item: any
  activeId: number
  revision: number
  mode: string
}>()
</script>

<template>
  <article
    class="fanout-card"
    :class="{
      'is-active': activeId === item.id,
      'is-busy': mode === 'busy',
      'is-alert': mode === 'alert',
    }"
  >
    <div class="fanout-title-row">
      <p class="fanout-title">{{ item.title }}</p>
      <strong class="fanout-score">{{ item.score }}</strong>
    </div>
    <p v-if="activeId === item.id" class="fanout-active">
      active revision {{ revision }}
    </p>
    <p v-else class="fanout-meta">{{ item.owner }} / {{ item.status }}</p>
    <div class="fanout-badges">
      <span>{{ item.code }}</span>
      <span>{{ mode }}</span>
      <span>r{{ revision }}</span>
    </div>
  </article>
</template>
