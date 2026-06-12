<template>
  <span aria-hidden="true" hidden></span>
</template>

<script setup lang="ts">
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { onMounted, onUnmounted } from 'vue';
import { canAutoSyncHealthConnectMetrics, syncHealthConnectMetrics } from '@/shared/health/healthConnect';
import { runDailyBackupIfNeeded } from '@/shared/utils/driveBackup';

const syncIntervalMs = 30 * 60 * 1000;
const minSyncGapMs = 10 * 60 * 1000;

let syncing = false;
let lastSyncAt = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
let visibilityHandler: (() => void) | null = null;
let appStateListener: { remove: () => Promise<void> } | null = null;

const syncIfNeeded = async () => {
  if (syncing) return;

  const now = Date.now();
  if (lastSyncAt && now - lastSyncAt < minSyncGapMs) {
    return;
  }

  syncing = true;

  try {
    const canSync = await canAutoSyncHealthConnectMetrics();
    if (!canSync) {
      return;
    }

    await syncHealthConnectMetrics();
    lastSyncAt = Date.now();
  } catch (error) {
    console.error('Health Connect auto sync failed:', error);
  } finally {
    syncing = false;
  }
};

onMounted(async () => {
  await syncIfNeeded();
  void runDailyBackupIfNeeded();

  // Health Connect may not be ready immediately on cold start — retry after a
  // short delay so a skipped startup sync recovers without waiting 30 minutes.
  retryTimeoutId = setTimeout(() => { syncIfNeeded().catch(e => console.error('[HC retry]', e)); }, 6_000);

  intervalId = setInterval(() => {
    void syncIfNeeded();
  }, syncIntervalMs);

  if (Capacitor.isNativePlatform()) {
    appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void syncIfNeeded();
      }
    });
  } else if (typeof document !== 'undefined') {
    visibilityHandler = () => {
      if (!document.hidden) {
        void syncIfNeeded();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  }
});

onUnmounted(() => {
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  if (visibilityHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }

  if (appStateListener) {
    void appStateListener.remove();
    appStateListener = null;
  }
});
</script>
