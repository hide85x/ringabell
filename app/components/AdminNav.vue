<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <nav class="admin-nav">
    <a href="/" class="back-link">
      <svg class="bell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      WRÓĆ
    </a>
    <a href="/" class="nav-logo">RING<span class="logo-accent">ABELL</span></a>
    <div class="nav-links">
      <a href="/admin/users" class="nav-link" :class="{ active: route.path === '/admin/users' }">USERS</a>
      <a href="/admin/dictionaries" class="nav-link" :class="{ active: route.path === '/admin/dictionaries' }">DICTIONARIES</a>
      <a href="/manager/events" class="nav-link" :class="{ active: route.path.startsWith('/manager/events') }">GALE</a>
      <a href="/manager/personnel" class="nav-link" :class="{ active: route.path === '/manager/personnel' }">PERSONEL</a>
    </div>
  </nav>
</template>

<style scoped>
.admin-nav {
  display: flex;
  align-items: center;
  gap: 24px;
  background: #1a0808;
  border-bottom: 3px solid #f20d0d;
  padding: 14px 32px;
  font-family: 'Space Grotesk', sans-serif;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  font-weight: 700;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  padding: 5px 12px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  transform: rotate(2deg);
  transition: none;
}

.back-link:hover {
  color: white;
  border-color: white;
  transform: rotate(-2deg);
  box-shadow: 2px 2px 0px white;
}

.bell-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.nav-logo {
  font-size: 1.3rem;
  font-weight: 900;
  font-style: italic;
  letter-spacing: 0.05em;
  color: white;
  text-decoration: none;
  transform: skewX(-8deg);
  display: inline-block;
}

.logo-accent {
  color: #f20d0d;
}

.nav-links {
  display: flex;
  gap: 12px;
  margin-left: auto;
}

.nav-link {
  display: inline-block;
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  padding: 6px 14px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  transform: rotate(2deg);
  transition: none;
}

.nav-link:hover {
  color: white;
  border-color: white;
  transform: rotate(-2deg);
  box-shadow: 3px 3px 0px white;
}

.nav-link.active {
  color: white;
  border-color: white;
  box-shadow: 3px 3px 0px white;
}
</style>
