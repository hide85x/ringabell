<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <nav class="admin-nav">
    <a href="/" class="nav-logo">RING<span class="logo-accent">ABELL</span></a>
    <div class="nav-links">
      <a href="/admin/users" class="nav-link" :class="{ active: route.path === '/admin/users' }">USERS</a>
      <a href="/admin/dictionaries" class="nav-link" :class="{ active: route.path === '/admin/dictionaries' }">DICTIONARIES</a>
    </div>
  </nav>
</template>

<style scoped>
.admin-nav {
  display: flex;
  align-items: center;
  gap: 32px;
  background: #1a0808;
  border-bottom: 3px solid #f20d0d;
  padding: 14px 32px;
  font-family: 'Space Grotesk', sans-serif;
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
  transform: skewX(-8deg);
  transition: none;
}

.nav-link:hover {
  color: white;
  border-color: white;
  transform: skewX(-8deg) rotate(-3deg);
  box-shadow: 3px 3px 0px white;
}

.nav-link.active {
  color: white;
  border-color: white;
  box-shadow: 3px 3px 0px white;
}
</style>
