import { ref, watch, onUnmounted, type Ref } from 'vue';

/**
 * Ease a numeric ref 0 -> value over `duration` ms with requestAnimationFrame.
 * Returns a display ref bound to the animated value. Falls back to the raw
 * value immediately when rAF is unavailable (SSR/tests).
 */
export function useCountUp(source: Ref<number | null>, duration = 400) {
  const display = ref(0);
  let raf: number | null = null;

  const stop = () => {
    if (raf !== null) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  };

  watch(
    source,
    (target) => {
      stop();
      if (target === null || !Number.isFinite(target)) {
        display.value = 0;
        return;
      }
      if (typeof requestAnimationFrame !== 'function') {
        display.value = target;
        return;
      }
      const from = 0;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        // decel ease approximation of cubic-bezier(0.2, 0, 0, 1)
        const eased = 1 - Math.pow(1 - t, 3);
        display.value = Math.round(from + (target - from) * eased);
        if (t < 1) {
          raf = requestAnimationFrame(step);
        } else {
          raf = null;
        }
      };
      raf = requestAnimationFrame(step);
    },
    { immediate: true }
  );

  onUnmounted(stop);
  return display;
}
