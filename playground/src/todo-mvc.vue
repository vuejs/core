<script setup lang="ts">
import { ref } from 'vue/vapor'

interface Task {
  title: string
  completed: boolean
}
const tasks = ref<Task[]>([])
</script>

<template>{{ tasks }}</template>
