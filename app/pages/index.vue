<template>
  <div class="page">
    <h1>RingAbell</h1>
    <p class="subtitle">System zarządzania galami bokserskimi</p>

    <div v-if="error === 'unauthorized'" class="error-banner">
      Twój email nie jest autoryzowany. Skontaktuj się z Administratorem.
    </div>

    <div v-if="loggedIn">
      <p>Zalogowany: <strong>{{ user?.name }}</strong> ({{ user?.email }})</p>
      <p>Rola: <strong>{{ user?.role }}</strong></p>
      <button class="btn" @click="clear()">Wyloguj</button>
    </div>
    <div v-else>
      <a href="/auth/google" class="login-btn">Zaloguj przez Google</a>
    </div>
  </div>
</template>

<script setup lang="ts">
const { loggedIn, user, clear } = useUserSession()
const route = useRoute()
const error = computed(() => route.query.error as string | undefined)
</script>

<style scoped>
.page {
  font-family: sans-serif;
  max-width: 480px;
  margin: 100px auto;
  text-align: center;
}

.subtitle {
  color: #666;
}

.error-banner {
  background: #f20d0d;
  color: white;
  font-weight: 700;
  padding: 12px 20px;
  margin: 16px 0;
  border: 2px solid white;
  box-shadow: 3px 3px 0px white;
}

.btn {
  margin-top: 12px;
  padding: 8px 20px;
  cursor: pointer;
}

.login-btn {
  display: inline-block;
  margin-top: 24px;
  padding: 12px 24px;
  background: #4285f4;
  color: white;
  border-radius: 6px;
  text-decoration: none;
}
</style>
