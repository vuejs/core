<script setup lang="ts">
withDefaults(defineProps<{ title?: string }>(), { title: 'Untitled' })
</script>

<template>
  <section class="card">
    <header>
      <slot name="header" :title="title">
        <h2>{{ title }}</h2>
      </slot>
    </header>
    <slot />
    <footer v-if="$slots.footer">
      <slot name="footer" />
    </footer>
  </section>
</template>
