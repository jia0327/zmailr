<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  to: string;
}>();

/** Escape VitePress `/docs/` base so href resolves to site root (e.g. `/login`, not `/docs/login`). */
const href = computed(() => {
  if (/^https?:\/\//i.test(props.to)) return props.to;
  if (props.to.startsWith('/')) return `../..${props.to === '/' ? '' : props.to}`;
  return props.to;
});
</script>

<template>
  <a :href="href" class="site-link"><slot /></a>
</template>
