<script setup vapor lang="ts">
defineProps<{
  item: any
  active: boolean
  compact: boolean
  revision: number
  tone: string
}>()
</script>

<template>
  <article
    class="attrs-card"
    :class="{
      'is-active': active,
      'is-compact': compact,
      [`tone-${tone}`]: true,
    }"
  >
    <div class="attrs-title-row">
      <p class="attrs-title">{{ item.title }}</p>
      <strong class="attrs-score">{{ item.score }}</strong>
    </div>
    <p v-if="active" class="attrs-active">
      active attr revision {{ revision }}
    </p>
    <p v-else class="attrs-meta">{{ item.owner }} / {{ item.status }}</p>
    <div class="attrs-badges">
      <span>{{ item.code }}</span>
      <span>{{ tone }}</span>
      <span>r{{ revision }}</span>
    </div>
  </article>
</template>
