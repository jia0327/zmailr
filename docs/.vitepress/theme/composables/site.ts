import { ref, onMounted } from 'vue';

const origin = ref('');
const mailDomain = ref('');
let initialized = false;

export function useSiteContext() {
  onMounted(() => {
    if (initialized) return;
    initialized = true;
    origin.value = window.location.origin;
    void fetch('/api/config')
      .then((res) => res.json())
      .then((data: { success?: boolean; config?: { emailDomains?: string[] } }) => {
        const domains = data.config?.emailDomains;
        if (data.success && domains?.length) {
          mailDomain.value = domains[0];
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!mailDomain.value) {
          mailDomain.value = window.location.hostname;
        }
      });
  });

  return { origin, mailDomain };
}
