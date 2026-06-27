<script setup lang="ts">
import { useSiteContext } from '../composables/site';

const { origin } = useSiteContext();
</script>

<template>
  <span class="site-origin">{{ origin || 'https://your-domain' }}</span>
</template>
