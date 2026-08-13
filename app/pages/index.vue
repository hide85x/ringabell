<template>
  <div class="page">
    <div class="brand">
      <h1 class="title">RING<span class="title-accent">ABELL</span></h1>
      <p class="subtitle">System zarządzania galami bokserskimi</p>
    </div>

    <div v-if="error === 'unauthorized'" class="error-banner">
      Twój email nie jest autoryzowany. Skontaktuj się z Administratorem.
    </div>

    <div v-if="loggedIn" class="logged-in">
      <div class="user-info">
        <img v-if="user?.avatar" :src="user.avatar" class="avatar">
        <div>
          <p class="user-name">{{ user?.name }}</p>
          <p class="user-email">{{ user?.email }}</p>
        </div>
        <span class="role-badge">{{ user?.role?.toUpperCase() }}</span>
      </div>
      <button class="btn-logout" @click="clear()">WYLOGUJ</button>
      <a v-if="user?.role === 'Admin'" href="/admin/users" class="btn-admin">ZARZĄDZAJ UŻYTKOWNIKAMI →</a>
      <a v-if="user?.role === 'Admin'" href="/admin/dictionaries" class="btn-admin">ZARZĄDZAJ SŁOWNIKAMI →</a>
      <a v-if="user?.role === 'Admin' || user?.role === 'Manager'" href="/manager/events" class="btn-manager">ZARZĄDZAJ GALAMI →</a>
      <a v-if="user?.role === 'Admin' || user?.role === 'Manager'" href="/manager/personnel" class="btn-manager">ZARZĄDZAJ PERSONELEM →</a>
      <a v-if="user?.role === 'Personel'" href="/personel/schedule" class="btn-manager">MOJE GALE →</a>
    </div>

    <div v-else class="login-section">
      <form class="credentials-form" @submit.prevent="loginCredentials">
        <div class="field">
          <label>EMAIL</label>
          <input v-model="loginEmail" type="email" class="text-input" placeholder="jan@gmail.com" autocomplete="email">
        </div>
        <div class="field">
          <label>HASŁO</label>
          <input v-model="loginPassword" type="password" class="text-input" placeholder="••••••••" autocomplete="current-password">
        </div>
        <p v-if="loginError" class="login-error">{{ loginError }}</p>
        <button type="submit" class="btn-login" :disabled="loginLoading || !loginEmail || !loginPassword">
          {{ loginLoading ? 'LOGOWANIE...' : 'ZALOGUJ' }}
        </button>
      </form>

      <div class="divider"><span>lub</span></div>

      <a href="/auth/google" class="btn-google">
        Zaloguj przez Google
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({
  link: [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;900&display=swap' }],
})

const { loggedIn, user, clear, fetch: fetchSession } = useUserSession()
const route = useRoute()
const error = computed(() => route.query.error as string | undefined)

const loginEmail = ref('')
const loginPassword = ref('')
const loginError = ref('')
const loginLoading = ref(false)

async function loginCredentials() {
  loginError.value = ''
  loginLoading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: loginEmail.value, password: loginPassword.value },
    })
    await fetchSession()
  }
  catch {
    loginError.value = 'Nieprawidłowy email lub hasło.'
  }
  finally {
    loginLoading.value = false
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #221010;
  color: white;
  font-family: 'Space Grotesk', sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
}

.brand {
  text-align: center;
  margin-bottom: 40px;
}

.title {
  font-size: 3rem;
  font-weight: 900;
  letter-spacing: 0.05em;
  margin: 0 0 8px;
  font-style: italic;
}

.title-accent {
  color: #f20d0d;
}

.subtitle {
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  margin: 0;
}

.error-banner {
  background: #f20d0d;
  color: white;
  font-weight: 700;
  padding: 12px 20px;
  margin-bottom: 24px;
  border: 2px solid white;
  box-shadow: 3px 3px 0px white;
  font-size: 0.85rem;
  letter-spacing: 0.03em;
  max-width: 400px;
  width: 100%;
  text-align: center;
}

.login-section {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.credentials-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  border: 2px solid #f20d0d;
  padding: 24px;
  background: #1a0808;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.text-input {
  background: #2d1010;
  border: 2px solid #f20d0d;
  color: white;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.9rem;
  padding: 10px 12px;
  width: 100%;
  box-sizing: border-box;
}

.text-input::placeholder {
  color: rgba(255, 255, 255, 0.2);
}

.text-input:focus {
  outline: none;
  border-color: white;
}

.login-error {
  margin: 0;
  font-size: 0.8rem;
  color: #f20d0d;
  font-weight: 700;
}

.btn-login {
  background: #f20d0d;
  border: none;
  color: white;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 900;
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  padding: 12px;
  cursor: pointer;
  width: 100%;
  transform: rotate(2deg);
  transition: none;
}

.btn-login:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-login:not(:disabled):hover {
  transform: rotate(-2deg);
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  color: rgba(255, 255, 255, 0.25);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.15);
}

.btn-google {
  display: block;
  text-align: center;
  padding: 12px 24px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  text-decoration: none;
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  transform: rotate(2deg);
  transition: none;
}

.btn-google:hover {
  border-color: white;
  background: rgba(255, 255, 255, 0.08);
  transform: rotate(-2deg);
}

.logged-in {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 2px solid #f20d0d;
  padding: 16px;
  background: #1a0808;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 2px;
  object-fit: cover;
}

.user-name {
  margin: 0 0 2px;
  font-weight: 700;
  font-size: 0.95rem;
}

.user-email {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}

.role-badge {
  margin-left: auto;
  font-size: 0.65rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  padding: 3px 10px;
  background: #f20d0d;
  color: white;
  flex-shrink: 0;
}

.btn-logout {
  background: transparent;
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.6);
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  padding: 8px;
  cursor: pointer;
  transform: rotate(2deg);
  transition: none;
}

.btn-logout:hover {
  border-color: white;
  color: white;
  transform: rotate(-2deg);
}

.btn-admin {
  display: block;
  text-align: center;
  padding: 12px;
  background: #f20d0d;
  color: white;
  text-decoration: none;
  font-weight: 900;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  border: 2px solid white;
  box-shadow: 4px 4px 0px white;
  transform: rotate(2deg);
  transition: none;
}

.btn-admin:hover {
  transform: rotate(-2deg);
  box-shadow: 4px 4px 0px white;
}

.btn-manager {
  display: block;
  text-align: center;
  padding: 12px;
  background: transparent;
  color: white;
  text-decoration: none;
  font-weight: 900;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  border: 2px solid white;
  box-shadow: 4px 4px 0px white;
  transform: rotate(-2deg);
  transition: none;
}

.btn-manager:hover {
  transform: rotate(2deg);
  background: white;
  color: #221010;
}
</style>
