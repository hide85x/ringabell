<template>
  <div style="font-family: sans-serif; max-width: 480px; margin: 100px auto; text-align: center;">
    <h1>RingAbell</h1>
    <p style="color: #666;">System zarządzania galami bokserskimi</p>

    <div v-if="loggedIn">
      <p>Zalogowany: <strong>{{ user?.name }}</strong> ({{ user?.email }})</p>
      <button @click="clear()">Wyloguj</button>
    </div>
    <div v-else>
      <a href="/auth/google" style="display: inline-block; margin-top: 24px; padding: 12px 24px; background: #4285f4; color: white; border-radius: 6px; text-decoration: none;">
        Zaloguj przez Google
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
const { loggedIn, user, clear } = useUserSession()
</script>
