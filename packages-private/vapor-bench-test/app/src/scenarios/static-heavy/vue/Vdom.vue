<script setup lang="ts">
import { onMounted } from 'vue'
import { createStaticHeavyData } from '../data.mjs'
import { markStaticHeavyReady } from '../ready'

const page = createStaticHeavyData()

onMounted(() => markStaticHeavyReady('vdom'))
</script>

<template>
  <main
    class="static-heavy-shell"
    data-scenario="static-heavy"
    data-target="vdom"
  >
    <header class="static-heavy-header">
      <div>
        <p>Static workload</p>
        <h1>Static-heavy first screen</h1>
      </div>
      <div class="static-metrics" aria-label="Static metrics">
        <span v-for="metric in page.metrics" :key="metric.id">
          {{ metric.label }} {{ metric.value }}
        </span>
      </div>
    </header>

    <section class="static-stack" aria-label="Static regions">
      <article
        v-for="section in page.sections"
        :key="section.id"
        class="static-section"
      >
        <header>
          <h2>{{ section.title }}</h2>
          <span>20 static tiles</span>
        </header>
        <div class="static-item-grid">
          <article class="static-item tone-a">
            <span>Pipeline</span>
            <strong>North market</strong>
            <p>Stable static plan with contract review complete.</p>
          </article>
          <article class="static-item tone-b">
            <span>Forecast</span>
            <strong>Renewal cohort</strong>
            <p>Quarterly baseline remains inside expected range.</p>
          </article>
          <article class="static-item tone-c">
            <span>Accounts</span>
            <strong>Enterprise pool</strong>
            <p>Segment coverage stays balanced across territories.</p>
          </article>
          <article class="static-item tone-a">
            <span>Signals</span>
            <strong>Product usage</strong>
            <p>Adoption trend is steady through the current cycle.</p>
          </article>
          <article class="static-item tone-b">
            <span>Risk</span>
            <strong>Support queue</strong>
            <p>Open issues are grouped by team and severity.</p>
          </article>
          <article class="static-item tone-c">
            <span>Capacity</span>
            <strong>Field team</strong>
            <p>Coverage map keeps ownership clear for handoff.</p>
          </article>
          <article class="static-item tone-a">
            <span>Program</span>
            <strong>Launch motion</strong>
            <p>Readiness checklist is complete for the next wave.</p>
          </article>
          <article class="static-item tone-b">
            <span>Partners</span>
            <strong>Channel mix</strong>
            <p>Partner-sourced demand holds at the planned level.</p>
          </article>
          <article class="static-item tone-c">
            <span>Quality</span>
            <strong>Review gates</strong>
            <p>Static validation notes stay attached to the plan.</p>
          </article>
          <article class="static-item tone-a">
            <span>Operations</span>
            <strong>Weekly rhythm</strong>
            <p>Runbook ownership remains clear after rotation.</p>
          </article>
          <article class="static-item tone-b">
            <span>Finance</span>
            <strong>Budget lane</strong>
            <p>Spend categories match approved planning bands.</p>
          </article>
          <article class="static-item tone-c">
            <span>Delivery</span>
            <strong>Milestone set</strong>
            <p>Release checkpoints keep the delivery map stable.</p>
          </article>
          <article class="static-item tone-a">
            <span>Enablement</span>
            <strong>Training path</strong>
            <p>Team guidance is published for the active region.</p>
          </article>
          <article class="static-item tone-b">
            <span>Platform</span>
            <strong>Service plan</strong>
            <p>Infrastructure capacity is reserved for launch.</p>
          </article>
          <article class="static-item tone-c">
            <span>Security</span>
            <strong>Access review</strong>
            <p>Permission groups remain aligned with ownership.</p>
          </article>
          <article class="static-item tone-a">
            <span>Research</span>
            <strong>Customer readout</strong>
            <p>Interview notes are mapped to stable categories.</p>
          </article>
          <article class="static-item tone-b">
            <span>Planning</span>
            <strong>Roadmap board</strong>
            <p>Dependencies are grouped by milestone and owner.</p>
          </article>
          <article class="static-item tone-c">
            <span>Experience</span>
            <strong>Journey map</strong>
            <p>Customer touchpoints remain unchanged this cycle.</p>
          </article>
          <article class="static-item tone-a">
            <span>Analytics</span>
            <strong>Model snapshot</strong>
            <p>Baseline views are stable for first-screen review.</p>
          </article>
          <article class="static-item tone-b">
            <span>Archive</span>
            <strong>Decision log</strong>
            <p>Historical context stays visible to reviewers.</p>
          </article>
        </div>
      </article>
    </section>
  </main>
</template>
