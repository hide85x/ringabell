<script setup lang="ts">
import { formatDate, nowUtc } from '~~/utils/date'

definePageMeta({ middleware: 'personel' })

useHead({
  link: [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;900&display=swap' }],
})

interface EventItem {
  id: string
  name: string
  date: string
  venue: string
  status: string
  createdAt: string
  roles: string[]
}

interface FightPerson {
  assignmentId: string
  role: string
  corner: string | null
  personName: string
  isMe: boolean
}

interface FightDetail {
  id: string
  orderNumber: number
  persons: FightPerson[]
}

interface EventPersonnel {
  role: string
  personName: string
  isMe: boolean
}

interface EventDetail extends EventItem {
  eventPersonnel: EventPersonnel[]
  fights: FightDetail[]
}

const { data: events } = await useFetch<EventItem[]>('/api/personel/events')
const selectedEvent = ref<EventDetail | null>(null)
const viewMode = ref<'list' | 'calendar'>('list')

const initialMonth = computed(() => {
  const list = events.value ?? []
  const today = nowUtc().slice(0, 10)
  const upcoming = list.find(e => e.date >= today)
  const reference = upcoming ?? list[list.length - 1]
  return (reference?.date ?? today).slice(0, 7)
})

async function openDetail(id: string) {
  try {
    selectedEvent.value = await $fetch<EventDetail>('/api/personel/events/' + id)
  }
  catch (err) {
    console.error('Failed to load event detail:', err)
  }
}

const CORNER_ROLE_ORDER = ['bokser', 'trener', 'cutman']

function personsForCorner(fight: FightDetail, corner: 'red' | 'blue'): FightPerson[] {
  return fight.persons
    .filter(p => p.corner === corner)
    .sort((a, b) => {
      const rankA = CORNER_ROLE_ORDER.indexOf(a.role.toLowerCase())
      const rankB = CORNER_ROLE_ORDER.indexOf(b.role.toLowerCase())
      if (rankA === -1 && rankB === -1) return a.role.localeCompare(b.role)
      if (rankA === -1) return 1
      if (rankB === -1) return -1
      return rankA - rankB
    })
}

function otherPersons(fight: FightDetail): FightPerson[] {
  return fight.persons.filter(p => !p.corner)
}

function hasCorners(fight: FightDetail): boolean {
  return fight.persons.some(p => p.corner)
}
</script>

<template>
  <div class="page">
    <PersonelNav />
    <div class="content">
      <h1 class="page-title">MOJE GALE</h1>

      <div v-if="!events?.length" class="empty-state">
        Nie masz jeszcze przypisanych gal.
      </div>

      <div v-else class="layout">
        <div class="left-column">
          <div class="view-toggle">
            <button
              type="button"
              class="toggle-btn"
              :class="{ active: viewMode === 'list' }"
              @click="viewMode = 'list'"
            >
              LISTA
            </button>
            <button
              type="button"
              class="toggle-btn"
              :class="{ active: viewMode === 'calendar' }"
              @click="viewMode = 'calendar'"
            >
              KALENDARZ
            </button>
          </div>

          <div v-if="viewMode === 'list'" class="event-list">
            <div
              v-for="ev in events"
              :key="ev.id"
              class="event-card"
              :class="{ selected: selectedEvent?.id === ev.id }"
              @click="openDetail(ev.id)"
            >
              <div class="event-date">{{ formatDate(ev.date) }}</div>
              <div class="event-name">{{ ev.name }}</div>
              <div class="event-venue">{{ ev.venue }}</div>
              <div class="event-roles">
                <span v-for="role in ev.roles" :key="role" class="role-badge">{{ role }}</span>
              </div>
            </div>
          </div>

          <PersonelCalendarGrid
            v-else
            :events="events"
            :initial-month="initialMonth"
            :selected-event-id="selectedEvent?.id ?? null"
            @select-event="openDetail"
          />
        </div>

        <div v-if="selectedEvent" class="event-detail">
          <div class="detail-header">
            <div class="detail-name">{{ selectedEvent.name }}</div>
            <div class="detail-date">{{ formatDate(selectedEvent.date) }} · {{ selectedEvent.venue }}</div>
          </div>

          <div v-if="selectedEvent.eventPersonnel.length" class="detail-section">
            <div class="section-label">PERSONEL GALI</div>
            <div
              v-for="ep in selectedEvent.eventPersonnel"
              :key="ep.role + ep.personName"
              class="fight-row"
              :class="{ 'is-me': ep.isMe }"
            >
              <span class="fight-number">{{ ep.personName }}</span>
              <span class="fight-role">{{ ep.role }}</span>
            </div>
          </div>

          <div v-if="selectedEvent.fights.length" class="detail-section">
            <div class="section-label">WALKI</div>
            <div v-for="fight in selectedEvent.fights" :key="fight.id" class="fight-block">
              <div class="fight-header">Walka {{ fight.orderNumber }}</div>

              <div v-if="hasCorners(fight)" class="corner-grid">
                <div class="corner-block corner-red">
                  <div class="corner-label">CZERWONY NAROŻNIK</div>
                  <div
                    v-for="person in personsForCorner(fight, 'red')"
                    :key="person.assignmentId"
                    class="fight-row"
                    :class="{ 'is-me': person.isMe }"
                  >
                    <span class="fight-number">{{ person.personName }}</span>
                    <span class="fight-role">{{ person.role }}</span>
                  </div>
                </div>
                <div class="corner-block corner-blue">
                  <div class="corner-label">NIEBIESKI NAROŻNIK</div>
                  <div
                    v-for="person in personsForCorner(fight, 'blue')"
                    :key="person.assignmentId"
                    class="fight-row"
                    :class="{ 'is-me': person.isMe }"
                  >
                    <span class="fight-number">{{ person.personName }}</span>
                    <span class="fight-role">{{ person.role }}</span>
                  </div>
                </div>
              </div>

              <div v-if="otherPersons(fight).length" class="other-roles">
                <div v-if="hasCorners(fight)" class="other-roles-label">INNE</div>
                <div
                  v-for="person in otherPersons(fight)"
                  :key="person.assignmentId"
                  class="fight-row"
                  :class="{ 'is-me': person.isMe }"
                >
                  <span class="fight-number">{{ person.personName }}</span>
                  <span class="fight-role">{{ person.role }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  height: 100vh;
  overflow: hidden;
  background: #221010;
  color: white;
  font-family: 'Space Grotesk', sans-serif;
  display: flex;
  flex-direction: column;
}

.content {
  flex: 1;
  min-height: 0;
  max-width: 1000px;
  width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 40px 32px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-title {
  font-size: 2rem;
  font-weight: 900;
  font-style: italic;
  letter-spacing: 0.05em;
  margin: 0 0 32px;
  flex-shrink: 0;
}

.empty-state {
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.9rem;
  letter-spacing: 0.05em;
  padding: 48px 0;
  text-align: center;
}

.layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 24px;
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

.left-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.view-toggle {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.toggle-btn {
  background: transparent;
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.6);
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  padding: 8px 16px;
  cursor: pointer;
  transform: rotate(1deg);
  transition: none;
}

.toggle-btn:hover {
  border-color: white;
  color: white;
}

.toggle-btn.active {
  border-color: #f20d0d;
  background: #f20d0d;
  color: white;
  box-shadow: 3px 3px 0px white;
  transform: rotate(-1deg);
}

.event-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.event-card {
  background: #1a0808;
  border: 2px solid rgba(255, 255, 255, 0.15);
  padding: 16px;
  cursor: pointer;
  transition: none;
}

.event-card:hover {
  border-color: rgba(255, 255, 255, 0.5);
}

.event-card.selected {
  border-color: #f20d0d;
  box-shadow: 3px 3px 0px #f20d0d;
}

.event-date {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 4px;
}

.event-name {
  font-size: 1rem;
  font-weight: 900;
  letter-spacing: 0.03em;
  margin-bottom: 4px;
}

.event-venue {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 10px;
}

.event-roles {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.role-badge {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 2px 8px;
  background: #f20d0d;
  color: white;
}

.event-detail {
  background: #1a0808;
  border: 2px solid rgba(255, 255, 255, 0.15);
  padding: 20px;
  min-height: 0;
  overflow-y: auto;
}

.detail-header {
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 16px;
  margin-bottom: 20px;
}

.detail-name {
  font-size: 1.1rem;
  font-weight: 900;
  letter-spacing: 0.03em;
  margin-bottom: 4px;
}

.detail-date {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.05em;
}

.detail-section {
  margin-bottom: 20px;
}

.section-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 10px;
}

.fight-block {
  background: rgba(255, 255, 255, 0.04);
  border: 2px solid rgba(255, 255, 255, 0.15);
  padding: 12px 14px;
  margin-bottom: 16px;
}

.fight-block:last-child {
  margin-bottom: 0;
}

.fight-header {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  color: white;
  background: #f20d0d;
  padding: 3px 10px;
  margin-bottom: 10px;
  text-transform: uppercase;
  transform: rotate(-1deg);
}

.fight-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.85rem;
}

.corner-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.corner-block {
  border: 2px solid;
  padding: 10px;
  border-radius: 4px;
}

.corner-red {
  border-color: #e02020;
  background: rgba(224, 32, 32, 0.08);
}

.corner-blue {
  border-color: #2060e0;
  background: rgba(32, 96, 224, 0.08);
}

.corner-label {
  font-size: 0.65rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}

.corner-red .corner-label {
  color: #e02020;
}

.corner-blue .corner-label {
  color: #2060e0;
}

.other-roles-label {
  font-size: 0.65rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 8px;
}

.fight-row.is-me {
  border: 2px solid #f20d0d;
  box-shadow: 3px 3px 0px #f20d0d;
  padding: 4px 8px;
  margin: 2px 0;
}

.fight-number {
  font-weight: 700;
  color: rgba(255, 255, 255, 0.6);
}

.fight-role {
  font-weight: 700;
  color: white;
}

@media (max-width: 600px) {
  .content {
    padding: 16px 12px;
  }

  .page-title {
    font-size: 1.3rem;
    margin: 0 0 16px;
  }

  .layout {
    gap: 14px;
  }

  .event-card {
    padding: 10px;
  }

  .event-detail {
    padding: 12px;
  }

  .detail-name {
    font-size: 0.95rem;
  }

  .fight-block {
    padding: 8px 10px;
  }

  .fight-row {
    flex-wrap: wrap;
    gap: 2px 8px;
    font-size: 0.78rem;
    padding: 6px 0;
  }

  .corner-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .corner-block {
    padding: 8px;
  }
}
</style>
