<script setup lang="ts">
definePageMeta({ middleware: 'manager' })

useHead({
  link: [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;900&display=swap' }],
})

interface PersonDoc {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  isActive: number
  createdAt: string
}

interface RoleDoc {
  id: string
  name: string
}

const { data: persons, refresh } = await useFetch<PersonDoc[]>('/api/manager/personnel')
const { data: roles } = await useFetch<RoleDoc[]>('/api/manager/dictionaries/roles')

// Edit modal
const selectedPerson = ref<PersonDoc | null>(null)
const editName = ref('')
const editEmail = ref('')
const editPhone = ref('')
const editRole = ref('')
const saving = ref(false)
const deactivating = ref(false)
const editError = ref('')

// Add modal
const showAdd = ref(false)
const addName = ref('')
const addEmail = ref('')
const addPhone = ref('')
const addRole = ref('')
const adding = ref(false)
const addError = ref('')

function openModal(person: PersonDoc) {
  selectedPerson.value = person
  editName.value = person.name
  editEmail.value = person.email ?? ''
  editPhone.value = person.phone ?? ''
  editRole.value = person.role
  editError.value = ''
}

function closeModal() {
  selectedPerson.value = null
  editError.value = ''
}

function openAdd() {
  addName.value = ''
  addEmail.value = ''
  addPhone.value = ''
  addRole.value = roles.value?.[0]?.name ?? ''
  addError.value = ''
  showAdd.value = true
}

function closeAdd() {
  showAdd.value = false
}

async function savePerson() {
  if (!selectedPerson.value) return
  if (!editEmail.value.trim()) {
    editError.value = 'Email jest wymagany.'
    return
  }
  if (!editEmail.value.includes('@')) {
    editError.value = 'Podaj prawidłowy adres email.'
    return
  }
  if (!editPhone.value.trim()) {
    editError.value = 'Telefon jest wymagany.'
    return
  }
  if (!/^[\d\s()\-+]{7,}$/.test(editPhone.value)) {
    editError.value = 'Podaj prawidłowy numer telefonu.'
    return
  }
  saving.value = true
  editError.value = ''
  try {
    await $fetch(`/api/manager/personnel/${selectedPerson.value.id}`, {
      method: 'PATCH',
      body: {
        name: editName.value,
        email: editEmail.value || null,
        phone: editPhone.value || null,
        role: editRole.value,
      },
    })
    await refresh()
    closeModal()
  }
  catch {
    editError.value = 'Błąd — sprawdź dane i spróbuj ponownie.'
  }
  finally {
    saving.value = false
  }
}

async function deactivatePerson() {
  if (!selectedPerson.value) return
  if (!window.confirm(`Dezaktywuj ${selectedPerson.value.name}?`)) return
  deactivating.value = true
  editError.value = ''
  try {
    await $fetch(`/api/manager/personnel/${selectedPerson.value.id}`, { method: 'DELETE' })
    await refresh()
    closeModal()
  }
  catch {
    editError.value = 'Błąd dezaktywacji — spróbuj ponownie.'
  }
  finally {
    deactivating.value = false
  }
}

async function addPerson() {
  addError.value = ''
  if (!addEmail.value.trim()) {
    addError.value = 'Email jest wymagany.'
    return
  }
  if (!addEmail.value.includes('@')) {
    addError.value = 'Podaj prawidłowy adres email.'
    return
  }
  if (!addPhone.value.trim()) {
    addError.value = 'Telefon jest wymagany.'
    return
  }
  if (!/^[\d\s()\-+]{7,}$/.test(addPhone.value)) {
    addError.value = 'Podaj prawidłowy numer telefonu.'
    return
  }
  adding.value = true
  try {
    await $fetch('/api/manager/personnel', {
      method: 'POST',
      body: {
        name: addName.value,
        email: addEmail.value || null,
        phone: addPhone.value || null,
        role: addRole.value,
      },
    })
    await refresh()
    closeAdd()
  }
  catch {
    addError.value = 'Błąd — sprawdź dane i spróbuj ponownie.'
  }
  finally {
    adding.value = false
  }
}
</script>

<template>
  <div class="page">
    <ManagerNav />

    <div class="content">
      <div class="section-header">
        <div class="title-badge">PERSONEL</div>
        <button class="add-btn" @click="openAdd">+ DODAJ OSOBĘ</button>
      </div>

      <table class="personnel-table">
        <thead>
          <tr>
            <th>IMIĘ I NAZWISKO</th>
            <th>ROLA</th>
            <th>EMAIL</th>
            <th>TELEFON</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="person in persons" :key="person.id">
            <td><strong>{{ person.name }}</strong></td>
            <td>
              <span class="role-badge">{{ person.role.toUpperCase() }}</span>
            </td>
            <td>{{ person.email || '—' }}</td>
            <td>{{ person.phone || '—' }}</td>
            <td>
              <button class="edit-btn" @click="openModal(person)">EDIT</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit modal -->
    <div v-if="selectedPerson" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <span>EDYTUJ OSOBĘ</span>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>IMIĘ I NAZWISKO <span class="required">*</span></label>
            <input v-model="editName" type="text" class="text-input" placeholder="Jan Kowalski">
          </div>
          <div class="field">
            <label>ROLA <span class="required">*</span></label>
            <select v-model="editRole" class="role-select">
              <option v-for="r in roles" :key="r.id" :value="r.name">{{ r.name }}</option>
            </select>
          </div>
          <div class="field">
            <label>EMAIL <span class="required">*</span></label>
            <input v-model="editEmail" type="email" class="text-input" placeholder="jan@example.com">
          </div>
          <div class="field">
            <label>TELEFON <span class="required">*</span></label>
            <input v-model="editPhone" type="text" class="text-input" placeholder="+48 600 000 000">
          </div>
        </div>
        <p class="required-hint"><span class="required">*</span> pole wymagane</p>
        <p v-if="editError" class="modal-error">{{ editError }}</p>
        <div class="modal-footer">
          <button class="save-btn" :disabled="saving" @click="savePerson">
            {{ saving ? 'ZAPISUJĘ...' : 'ZAPISZ' }}
          </button>
          <button class="delete-btn" :disabled="deactivating" @click="deactivatePerson">
            {{ deactivating ? 'DEZAKTYWUJĘ...' : 'DEZAKTYWUJ' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Add modal -->
    <div v-if="showAdd" class="modal-overlay" @click.self="closeAdd">
      <div class="modal">
        <div class="modal-header">
          <span>DODAJ OSOBĘ</span>
          <button class="close-btn" @click="closeAdd">✕</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>IMIĘ I NAZWISKO <span class="required">*</span></label>
            <input v-model="addName" type="text" class="text-input" placeholder="Jan Kowalski">
          </div>
          <div class="field">
            <label>ROLA <span class="required">*</span></label>
            <select v-model="addRole" class="role-select">
              <option v-for="r in roles" :key="r.id" :value="r.name">{{ r.name }}</option>
            </select>
          </div>
          <div class="field">
            <label>EMAIL <span class="required">*</span></label>
            <input v-model="addEmail" type="email" class="text-input" placeholder="jan@example.com">
          </div>
          <div class="field">
            <label>TELEFON <span class="required">*</span></label>
            <input v-model="addPhone" type="text" class="text-input" placeholder="+48 600 000 000">
          </div>
          <p class="required-hint"><span class="required">*</span> pole wymagane</p>
          <p v-if="addError" class="modal-error">{{ addError }}</p>
        </div>
        <div class="modal-footer">
          <button class="save-btn" :disabled="adding || !addName || !addRole || !addEmail || !addPhone" @click="addPerson">
            {{ adding ? 'DODAJĘ...' : 'DODAJ' }}
          </button>
          <button class="delete-btn" @click="closeAdd">ANULUJ</button>
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
  transform: rotate(2deg);
  transition: none;
}

.add-btn:hover {
  background: white;
  color: #221010;
  transform: rotate(-2deg);
}

.personnel-table {
  width: 100%;
  border-collapse: collapse;
  border: 2px solid #f20d0d;
}

.personnel-table th {
  background: #f20d0d;
  color: white;
  font-weight: 900;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  padding: 12px 16px;
  text-align: left;
}

.personnel-table td {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(242, 13, 13, 0.25);
}

.personnel-table tr:hover td {
  background: rgba(242, 13, 13, 0.1);
  transition: none;
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

.required {
  color: #f20d0d;
}

.required-hint {
  margin: 0 20px 8px;
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.05em;
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

.modal-error {
  margin: 0 20px 12px;
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
  transform: rotate(-2deg);
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
  transform: rotate(-2deg);
}

.delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
