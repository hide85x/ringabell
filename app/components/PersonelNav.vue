<script setup lang="ts">
const { user, clear } = useUserSession()

async function logout() {
  await clear()
  await navigateTo('/')
}
</script>

<template>
  <nav class="app-nav">
    <NuxtLink to="/" class="back-link">
      <svg class="bell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      WRÓĆ
    </NuxtLink>
    <NuxtLink to="/" class="nav-logo">RING<span class="logo-accent">ABELL</span></NuxtLink>
    <div class="nav-right">
      <span class="user-name">{{ user?.name }}</span>
      <button type="button" class="btn-logout" @click="logout()">WYLOGUJ</button>
    </div>
  </nav>
</template>

<style scoped>
.nav-right {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-left: auto;
}

.user-name {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.6);
}

.btn-logout {
  background: transparent;
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.6);
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  padding: 5px 12px;
  cursor: pointer;
  transform: rotate(2deg);
  transition: none;
}

.btn-logout:hover {
  border-color: white;
  color: white;
  transform: rotate(-2deg);
}

@media (max-width: 700px) {
  .btn-logout {
    font-size: 0.65rem;
    padding: 4px 8px;
  }

  .user-name {
    font-size: 0.7rem;
  }
}
</style>
