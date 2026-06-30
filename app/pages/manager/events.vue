<script setup lang="ts">
definePageMeta({ middleware: 'manager' })

useHead({
  link: [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;900&display=swap' }],
})

interface EventListItem {
  id: string
  name: string
  date: string
  venue: string
  status: 'draft' | 'published' | 'cancelled'
  createdAt: string
  fightCount: number
}

interface FightRequirement {
  id: string
  fightId: string
  role: string
  count: number
}

interface FightAssignment {
  id: string
  fightId: string
  personId: string
  personName: string
  role: string
}

interface EventAssignment {
  id: string
  personId: string
  personName: string
  role: string
}

interface AvailablePerson {
  id: string
  name: string
  role: string
}

interface FightDetail {
  id: string
  orderNumber: number
  createdAt: string
  requirements: FightRequirement[]
  assignments: FightAssignment[]
}

interface EventDetail {
  id: string
  name: string
  date: string
  venue: string
  status: string
  createdAt: string
  fights: FightDetail[]
  eventAssignments: EventAssignment[]
  availablePersons: AvailablePerson[]
  conflictingPersonIds: string[]
}

const { data: events, refresh: refreshList } = await useFetch<EventListItem[]>('/api/manager/events')

// Add event modal
const showAdd = ref(false)
const addName = ref('')
const addDate = ref('')
const addVenue = ref('')
const adding = ref(false)
const addError = ref('')

function openAdd() {
  addName.value = ''
  addDate.value = ''
  addVenue.value = ''
  addError.value = ''
  showAdd.value = true
}

function closeAdd() {
  showAdd.value = false
}

async function addEvent() {
  addError.value = ''
  adding.value = true
  try {
    await $fetch('/api/manager/events', {
      method: 'POST',
      body: { name: addName.value, date: addDate.value, venue: addVenue.value },
    })
    await refreshList()
    closeAdd()
  }
  catch {
    addError.value = 'Błąd — sprawdź dane i spróbuj ponownie.'
  }
  finally {
    adding.value = false
  }
}

// Event detail modal
const eventDetail = ref<EventDetail | null>(null)
const editName = ref('')
const editDate = ref('')
const editVenue = ref('')
const editSaving = ref(false)
const editError = ref('')
const detailError = ref('')

async function openDetail(id: string) {
  detailError.value = ''
  try {
    const data = await $fetch<EventDetail>(`/api/manager/events/${id}`)
    eventDetail.value = data
    editName.value = data.name
    editDate.value = data.date
    editVenue.value = data.venue
    editError.value = ''
  }
  catch {
    detailError.value = 'Błąd ładowania gali.'
  }
}

function closeDetail() {
  eventDetail.value = null
  detailError.value = ''
}

async function refreshDetail() {
  if (!eventDetail.value) return
  const data = await $fetch<EventDetail>(`/api/manager/events/${eventDetail.value.id}`)
  eventDetail.value = data
}

async function saveEventEdit() {
  if (!eventDetail.value) return
  editSaving.value = true
  editError.value = ''
  try {
    await $fetch(`/api/manager/events/${eventDetail.value.id}`, {
      method: 'PATCH',
      body: { name: editName.value, date: editDate.value, venue: editVenue.value },
    })
    await refreshDetail()
    await refreshList()
    editName.value = eventDetail.value!.name
    editDate.value = eventDetail.value!.date
    editVenue.value = eventDetail.value!.venue
  }
  catch {
    editError.value = 'Błąd zapisu.'
  }
  finally {
    editSaving.value = false
  }
}

// Fights
const addingFight = ref(false)

async function addFight() {
  if (!eventDetail.value) return
  addingFight.value = true
  try {
    await $fetch(`/api/manager/events/${eventDetail.value.id}/fights`, { method: 'POST' })
    await refreshDetail()
  }
  catch {
    detailError.value = 'Błąd dodawania walki.'
  }
  finally {
    addingFight.value = false
  }
}

async function removeFight(fightId: string) {
  if (!eventDetail.value) return
  if (!window.confirm('Usunąć tę walkę?')) return
  try {
    await $fetch(`/api/manager/events/${eventDetail.value.id}/fights/${fightId}`, { method: 'DELETE' })
    await refreshDetail()
  }
  catch {
    detailError.value = 'Błąd usuwania walki.'
  }
}

// Assignments
async function handleFightSlotChange(fight: FightDetail, role: string, slotIndex: number, newPersonId: string) {
  const existing = fight.assignments.filter(a => a.role === role)[slotIndex]
  if (existing) {
    await $fetch(`/api/manager/assignments/${existing.id}`, { method: 'DELETE' })
  }
  if (newPersonId) {
    await $fetch('/api/manager/assignments', {
      method: 'POST',
      body: { personId: newPersonId, role, type: 'fight', fightId: fight.id },
    })
  }
  await refreshDetail()
}

async function handleEventSlotChange(role: string, newPersonId: string) {
  if (!eventDetail.value) return
  const existing = eventDetail.value.eventAssignments.find(a => a.role === role)
  if (existing) {
    await $fetch(`/api/manager/assignments/${existing.id}`, { method: 'DELETE' })
  }
  if (newPersonId) {
    await $fetch('/api/manager/assignments', {
      method: 'POST',
      body: { personId: newPersonId, role, type: 'event', eventId: eventDetail.value.id },
    })
  }
  await refreshDetail()
}

function getFightSlotPersonId(fight: FightDetail, role: string, slotIndex: number): string {
  return fight.assignments.filter(a => a.role === role)[slotIndex]?.personId ?? ''
}

function getEventSlotPersonId(role: string): string {
  return eventDetail.value?.eventAssignments.find(a => a.role === role)?.personId ?? ''
}

function fightMissingRoles(fight: FightDetail): string[] {
  const missing: string[] = []
  for (const req of fight.requirements) {
    const filled = fight.assignments.filter(a => a.role === req.role).length
    if (filled < req.count) missing.push(req.role)
  }
  return missing
}

const canPublish = computed(() => {
  if (!eventDetail.value || eventDetail.value.fights.length === 0) return false
  const allFightsValid = eventDetail.value.fights.every(f => fightMissingRoles(f).length === 0)
  const hasRatownik = eventDetail.value.eventAssignments.some(a => a.role === 'Ratownik')
  const hasKonferansjer = eventDetail.value.eventAssignments.some(a => a.role === 'Konferansjer')
  const assignedIds = [
    ...eventDetail.value.fights.flatMap(f => f.assignments.map(a => a.personId)),
    ...eventDetail.value.eventAssignments.map(a => a.personId),
  ]
  const noConflicts = !assignedIds.some(id => eventDetail.value!.conflictingPersonIds.includes(id))
  return allFightsValid && hasRatownik && hasKonferansjer && noConflicts
})

const publishing = ref(false)
const cancelling = ref(false)
const restoring = ref(false)
const deleting = ref(false)
const publishError = ref('')

async function deleteEvent() {
  if (!eventDetail.value) return
  if (!window.confirm('Trwale usunąć galę? Tej operacji nie można cofnąć.')) return
  deleting.value = true
  try {
    await $fetch(`/api/manager/events/${eventDetail.value.id}`, { method: 'DELETE' })
    closeDetail()
    await refreshList()
  }
  catch {
    detailError.value = 'Błąd usuwania.'
  }
  finally {
    deleting.value = false
  }
}

async function restoreEvent() {
  if (!eventDetail.value) return
  if (!window.confirm('Przywrócić galę do szkicu?')) return
  restoring.value = true
  try {
    await $fetch(`/api/manager/events/${eventDetail.value.id}/restore`, { method: 'POST' })
    await refreshDetail()
    await refreshList()
  }
  catch {
    detailError.value = 'Błąd przywracania.'
  }
  finally {
    restoring.value = false
  }
}

async function publishEvent() {
  if (!eventDetail.value) return
  publishing.value = true
  publishError.value = ''
  try {
    await $fetch(`/api/manager/events/${eventDetail.value.id}/publish`, { method: 'POST' })
    await refreshDetail()
    await refreshList()
  }
  catch (err: unknown) {
    const e = err as { data?: { errors?: string[] } }
    publishError.value = e?.data?.errors?.join(', ') ?? 'Błąd publikacji.'
  }
  finally {
    publishing.value = false
  }
}

async function cancelEvent() {
  if (!eventDetail.value) return
  if (!window.confirm('Anulować galę?')) return
  cancelling.value = true
  try {
    await $fetch(`/api/manager/events/${eventDetail.value.id}/cancel`, { method: 'POST' })
    await refreshDetail()
    await refreshList()
  }
  catch {
    detailError.value = 'Błąd anulowania.'
  }
  finally {
    cancelling.value = false
  }
}

const statusLabel: Record<string, string> = { draft: 'SZKIC', published: 'OPUBLIKOWANA', cancelled: 'ANULOWANA' }

function personsForRole(role: string): AvailablePerson[] {
  return eventDetail.value?.availablePersons.filter(p => p.role === role) ?? []
}

function availableForFightSlot(fight: FightDetail, role: string, slotIndex: number): AvailablePerson[] {
  const currentPersonId = getFightSlotPersonId(fight, role, slotIndex)
  const takenIds = fight.assignments
    .filter(a => a.role === role)
    .filter((_, idx) => idx !== slotIndex)
    .map(a => a.personId)
  return personsForRole(role).filter(p => !takenIds.includes(p.id) || p.id === currentPersonId)
}

function isConflicting(personId: string): boolean {
  return eventDetail.value?.conflictingPersonIds.includes(personId) ?? false
}
</script>

<template>
  <div class="page">
    <ManagerNav />

    <div class="content">
      <div class="section-header">
        <div class="title-badge">GALE</div>
        <button class="add-btn" @click="openAdd">+ DODAJ GALĘ</button>
      </div>

      <table class="events-table">
        <thead>
          <tr>
            <th>NAZWA</th>
            <th>DATA</th>
            <th>MIEJSCE</th>
            <th>STATUS</th>
            <th>WALKI</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="ev in events" :key="ev.id">
            <td><strong>{{ ev.name }}</strong></td>
            <td>{{ ev.date }}</td>
            <td>{{ ev.venue }}</td>
            <td>
              <span :class="['status-badge', `status-${ev.status}`]">{{ statusLabel[ev.status] }}</span>
            </td>
            <td>{{ ev.fightCount }}</td>
            <td>
              <button class="edit-btn" @click="openDetail(ev.id)">OTWÓRZ</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add event modal -->
    <div v-if="showAdd" class="modal-overlay" @click.self="closeAdd">
      <div class="modal">
        <div class="modal-header">
          <span>DODAJ GALĘ</span>
          <button class="close-btn" @click="closeAdd">✕</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>NAZWA</label>
            <input v-model="addName" type="text" class="text-input" placeholder="Gala Boksu #1">
          </div>
          <div class="field">
            <label>DATA</label>
            <input v-model="addDate" type="date" class="text-input">
          </div>
          <div class="field">
            <label>MIEJSCE</label>
            <input v-model="addVenue" type="text" class="text-input" placeholder="Warszawa, Atlas Arena">
          </div>
          <p v-if="addError" class="modal-error">{{ addError }}</p>
        </div>
        <div class="modal-footer">
          <button class="save-btn" :disabled="adding || !addName || !addDate || !addVenue" @click="addEvent">
            {{ adding ? 'DODAJĘ...' : 'DODAJ' }}
          </button>
          <button class="delete-btn" @click="closeAdd">ANULUJ</button>
        </div>
      </div>
    </div>

    <!-- Event detail modal -->
    <div v-if="eventDetail" class="modal-overlay" @click.self="closeDetail">
      <div class="modal detail-modal">
        <div class="modal-header">
          <span>{{ eventDetail.name }}</span>
          <span :class="['status-badge-sm', `status-${eventDetail.status}`]">{{ statusLabel[eventDetail.status] }}</span>
          <button class="close-btn" @click="closeDetail">✕</button>
        </div>

        <!-- Edit fields (draft + published only) -->
        <div v-if="eventDetail.status !== 'cancelled'" class="edit-section">
          <div class="edit-row">
            <div class="field field-grow">
              <label>NAZWA</label>
              <input v-model="editName" type="text" class="text-input">
            </div>
            <div class="field field-date">
              <label>DATA</label>
              <input v-model="editDate" type="date" class="text-input">
            </div>
            <div class="field field-grow">
              <label>MIEJSCE</label>
              <input v-model="editVenue" type="text" class="text-input">
            </div>
            <button class="save-btn-sm" :disabled="editSaving" @click="saveEventEdit">
              {{ editSaving ? '...' : 'ZAPISZ' }}
            </button>
          </div>
          <p v-if="editError" class="modal-error edit-error">{{ editError }}</p>
        </div>

        <div class="detail-scroll">
          <!-- Fights -->
          <div class="section-label">WALKI</div>

          <div v-if="eventDetail.fights.length === 0" class="empty-msg">
            Brak walk.
          </div>

          <div v-for="fight in eventDetail.fights" :key="fight.id" class="fight-block">
            <div class="fight-header">
              <span class="fight-num">WALKA #{{ fight.orderNumber }}</span>
              <span v-if="fightMissingRoles(fight).length === 0" class="valid-badge">OK</span>
              <span v-else class="invalid-badge">BRAKUJE: {{ fightMissingRoles(fight).join(', ') }}</span>
              <button v-if="eventDetail.status === 'draft'" class="remove-btn" @click="removeFight(fight.id)">USUŃ</button>
            </div>

            <div v-for="req in fight.requirements" :key="req.id" class="req-block">
              <div class="req-label">{{ req.role.toUpperCase() }} ×{{ req.count }}</div>
              <div v-for="slotIdx in req.count" :key="slotIdx" class="slot-row">
                <select
                  class="person-select"
                  :disabled="eventDetail.status !== 'draft'"
                  :value="getFightSlotPersonId(fight, req.role, slotIdx - 1)"
                  @change="handleFightSlotChange(fight, req.role, slotIdx - 1, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">— wybierz —</option>
                  <option
                    v-for="p in availableForFightSlot(fight, req.role, slotIdx - 1)"
                    :key="p.id"
                    :value="p.id"
                  >
                    {{ p.name }}{{ isConflicting(p.id) ? ' (KONFLIKT)' : '' }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <button
            v-if="eventDetail.status === 'draft'"
            class="add-fight-btn"
            :disabled="addingFight"
            @click="addFight"
          >
            {{ addingFight ? '...' : '+ DODAJ WALKĘ' }}
          </button>

          <!-- Event-level assignments -->
          <div class="section-label">OBSŁUGA GALI</div>

          <div class="event-assignments">
            <div v-for="role in ['Ratownik', 'Konferansjer']" :key="role" class="slot-row">
              <div class="req-label">{{ role.toUpperCase() }}</div>
              <select
                class="person-select"
                :disabled="eventDetail.status !== 'draft'"
                :value="getEventSlotPersonId(role)"
                @change="handleEventSlotChange(role, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">— wybierz —</option>
                <option
                  v-for="p in personsForRole(role)"
                  :key="p.id"
                  :value="p.id"
                >
                  {{ p.name }}{{ isConflicting(p.id) ? ' (KONFLIKT)' : '' }}
                </option>
              </select>
            </div>
          </div>

          <p v-if="detailError" class="modal-error">{{ detailError }}</p>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <template v-if="eventDetail.status === 'draft'">
            <span v-if="publishError" class="publish-error">{{ publishError }}</span>
            <button class="save-btn" :disabled="!canPublish || publishing" @click="publishEvent">
              {{ publishing ? 'PUBLIKUJĘ...' : 'STWÓRZ GALĘ' }}
            </button>
            <button class="delete-btn" :disabled="cancelling" @click="cancelEvent">
              {{ cancelling ? '...' : 'ANULUJ GALĘ' }}
            </button>
          </template>
          <template v-else-if="eventDetail.status === 'published'">
            <button class="delete-btn" :disabled="cancelling" @click="cancelEvent">
              {{ cancelling ? '...' : 'ANULUJ GALĘ' }}
            </button>
          </template>
          <template v-else>
            <button class="save-btn" :disabled="restoring" @click="restoreEvent">
              {{ restoring ? '...' : 'PRZYWRÓĆ GALĘ' }}
            </button>
            <button class="delete-btn" :disabled="deleting" @click="deleteEvent">
              {{ deleting ? '...' : 'USUŃ GALĘ' }}
            </button>
          </template>
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

.events-table {
  width: 100%;
  border-collapse: collapse;
  border: 2px solid #f20d0d;
}

.events-table th {
  background: #f20d0d;
  color: white;
  font-weight: 900;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  padding: 12px 16px;
  text-align: left;
}

.events-table td {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(242, 13, 13, 0.25);
}

.events-table tr:hover td {
  background: rgba(242, 13, 13, 0.1);
}

.status-badge {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  padding: 3px 10px;
  transform: skewX(-8deg);
}

.status-badge.status-draft {
  background: rgba(242, 13, 13, 0.2);
  border: 1px solid #f20d0d;
  color: #f20d0d;
}

.status-badge.status-published {
  background: rgba(22, 163, 74, 0.2);
  border: 1px solid #16a34a;
  color: #4ade80;
}

.status-badge.status-cancelled {
  background: rgba(107, 114, 128, 0.2);
  border: 1px solid #6b7280;
  color: #9ca3af;
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

/* Modals */
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
  width: 420px;
  max-width: 95vw;
}

.detail-modal {
  width: 680px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  background: #f20d0d;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  font-weight: 900;
  font-size: 1rem;
  font-style: italic;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.modal-header .close-btn {
  margin-left: auto;
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

.status-badge-sm {
  font-size: 0.65rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  padding: 2px 8px;
  transform: skewX(-8deg);
  display: inline-block;
}

.status-badge-sm.status-draft {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.5);
  color: white;
}

.status-badge-sm.status-published {
  background: rgba(22, 163, 74, 0.4);
  border: 1px solid #4ade80;
  color: #4ade80;
}

.status-badge-sm.status-cancelled {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.5);
}

.edit-section {
  padding: 16px 20px 0;
  flex-shrink: 0;
}

.edit-row {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-grow {
  flex: 1;
}

.field-date {
  flex: 0 0 140px;
}

.field label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.text-input {
  background: #2d1010;
  border: 2px solid #f20d0d;
  color: white;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 7px 10px;
  box-sizing: border-box;
  width: 100%;
}

.text-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
  font-weight: 400;
}

.text-input[type="date"] {
  color-scheme: dark;
}

.save-btn-sm {
  background: #f20d0d;
  border: none;
  color: white;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 900;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  padding: 8px 14px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transform: skewX(-8deg);
}

.save-btn-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.edit-error {
  margin: 6px 0 0;
  font-size: 0.75rem;
  color: #f20d0d;
  font-weight: 700;
}

.detail-scroll {
  overflow-y: auto;
  flex: 1;
  padding: 16px 20px;
}

.section-label {
  font-size: 0.65rem;
  font-weight: 900;
  letter-spacing: 0.15em;
  color: rgba(255, 255, 255, 0.4);
  border-bottom: 1px solid rgba(242, 13, 13, 0.3);
  padding-bottom: 4px;
  margin-bottom: 12px;
  margin-top: 16px;
}

.section-label:first-child {
  margin-top: 0;
}

.empty-msg {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.35);
  margin-bottom: 12px;
}

.fight-block {
  border: 1px solid rgba(242, 13, 13, 0.3);
  margin-bottom: 12px;
  padding: 12px;
}

.fight-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.fight-num {
  font-weight: 900;
  font-size: 0.85rem;
  letter-spacing: 0.06em;
}

.valid-badge {
  font-size: 0.65rem;
  font-weight: 900;
  padding: 2px 8px;
  background: rgba(22, 163, 74, 0.2);
  border: 1px solid #16a34a;
  color: #4ade80;
  letter-spacing: 0.08em;
}

.invalid-badge {
  font-size: 0.65rem;
  font-weight: 900;
  padding: 2px 8px;
  background: rgba(242, 13, 13, 0.15);
  border: 1px solid #f20d0d;
  color: #f20d0d;
  letter-spacing: 0.06em;
}

.remove-btn {
  margin-left: auto;
  background: transparent;
  border: 1px solid rgba(242, 13, 13, 0.5);
  color: rgba(242, 13, 13, 0.7);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 3px 10px;
  cursor: pointer;
}

.remove-btn:hover {
  border-color: #f20d0d;
  color: #f20d0d;
}

.req-block {
  margin-bottom: 8px;
}

.req-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 4px;
}

.slot-row {
  margin-bottom: 4px;
}

.person-select {
  width: 100%;
  background: #2d1010;
  border: 1px solid rgba(242, 13, 13, 0.5);
  color: white;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 5px 8px;
  cursor: pointer;
  appearance: none;
  box-sizing: border-box;
}

.person-select:disabled {
  opacity: 0.6;
  cursor: default;
}

.add-fight-btn {
  background: transparent;
  border: 2px dashed rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.5);
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  padding: 8px;
  cursor: pointer;
  width: 100%;
  margin-bottom: 4px;
}

.add-fight-btn:hover:not(:disabled) {
  border-color: white;
  color: white;
}

.add-fight-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.event-assignments {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-assignments .slot-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
}

.event-assignments .req-label {
  flex: 0 0 110px;
  margin: 0;
}

.event-assignments .person-select {
  flex: 1;
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-error {
  margin: 0 20px 10px;
  font-size: 0.78rem;
  color: #f20d0d;
  font-weight: 700;
}

.modal-footer {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-top: 1px solid rgba(242, 13, 13, 0.25);
  flex-shrink: 0;
}

.save-btn {
  background: #f20d0d;
  border: none;
  color: white;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 900;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  padding: 10px 20px;
  cursor: pointer;
  transform: skewX(-8deg);
  white-space: nowrap;
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
  white-space: nowrap;
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

.publish-error {
  flex: 1;
  font-size: 0.75rem;
  color: #f20d0d;
  font-weight: 700;
}

.cancelled-info {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.05em;
}
</style>
