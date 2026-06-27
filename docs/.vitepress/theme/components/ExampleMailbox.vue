<script setup lang="ts">
import { computed } from 'vue';
import { useSiteContext } from '../composables/site';

const props = defineProps<{ local?: string }>();
const { mailDomain } = useSiteContext();

const email = computed(() => {
  const local = props.local ?? 'k7m2x9';
  const domain = mailDomain.value || 'your-mail-domain';
  return `${local}@${domain}`;
});
</script>

<template>
  <code class="example-mailbox">{{ email }}</code>
</template>
