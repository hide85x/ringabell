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
}

const { data: roles, refresh: refreshRoles } = await useFetch<Role[]>('/api/admin/dictionaries/roles')
const { data: requirements, refresh: refreshRequirements } = await useFetch<Requirement[]>('/api/admin/dictionaries/requirements')

function requirementCount(roleId: string) {
  return requirements.value?.find(r => r.roleId === roleId)?.count ?? null
}

// --- Add role modal ---
const showAddRole = ref(false)
const addRoleName = ref('')
const addRoleError = ref('')
const addRoleSaving = ref(false)

function openAddRole() {
  addRoleName.value = ''
  addRoleError.value = ''
  showAddRole.value = true
}

async function saveAddRole() {
  addRoleError.value = ''
  addRoleSaving.value = true
  try {
    await $fetch('/api/admin/dictionaries/roles', {
      method: 'POST',
      body: { name: addRoleName.value },
    })
    await refreshRoles()
    showAddRole.value = false
  }
  catch (err: any) {
    addRoleError.value = err?.statusCode === 409 ? 'Taka rola już istnieje.' : 'Błąd — spróbuj ponownie.'
  }
  finally {
    addRoleSaving.value = false
  }
}

// --- Edit role modal ---
const editRole = ref<Role | null>(null)
const editRoleName = ref('')
const editRoleError = ref('')
const editRoleSaving = ref(false)
const editRoleDeleting = ref(false)

function openEditRole(role: Role) {
  editRole.value = role
  editRoleName.value = role.name
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
    await refreshRoles()
    editRole.value = null
  }
  catch (err: any) {
    editRoleError.value = err?.statusCode === 409 ? 'Taka rola już istnieje.' : 'Błąd — spróbuj ponownie.'
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
  catch (err: any) {
    editRoleError.value = err?.statusCode === 409 ? 'Rola jest używana — usuń najpierw osoby z tą rolą.' : 'Błąd — spróbuj ponownie.'
  }
  finally {
    editRoleDeleting.value = false
  }
}

// --- Add requirement modal ---
const showAddReq = ref(false)
const addReqRoleId = ref('')
const addReqCount = ref(1)
const addReqError = ref('')
const addReqSaving = ref(false)

function openAddReq() {
  addReqRoleId.value = roles.value?.[0]?.id ?? ''
  addReqCount.value = 1
  addReqError.value = ''
  showAddReq.value = true
}

async function saveAddReq() {
  addReqError.value = ''
  addReqSaving.value = true
  try {
    await $fetch('/api/admin/dictionaries/requirements', {
      method: 'POST',
      body: { roleId: addReqRoleId.value, count: Number(addReqCount.value) },
    })
    await refreshRequirements()
    showAddReq.value = false
  }
  catch (err: any) {
    addReqError.value = err?.statusCode === 409 ? 'Wymaganie dla tej roli już istnieje.' : 'Błąd — spróbuj ponownie.'
  }
  finally {
    addReqSaving.value = false
  }
}

// --- Edit requirement modal ---
const editReq = ref<Requirement | null>(null)
const editReqCount = ref(1)
const editReqError = ref('')
const editReqSaving = ref(false)
const editReqDeleting = ref(false)

function openEditReq(req: Requirement) {
  editReq.value = req
  editReqCount.value = req.count
  editReqError.value = ''
}

async function saveEditReq() {
  if (!editReq.value) return
  editReqError.value = ''
  editReqSaving.value = true
  try {
    await $fetch(`/api/admin/dictionaries/requirements/${editReq.value.id}`, {
      method: 'PATCH',
      body: { count: Number(editReqCount.value) },
    })
    await refreshRequirements()
    editReq.value = null
  }
  catch (err: any) {
    editReqError.value = 'Błąd — spróbuj ponownie.'
  }
  finally {
    editReqSaving.value = false
  }
}

async function deleteReq() {
  if (!editReq.value) return
  if (!window.confirm(`Usuń wymaganie dla roli "${editReq.value.roleName}"?`)) return
  editReqDeleting.value = true
  try {
    await $fetch(`/api/admin/dictionaries/requirements/${editReq.value.id}`, { method: 'DELETE' })
    await refreshRequirements()
    editReq.value = null
  }
  catch {
    editReqError.value = 'Błąd — spróbuj ponownie.'
  }
  finally {
    editReqDeleting.value = false
  }
}
</script>

<template>
  <div class="page">
    <AdminNav />

    <div class="content">
      <!-- ROLE section -->
      <div class="section">
        <div class="section-header">
          <div class="section-badge">ROLE</div>
          <button class="add-btn" @click="openAddRole">+ DODAJ ROLĘ</button>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>NAZWA</th>
              <th>WYMAGANIA WALK</th>
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
                <span v-if="requirementCount(role.id) !== null" class="count-badge">
                  {{ requirementCount(role.id) }}
                </span>
                <span v-else class="count-empty">—</span>
              </td>
              <td>
                <button class="edit-btn" @click="openEditRole(role)">EDIT</button>
              </td>
            </tr>
            <tr v-if="!roles?.length">
              <td colspan="3" class="empty-row">Brak ról. Dodaj pierwszą →</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- WYMAGANIA WALK section -->
      <div class="section">
        <div class="section-header">
          <div class="section-badge">WYMAGANIA WALK</div>
          <button class="add-btn" @click="openAddReq">+ DODAJ WYMAGANIE</button>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>ROLA</th>
              <th>LICZBA OSÓB</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="req in requirements" :key="req.id">
              <td>
                <span class="row-bar" />
                {{ req.roleName }}
              </td>
              <td>
                <span class="count-badge">{{ req.count }}</span>
              </td>
              <td>
                <button class="edit-btn" @click="openEditReq(req)">EDIT</button>
              </td>
            </tr>
            <tr v-if="!requirements?.length">
              <td colspan="3" class="empty-row">Brak wymagań. Dodaj pierwsze →</td>
            </tr>
          </tbody>
        </table>
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
          <p v-if="addRoleError" class="form-error">{{ addRoleError }}</p>
        </div>
        <div class="modal-footer">
          <button class="save-btn" :disabled="addRoleSaving || !addRoleName.trim()" @click="saveAddRole">
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
          <p v-if="editRoleError" class="form-error">{{ editRoleError }}</p>
        </div>
        <div class="modal-footer">
          <button class="save-btn" :disabled="editRoleSaving || !editRoleName.trim()" @click="saveEditRole">
            {{ editRoleSaving ? 'ZAPISUJĘ...' : 'ZAPISZ' }}
          </button>
          <button class="cancel-btn" :disabled="editRoleDeleting" @click="deleteRole">
            {{ editRoleDeleting ? 'USUWAM...' : 'USUŃ' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Add requirement modal -->
    <div v-if="showAddReq" class="modal-overlay" @click.self="showAddReq = false">
      <div class="modal">
        <div class="modal-header">
          <span>DODAJ WYMAGANIE</span>
          <button class="close-btn" @click="showAddReq = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>ROLA</label>
            <select v-model="addReqRoleId" class="text-input">
              <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</option>
            </select>
          </div>
          <div class="field">
            <label>LICZBA OSÓB</label>
            <input v-model="addReqCount" type="number" min="1" class="text-input">
          </div>
          <p v-if="addReqError" class="form-error">{{ addReqError }}</p>
        </div>
        <div class="modal-footer">
          <button class="save-btn" :disabled="addReqSaving || !addReqRoleId" @click="saveAddReq">
            {{ addReqSaving ? 'DODAJĘ...' : 'DODAJ' }}
          </button>
          <button class="cancel-btn" @click="showAddReq = false">ANULUJ</button>
        </div>
      </div>
    </div>

    <!-- Edit requirement modal -->
    <div v-if="editReq" class="modal-overlay" @click.self="editReq = null">
      <div class="modal">
        <div class="modal-header">
          <span>EDYTUJ WYMAGANIE</span>
          <button class="close-btn" @click="editReq = null">✕</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>ROLA</label>
            <p class="field-value">{{ editReq.roleName }}</p>
          </div>
          <div class="field">
            <label>LICZBA OSÓB</label>
            <input v-model="editReqCount" type="number" min="1" class="text-input">
          </div>
          <p v-if="editReqError" class="form-error">{{ editReqError }}</p>
        </div>
        <div class="modal-footer">
          <button class="save-btn" :disabled="editReqSaving" @click="saveEditReq">
            {{ editReqSaving ? 'ZAPISUJĘ...' : 'ZAPISZ' }}
          </button>
          <button class="cancel-btn" :disabled="editReqDeleting" @click="deleteReq">
            {{ editReqDeleting ? 'USUWAM...' : 'USUŃ' }}
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
  display: flex;
  flex-direction: column;
  gap: 48px;
}

/* Section */
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
  font-size: 1.1rem;
  font-weight: 900;
  font-style: italic;
  padding: 6px 20px;
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
  transform: skewX(-8deg);
  transition: none;
}

.add-btn:hover {
  background: white;
  color: #221010;
  transform: skewX(-8deg) rotate(-3deg);
}

/* Table */
.data-table {
  width: 100%;
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
  position: relative;
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
  flex-shrink: 0;
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
  color: rgba(255, 255, 255, 0.3);
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
  transform: skewX(-8deg);
  transition: none;
}

.edit-btn:hover {
  background: white;
  color: #221010;
  transform: skewX(-8deg) rotate(-3deg);
}

/* Modal */
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

.field-value {
  margin: 0;
  font-weight: 500;
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
  transform: skewX(-8deg);
  transition: none;
}

.cancel-btn:hover:not(:disabled) {
  background: #f20d0d;
  color: white;
  transform: skewX(-8deg) rotate(-3deg);
}

.cancel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
