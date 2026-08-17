<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <nav class="app-nav">
    <a href="/" class="back-link">
      <svg class="bell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      WRÓĆ
    </a>
    <a href="/" class="nav-logo">RING<span class="logo-accent">ABELL</span></a>
    <div class="nav-links">
      <a href="/admin/users" class="nav-link" :class="{ active: route.path === '/admin/users' }">UŻYTKOWNICY</a>
      <a href="/admin/dictionaries" class="nav-link" :class="{ active: route.path === '/admin/dictionaries' }">SŁOWNIKI</a>
      <a href="/manager/events" class="nav-link" :class="{ active: route.path.startsWith('/manager/events') }">GALE</a>
      <a href="/manager/personnel" class="nav-link" :class="{ active: route.path === '/manager/personnel' }">PERSONEL</a>
    </div>
  </nav>
</template>
