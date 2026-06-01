<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

useHead({
  link: [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;900&display=swap' }],
})

interface UserDoc {
  id: string
  email: string
  name: string
  avatar: string
  role: 'Admin' | 'Manager' | 'Personel'
  createdAt: string
}

const { data: users, refresh } = await useFetch<UserDoc[]>('/api/admin/users')

// Edit modal
const selectedUser = ref<UserDoc | null>(null)
const selectedRole = ref<'Admin' | 'Manager' | 'Personel'>('Personel')
const saving = ref(false)
const deleting = ref(false)

// Invite modal
const showInvite = ref(false)
const inviteEmail = ref('')
const inviteRole = ref<'Admin' | 'Manager' | 'Personel'>('Personel')
const invitePassword = ref('')
const inviting = ref(false)
const inviteError = ref('')

function openModal(user: UserDoc) {
  selectedUser.value = user
  selectedRole.value = user.role
}

function closeModal() {
  selectedUser.value = null
}

function openInvite() {
  inviteEmail.value = ''
  inviteRole.value = 'Personel'
  invitePassword.value = ''
  inviteError.value = ''
  showInvite.value = true
}

function closeInvite() {
  invitePassword.value = ''
  showInvite.value = false
}

async function saveRole() {
  if (!selectedUser.value) return
  saving.value = true
  try {
    await $fetch(`/api/admin/users/${selectedUser.value.id}`, {
      method: 'PATCH',
      body: { role: selectedRole.value },
    })
    await refresh()
    closeModal()
  }
  finally {
    saving.value = false
  }
}

async function deleteUser() {
  if (!selectedUser.value) return
  if (!window.confirm(`Usuń użytkownika ${selectedUser.value.name || selectedUser.value.email}?`)) return
  deleting.value = true
  try {
    await $fetch(`/api/admin/users/${selectedUser.value.id}`, { method: 'DELETE' })
    await refresh()
    closeModal()
  }
  finally {
    deleting.value = false
  }
}

async function inviteUser() {
  inviteError.value = ''
  inviting.value = true
  try {
    await $fetch('/api/admin/users', {
      method: 'POST',
      body: {
        email: inviteEmail.value,
        role: inviteRole.value,
        ...(invitePassword.value ? { password: invitePassword.value } : {}),
      },
    })
    await refresh()
    closeInvite()
  }
  catch (err: any) {
    if (err?.statusCode === 409) {
      inviteError.value = 'Ten email już istnieje w systemie.'
    }
    else {
      inviteError.value = 'Błąd — sprawdź email i spróbuj ponownie.'
    }
  }
  finally {
    inviting.value = false
  }
}
</script>

<template>
  <div class="page">
    <AdminNav />

    <div class="content">
      <div class="section-header">
        <div class="title-badge">USERS</div>
        <button class="add-btn" @click="openInvite">+ DODAJ UŻYTKOWNIKA</button>
      </div>

      <table class="user-table">
        <thead>
          <tr>
            <th>UŻYTKOWNIK</th>
            <th>EMAIL</th>
            <th>ROLA</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>
              <div class="user-cell">
                <img v-if="user.avatar" :src="user.avatar" :alt="user.name" class="avatar">
                <span v-else class="avatar-placeholder">?</span>
                <strong>{{ user.name || '—' }}</strong>
              </div>
            </td>
            <td>{{ user.email }}</td>
            <td>
              <span class="role-badge" :class="user.role.toLowerCase()">{{ user.role.toUpperCase() }}</span>
            </td>
            <td>
              <button class="edit-btn" @click="openModal(user)">EDIT</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit modal -->
    <div v-if="selectedUser" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <span>EDIT USER</span>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>NAZWA</label>
            <p class="field-value">{{ selectedUser.name || '—' }}</p>
          </div>
          <div class="field">
            <label>EMAIL</label>
            <p class="field-value">{{ selectedUser.email }}</p>
          </div>
          <div class="field">
            <label>ROLA</label>
            <select v-model="selectedRole" class="role-select">
              <option value="Admin">Admin</option>
              <option value="Manager">Manager</option>
              <option value="Personel">Personel</option>
            </select>
            <p class="role-note">Zmiana roli wejdzie w życie przy następnym logowaniu użytkownika.</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="save-btn" :disabled="saving" @click="saveRole">
            {{ saving ? 'ZAPISUJĘ...' : 'ZAPISZ' }}
          </button>
          <button class="delete-btn" :disabled="deleting" @click="deleteUser">
            {{ deleting ? 'USUWAM...' : 'USUŃ' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Invite modal -->
    <div v-if="showInvite" class="modal-overlay" @click.self="closeInvite">
      <div class="modal">
        <div class="modal-header">
          <span>DODAJ UŻYTKOWNIKA</span>
          <button class="close-btn" @click="closeInvite">✕</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>EMAIL</label>
            <input v-model="inviteEmail" type="email" class="text-input" placeholder="jan@gmail.com">
          </div>
          <div class="field">
            <label>ROLA</label>
            <select v-model="inviteRole" class="role-select">
              <option value="Admin">Admin</option>
              <option value="Manager">Manager</option>
              <option value="Personel">Personel</option>
            </select>
          </div>
          <div class="field">
            <label>HASŁO (OPCJONALNE)</label>
            <input v-model="invitePassword" type="password" class="text-input" placeholder="Opcjonalne">
          </div>
          <p v-if="inviteError" class="invite-error">{{ inviteError }}</p>
        </div>
        <div class="modal-footer">
          <button class="save-btn" :disabled="inviting || !inviteEmail" @click="inviteUser">
            {{ inviting ? 'DODAJĘ...' : 'DODAJ' }}
          </button>
          <button class="delete-btn" @click="closeInvite">ANULUJ</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #221010;
  color: white;
  font-family: 'Space Grotesk', sans-serif;
}

.content {
  padding: 40px 32px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 32px;
}

.title-badge {
  display: inline-block;
  background: #f20d0d;
  color: white;
  font-size: 1.5rem;
  font-weight: 900;
  font-style: italic;
  padding: 8px 24px;
  transform: skewX(-8deg);
  letter-spacing: 0.05em;
  border: 2px solid white;
  box-shadow: 4px 4px 0px white;
}

.add-btn {
  background: transparent;
  border: 2px solid white;
  color: white;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  padding: 8px 18px;
  cursor: pointer;
  transform: skewX(-8deg);
  transition: none;
}

.add-btn:hover {
  background: white;
  color: #221010;
  transform: skewX(-8deg) rotate(-3deg);
}

.user-table {
  width: 100%;
  border-collapse: collapse;
  border: 2px solid #f20d0d;
}

.user-table th {
  background: #f20d0d;
  color: white;
  font-weight: 900;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  padding: 12px 16px;
  text-align: left;
}

.user-table td {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(242, 13, 13, 0.25);
}

.user-table tr:hover td {
  background: rgba(242, 13, 13, 0.1);
  transition: none;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 2px;
  object-fit: cover;
  filter: grayscale(30%);
}

.avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 2px;
  background: rgba(242, 13, 13, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 0.8rem;
  color: rgba(255,255,255,0.4);
  flex-shrink: 0;
}

.role-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  padding: 3px 10px;
  background: rgba(242, 13, 13, 0.2);
  border: 1px solid #f20d0d;
  color: #f20d0d;
  transform: skewX(-8deg);
}

.role-badge.admin {
  background: #f20d0d;
  color: white;
}

.edit-btn {
  background: transparent;
  border: 2px solid white;
  color: white;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  padding: 4px 14px;
  cursor: pointer;
  transform: skewX(-8deg);
  transition: none;
}

.edit-btn:hover {
  background: white;
  color: #221010;
  transform: skewX(-8deg) rotate(-3deg);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: #1a0808;
  border: 3px solid white;
  box-shadow: 6px 6px 0px white;
  width: 400px;
  max-width: 90vw;
}

.modal-header {
  background: #f20d0d;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  font-weight: 900;
  font-size: 1rem;
  font-style: italic;
  letter-spacing: 0.05em;
  transform: skewX(-4deg);
}

.close-btn {
  background: transparent;
  border: none;
  color: white;
  font-size: 1rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-body {
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field label {
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 4px;
}

.field-value {
  margin: 0;
  font-weight: 500;
}

.role-select,
.text-input {
  width: 100%;
  background: #2d1010;
  border: 2px solid #f20d0d;
  color: white;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  padding: 8px 12px;
  cursor: pointer;
  appearance: none;
  box-sizing: border-box;
}

.text-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
  font-weight: 400;
}

.role-note {
  margin: 6px 0 0;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
}

.invite-error {
  margin: 0;
  font-size: 0.8rem;
  color: #f20d0d;
  font-weight: 700;
}

.modal-footer {
  padding: 0 20px 20px;
  display: flex;
  gap: 12px;
}

.save-btn {
  flex: 1;
  background: #f20d0d;
  border: none;
  color: white;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 900;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  padding: 10px;
  cursor: pointer;
  transform: skewX(-8deg);
  transition: none;
}

.save-btn:hover:not(:disabled) {
  transform: skewX(-8deg) rotate(-3deg);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.delete-btn {
  background: transparent;
  border: 2px solid #f20d0d;
  color: #f20d0d;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  padding: 10px 14px;
  cursor: pointer;
  transform: skewX(-8deg);
  transition: none;
}

.delete-btn:hover:not(:disabled) {
  background: #f20d0d;
  color: white;
  transform: skewX(-8deg) rotate(-3deg);
}

.delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
