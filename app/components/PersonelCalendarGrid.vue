<script setup lang="ts">
import dayjs from 'dayjs'
import { buildMonthGrid } from '~~/utils/calendar'

interface EventItem {
  id: string
  name: string
  date: string
  venue: string
  status: string
  createdAt: string
  roles: string[]
}

const props = defineProps<{
  events: EventItem[]
  initialMonth: string
  selectedEventId: string | null
}>()

const emit = defineEmits<{
  'select-event': [id: string]
}>()

const WEEKDAY_LABELS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd']

const currentMonth = ref(dayjs.utc(`${props.initialMonth}-01`).startOf('month'))
const expandedDay = ref<string | null>(null)

const monthLabel = computed(() => {
  const label = currentMonth.value.locale('pl').format('MMMM YYYY')
  return label.charAt(0).toUpperCase() + label.slice(1)
})

const grid = computed(() => buildMonthGrid(currentMonth.value.year(), currentMonth.value.month()))

const eventsByDate = computed(() => {
  const map = new Map<string, EventItem[]>()
  for (const ev of props.events) {
    const list = map.get(ev.date) ?? []
    list.push(ev)
    map.set(ev.date, list)
  }
  return map
})

function eventsForDate(date: string): EventItem[] {
  return eventsByDate.value.get(date) ?? []
}

function isActiveDate(date: string): boolean {
  if (!props.selectedEventId) return false
  return eventsForDate(date).some(ev => ev.id === props.selectedEventId)
}

function prevMonth() {
  currentMonth.value = currentMonth.value.subtract(1, 'month')
  expandedDay.value = null
}

function nextMonth() {
  currentMonth.value = currentMonth.value.add(1, 'month')
  expandedDay.value = null
}

function onDayClick(date: string) {
  const dayEvents = eventsForDate(date)
  if (dayEvents.length === 0) return
  if (dayEvents.length === 1) {
    emit('select-event', dayEvents[0]!.id)
    return
  }
  expandedDay.value = expandedDay.value === date ? null : date
}
</script>

<template>
  <div class="calendar">
    <div class="calendar-nav">
      <button type="button" class="nav-btn" @click="prevMonth">←</button>
      <div class="month-label">{{ monthLabel }}</div>
      <button type="button" class="nav-btn" @click="nextMonth">→</button>
    </div>

    <div class="weekday-row">
      <span v-for="wd in WEEKDAY_LABELS" :key="wd" class="weekday-label">{{ wd }}</span>
    </div>

    <div class="grid">
      <div
        v-for="cell in grid"
        :key="cell.date"
        class="calendar-cell"
        :class="{
          'out-of-month': !cell.inMonth,
          'has-events': eventsForDate(cell.date).length > 0,
          active: isActiveDate(cell.date),
        }"
        @click="onDayClick(cell.date)"
      >
        <span v-if="eventsForDate(cell.date).length === 0" class="day-number">{{ cell.day }}</span>
        <div v-else class="glove-wrap">
          <BoxingGloveIcon class="glove" />
          <span class="day-number-on-glove">{{ cell.day }}</span>
          <span v-if="eventsForDate(cell.date).length > 1" class="count-badge">{{ eventsForDate(cell.date).length }}</span>
        </div>

        <div v-if="expandedDay === cell.date" class="day-popover" @click.stop>
          <div
            v-for="ev in eventsForDate(cell.date)"
            :key="ev.id"
            class="popover-item"
            @click="emit('select-event', ev.id)"
          >
            {{ ev.name }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.calendar-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.month-label {
  font-size: 1.1rem;
  font-weight: 900;
  font-style: italic;
  letter-spacing: 0.03em;
}

.nav-btn {
  background: transparent;
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  padding: 6px 14px;
  cursor: pointer;
  transform: rotate(2deg);
  transition: none;
}

.nav-btn:hover {
  border-color: #f20d0d;
  transform: rotate(-2deg);
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.weekday-label {
  text-align: center;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.4);
}

.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.calendar-cell {
  position: relative;
  aspect-ratio: 1;
  background: #1a0808;
  border: 2px solid rgba(255, 255, 255, 0.15);
  padding: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  cursor: default;
}

.calendar-cell.out-of-month {
  opacity: 0.3;
}

.calendar-cell.has-events {
  cursor: pointer;
  border-color: #f20d0d;
}

.calendar-cell.has-events:hover {
  transform: rotate(-1deg);
  box-shadow: 3px 3px 0px #f20d0d;
}

.calendar-cell.active,
.calendar-cell.active:hover {
  background: #f20d0d;
  border-color: white;
  box-shadow: 2px 2px 0px white;
  transform: rotate(-2deg);
}

.calendar-cell.active .day-number {
  color: white;
}

.calendar-cell.active .glove-wrap {
  color: white;
}

.day-number {
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.7);
}

.glove-wrap {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 28px;
  height: 28px;
  color: #f20d0d;
}

.day-number-on-glove {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.65rem;
  font-weight: 900;
  color: white;
  line-height: 1;
  pointer-events: none;
}

.glove {
  width: 100%;
  height: 100%;
}

.count-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  background: #f20d0d;
  color: white;
  font-size: 0.55rem;
  font-weight: 900;
  min-width: 14px;
  height: 14px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.day-popover {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 10;
  background: #1a0808;
  border: 2px solid #f20d0d;
  box-shadow: 3px 3px 0px #f20d0d;
  min-width: 160px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.popover-item {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 6px 8px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.popover-item:hover {
  background: #f20d0d;
  color: white;
}
</style>
