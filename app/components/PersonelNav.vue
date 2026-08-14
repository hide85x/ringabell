<script setup lang="ts">
const { user, clear } = useUserSession()

async function logout() {
  await clear()
  await navigateTo('/')
}
</script>

<template>
  <nav class="personel-nav">
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
.personel-nav {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px 24px;
  background: #1a0808;
  border-bottom: 3px solid #f20d0d;
  padding: 14px 32px;
  font-family: 'Space Grotesk', sans-serif;
}

@media (max-width: 600px) {
  .personel-nav {
    padding: 10px 14px;
    gap: 8px 14px;
  }

  .nav-logo {
    font-size: 1rem;
    order: -1;
    flex-basis: 100%;
  }

  .back-link,
  .btn-logout {
    font-size: 0.65rem;
    padding: 4px 8px;
  }

  .user-name {
    font-size: 0.7rem;
  }
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
</style>
