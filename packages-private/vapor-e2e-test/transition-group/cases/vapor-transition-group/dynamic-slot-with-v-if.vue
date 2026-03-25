<script setup vapor>
import { ref } from 'vue'

const show = ref(false)
const list = ref([0, 1])

</script>

<template>
    <div class="dynamic-slot-with-v-if">
        <button class="toggle" @click="show = !show">toggle button</button>
        <button class="add" @click="list.push(list.length)">add button</button>

        <div>
            <TransitionGroup tag="ul">
                <template v-if="show" #default>
                    <li class="test" v-for="value in list" :key="value"> {{ value }}</li>
                </template>
            </TransitionGroup>
        </div>
    </div>
</template>
