<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

useHead({
  link: [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;900&display=swap' }],
})

interface Role {
  id: string
  name: string
  createdAt: string
}

interface Requirement {
  id: string
  roleId: string
  roleName: string
  count: number
  hasCorner: number
}

const { data: roles, refresh: refreshRoles } = await useFetch<Role[]>('/api/admin/dictionaries/roles')
const { data: requirements, refresh: refreshRequirements } = await useFetch<Requirement[]>('/api/admin/dictionaries/requirements')

function requirementForRole(roleId: string) {
  return requirements.value?.find(r => r.roleId === roleId) ?? null
}

// --- Add role modal ---
const showAddRole = ref(false)
const addRoleName = ref('')
const addRoleCount = ref<string>('')
const addRoleHasCorner = ref(false)
const addRoleError = ref('')
const addRoleSaving = ref(false)

const addRoleCountInvalid = computed(() => addRoleHasCorner.value && Number(addRoleCount.value) % 2 !== 0)

function openAddRole() {
  addRoleName.value = ''
  addRoleCount.value = ''
  addRoleHasCorner.value = false
  addRoleError.value = ''
  showAddRole.value = true
}

async function saveAddRole() {
  addRoleError.value = ''
  addRoleSaving.value = true
  try {
    const result = await $fetch<{ ok: boolean; id: string }>('/api/admin/dictionaries/roles', {
      method: 'POST',
      body: { name: addRoleName.value },
    })
    if (addRoleCount.value && Number(addRoleCount.value) >= 1) {
      await $fetch('/api/admin/dictionaries/requirements', {
        method: 'POST',
        body: { roleId: result.id, count: Number(addRoleCount.value), hasCorner: addRoleHasCorner.value },
      })
    }
    await refreshRoles()
    await refreshRequirements()
    showAddRole.value = false
  }
  catch (err: unknown) {
    addRoleError.value = (err as { statusCode?: number })?.statusCode === 409 ? 'Taka rola już istnieje.' : 'Błąd — spróbuj ponownie.'
  }
  finally {
    addRoleSaving.value = false
  }
}

// --- Edit role modal ---
const editRole = ref<Role | null>(null)
const editRoleName = ref('')
const editRoleCount = ref<string>('')
const editRoleHasCorner = ref(false)
const editRoleError = ref('')
const editRoleSaving = ref(false)
const editRoleDeleting = ref(false)

const editRoleCountInvalid = computed(() => editRoleHasCorner.value && Number(editRoleCount.value) % 2 !== 0)

function openEditRole(role: Role) {
  editRole.value = role
  editRoleName.value = role.name
  const existing = requirementForRole(role.id)
  editRoleCount.value = existing ? String(existing.count) : ''
  editRoleHasCorner.value = existing ? !!existing.hasCorner : false
  editRoleError.value = ''
}

async function saveEditRole() {
  if (!editRole.value) return
  editRoleError.value = ''
  editRoleSaving.value = true
  try {
    await $fetch(`/api/admin/dictionaries/roles/${editRole.value.id}`, {
      method: 'PATCH',
      body: { name: editRoleName.value },
    })

    const existing = requirementForRole(editRole.value.id)
    const newCount = editRoleCount.value ? Number(editRoleCount.value) : null

    if (newCount && newCount >= 1) {
      if (existing) {
        await $fetch(`/api/admin/dictionaries/requirements/${existing.id}`, {
          method: 'PATCH',
          body: { count: newCount, hasCorner: editRoleHasCorner.value },
        })
      }
      else {
        await $fetch('/api/admin/dictionaries/requirements', {
          method: 'POST',
          body: { roleId: editRole.value.id, count: newCount, hasCorner: editRoleHasCorner.value },
        })
      }
    }
    else if (!newCount && existing) {
      await $fetch(`/api/admin/dictionaries/requirements/${existing.id}`, { method: 'DELETE' })
    }

    await refreshRoles()
    await refreshRequirements()
    editRole.value = null
  }
  catch (err: unknown) {
    editRoleError.value = (err as { statusCode?: number })?.statusCode === 409 ? 'Taka rola już istnieje.' : 'Błąd — spróbuj ponownie.'
  }
  finally {
    editRoleSaving.value = false
  }
}

async function deleteRole() {
  if (!editRole.value) return
  if (!window.confirm(`Usuń rolę "${editRole.value.name}"?`)) return
  editRoleDeleting.value = true
  try {
    await $fetch(`/api/admin/dictionaries/roles/${editRole.value.id}`, { method: 'DELETE' })
    await refreshRoles()
    await refreshRequirements()
    editRole.value = null
  }
  catch (err: unknown) {
    editRoleError.value = (err as { statusCode?: number })?.statusCode === 409 ? 'Rola jest używana — usuń najpierw osoby z tą rolą.' : 'Błąd — spróbuj ponownie.'
  }
  finally {
    editRoleDeleting.value = false
  }
}
</script>

<template>
  <div class="page">
    <AdminNav />

    <div class="content">
      <div class="section">
        <div class="section-header">
          <div class="section-badge">ROLE</div>
          <button class="add-btn" @click="openAddRole">+ DODAJ ROLĘ</button>
        </div>

        <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>NAZWA</th>
              <th>MIN. NA WALKĘ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="role in roles" :key="role.id">
              <td>
                <span class="row-bar" />
                {{ role.name }}
              </td>
              <td>
                <span v-if="requirementForRole(role.id)" class="count-badge">
                  {{ requirementForRole(role.id)?.count }}
                  <template v-if="requirementForRole(role.id)?.hasCorner">
                    ({{ (requirementForRole(role.id)?.count ?? 0) / 2 }}+{{ (requirementForRole(role.id)?.count ?? 0) / 2 }})
                  </template>
                </span>
                <span v-else class="count-empty">BRAK</span>
              </td>
              <td>
                <button class="edit-btn" @click="openEditRole(role)">EDYTUJ</button>
              </td>
            </tr>
            <tr v-if="!roles?.length">
              <td colspan="3" class="empty-row">Brak ról. Dodaj pierwszą →</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </div>

    <!-- Add role modal -->
    <div v-if="showAddRole" class="modal-overlay" @click.self="showAddRole = false">
      <div class="modal">
        <div class="modal-header">
          <span>DODAJ ROLĘ</span>
          <button class="close-btn" @click="showAddRole = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>NAZWA ROLI</label>
            <input v-model="addRoleName" type="text" class="text-input" placeholder="np. Bokser">
          </div>
          <div class="field">
            <label>MIN. NA WALKĘ (OPCJONALNE)</label>
            <input v-model="addRoleCount" type="number" min="1" class="text-input" placeholder="np. 2">
          </div>
          <div class="field field-checkbox">
            <label><input v-model="addRoleHasCorner" type="checkbox"> NAROŻNIK (podział czerwony/niebieski)</label>
          </div>
          <p v-if="addRoleCountInvalid" class="form-error">Liczba musi być parzysta gdy zaznaczony jest narożnik.</p>
          <p v-if="addRoleError" class="form-error">{{ addRoleError }}</p>
        </div>
        <div class="modal-footer">
          <button class="save-btn" :disabled="addRoleSaving || !addRoleName.trim() || addRoleCountInvalid" @click="saveAddRole">
            {{ addRoleSaving ? 'DODAJĘ...' : 'DODAJ' }}
          </button>
          <button class="cancel-btn" @click="showAddRole = false">ANULUJ</button>
        </div>
      </div>
    </div>

    <!-- Edit role modal -->
    <div v-if="editRole" class="modal-overlay" @click.self="editRole = null">
      <div class="modal">
        <div class="modal-header">
          <span>EDYTUJ ROLĘ</span>
          <button class="close-btn" @click="editRole = null">✕</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>NAZWA ROLI</label>
            <input v-model="editRoleName" type="text" class="text-input">
          </div>
          <div class="field">
            <label>MIN. NA WALKĘ (OPCJONALNE)</label>
            <input v-model="editRoleCount" type="number" min="1" class="text-input" placeholder="zostaw puste = BRAK">
          </div>
          <div class="field field-checkbox">
            <label><input v-model="editRoleHasCorner" type="checkbox"> NAROŻNIK (podział czerwony/niebieski)</label>
          </div>
          <p v-if="editRoleCountInvalid" class="form-error">Liczba musi być parzysta gdy zaznaczony jest narożnik.</p>
          <p v-if="editRoleError" class="form-error">{{ editRoleError }}</p>
        </div>
        <div class="modal-footer">
          <button class="save-btn" :disabled="editRoleSaving || !editRoleName.trim() || editRoleCountInvalid" @click="saveEditRole">
            {{ editRoleSaving ? 'ZAPISUJĘ...' : 'ZAPISZ' }}
          </button>
          <button class="cancel-btn" :disabled="editRoleDeleting" @click="deleteRole">
            {{ editRoleDeleting ? 'USUWAM...' : 'USUŃ' }}
          </button>
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
  margin-bottom: 20px;
}

.section-badge {
  display: inline-block;
  background: #f20d0d;
  color: white;
  font-size: 1.5rem;
  font-weight: 900;
  font-style: italic;
  padding: 8px 24px;
  transform: skewX(-8deg);
  letter-spacing: 0.06em;
  border: 2px solid white;
  box-shadow: 4px 4px 0px white;
}

.add-btn {
  background: transparent;
  border: 2px solid white;
  color: white;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  padding: 7px 16px;
  cursor: pointer;
  transform: rotate(2deg);
  transition: none;
}

.add-btn:hover {
  background: white;
  color: #221010;
  transform: rotate(-2deg);
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.data-table {
  width: 100%;
  min-width: 480px;
  border-collapse: collapse;
  border: 2px solid #f20d0d;
}

.data-table th {
  background: #f20d0d;
  color: white;
  font-weight: 900;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  padding: 10px 16px;
  text-align: left;
}

.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(242, 13, 13, 0.2);
}

.data-table tr:hover td {
  background: rgba(242, 13, 13, 0.1);
  transition: none;
}

.row-bar {
  display: inline-block;
  width: 3px;
  height: 14px;
  background: #f20d0d;
  margin-right: 10px;
  vertical-align: middle;
}

.count-badge {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 900;
  padding: 2px 10px;
  border: 2px solid #f20d0d;
  box-shadow: 3px 3px 0px #f20d0d;
  color: #f20d0d;
  transform: skewX(-8deg);
}

.count-empty {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.25);
}

.empty-row {
  color: rgba(255, 255, 255, 0.3);
  font-style: italic;
  font-size: 0.85rem;
}

.edit-btn {
  background: transparent;
  border: 2px solid white;
  color: white;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  padding: 4px 12px;
  cursor: pointer;
  transform: rotate(2deg);
  transition: none;
}

.edit-btn:hover {
  background: white;
  color: #221010;
  transform: rotate(-2deg);
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
  font-size: 0.95rem;
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

.field-checkbox label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.field-checkbox input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: #f20d0d;
}

.text-input {
  width: 100%;
  background: #2d1010;
  border: 2px solid #f20d0d;
  color: white;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  padding: 8px 12px;
  box-sizing: border-box;
  appearance: none;
}

.text-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
  font-weight: 400;
}

.form-error {
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
  transform: rotate(2deg);
  transition: none;
}

.save-btn:hover:not(:disabled) {
  transform: rotate(-2deg);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-btn {
  background: transparent;
  border: 2px solid #f20d0d;
  color: #f20d0d;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  padding: 10px 14px;
  cursor: pointer;
  transform: rotate(2deg);
  transition: none;
}

.cancel-btn:hover:not(:disabled) {
  background: #f20d0d;
  color: white;
  transform: rotate(-2deg);
}

.cancel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .content {
    padding: 16px 12px;
  }

  .section-header {
    flex-wrap: wrap;
    gap: 12px;
  }

  .section-badge {
    font-size: 1.1rem;
    padding: 6px 16px;
  }

  .data-table th,
  .data-table td {
    padding: 8px 10px;
    font-size: 0.8rem;
  }

  .modal {
    width: 100%;
    max-width: calc(100vw - 30px);
  }
}
</style>
