# Personnel Calendar View Implementation Plan

## Overview

Dodanie widoku miesięcznej siatki kalendarza do istniejącej strony `/personel/schedule`, jako alternatywy dla listy gal. Dni z przypisaną galą oznaczone ikoną rękawicy bokserskiej (symbol zajętości, nie dosłowna "walka" — dotyczy każdego typu przypisania, event-level i fight-level jednakowo). Kliknięcie dnia otwiera ten sam panel szczegółów co lista. Brak zmian backendowych — kalendarz konsumuje dane już zwracane przez `/api/personel/events`.

## Current State Analysis

- `/personel/schedule` (`app/pages/personel/schedule.vue`) pokazuje listę kart gal (lewa kolumna) + panel szczegółów (prawa kolumna) po kliknięciu
- `useFetch<EventItem[]>('/api/personel/events')` zwraca **wszystkie** opublikowane gale osoby, każda z `date: string` w formacie `YYYY-MM-DD` (potwierdzone w `server/api/manager/events/index.post.ts:23` — pole tekstowe z formularza, brak czasu/zakresu)
- Panel szczegółów już istnieje i działa (`openDetail(id)` → `$fetch('/api/personel/events/' + id)` → `selectedEvent`) — do reużycia bez zmian
- `utils/date.ts` eksportuje `formatDate`/`nowUtc` na bazie `dayjs` + plugin `utc` — dayjs jest jedyną zależnością do liczenia dat w projekcie, brak biblioteki kalendarzowej
- Styl: paleta `#221010` (tło strony) / `#1a0808` (karty) / `#f20d0d` (akcent czerwony), rotacje `transform: rotate(±2deg)` na przyciskach i kartach, font Space Grotesk, cienie `box-shadow: Npx Npx 0px <color>` — wzorce w `schedule.vue` i `ManagerNav.vue`
- Ikony w projekcie: inline SVG, stroke-based, `stroke="currentColor"` — wzorzec `ManagerNav.vue:10` (ikona dzwonu). Ikony rękawicy nigdzie nie ma — do zaprojektowania od zera

## Desired End State

- Na `/personel/schedule` pojawia się przełącznik LISTA / KALENDARZ (domyślnie LISTA, żeby nie zmieniać istniejącego, już zweryfikowanego zachowania)
- Widok KALENDARZ pokazuje siatkę bieżącego miesiąca (7 kolumn, tydzień od poniedziałku), z nawigacją strzałkami ← / → bez ograniczeń zakresu (przeszłość i przyszłość)
- Przy pierwszym wejściu w tryb kalendarza pokazywany jest miesiąc najbliższej nadchodzącej gali (albo bieżący miesiąc, jeśli brak nadchodzących lub brak gal w ogóle)
- Dzień z ≥1 galą ma ikonę rękawicy bokserskiej; dzień z >1 galą dodatkowo ma małą czerwoną plakietkę z liczbą
- Kliknięcie dnia z 1 galą otwiera panel szczegółów (ten sam co lista) od razu; kliknięcie dnia z >1 galą pokazuje krótką listę gal tego dnia do wyboru, z której kliknięcie otwiera panel szczegółów
- Styl siatki spójny z resztą aplikacji: rotacje, czerwono-czarna paleta, Space Grotesk

### Key Discoveries

- Brak potrzeby zmian w API — `events` (już pobrane przez `useFetch`) wystarczą do zbudowania siatki; grupowanie po dniu robimy w computed po stronie frontu
- `events.date` to `YYYY-MM-DD` (string), więc grupowanie po dniu to prosty string-match, bez stref czasowych do rozważania
- dayjs bez dodatkowych pluginów wystarcza do policzenia `daysInMonth()` i dnia tygodnia pierwszego dnia miesiąca — nie trzeba dodawać zależności

## What We're NOT Doing

- Brak zmian w backendzie / API — żadnych nowych endpointów ani pól
- Brak osobnej podstrony — kalendarz to tryb widoku na istniejącej `/personel/schedule`, nie nowa trasa
- Brak ograniczenia nawigacji do przyszłości — działa identycznie jak lista (pełna historia)
- Brak rozróżnienia ikony rękawicy per typ przypisania (fight vs event) — ikona oznacza każdy dzień z jakąkolwiek galą
- Brak zewnętrznej biblioteki kalendarzowej (np. v-calendar, FullCalendar) — własna siatka na dayjs

## Implementation Approach

Dwie fazy: (1) czysta funkcja budująca siatkę dni w nowym `utils/calendar.ts` + komponent widoku kalendarza wpięty w `schedule.vue` jako drugi tryb obok listy, z własną ikoną SVG rękawicy; (2) unit testy dla logiki siatki (przypadki brzegowe: lata przestępne, przejście grudzień→styczeń, offset dnia tygodnia) + manualna weryfikacja UI.

## Critical Implementation Details

**Tydzień zaczyna się od poniedziałku** — `dayjs().day()` zwraca 0 dla niedzieli, więc offset trzeba przeliczyć: `(dayjs(...).day() + 6) % 7` daje 0 dla poniedziałku, 6 dla niedzieli. To jedyna nieoczywista linia w całej logice siatki.

**Wybór startowego miesiąca** — `events` są posortowane rosnąco po dacie (API: `ORDER BY e.date ASC`). Miesiąc startowy = miesiąc pierwszego eventu z `date >= nowUtc()` (porównanie stringów `YYYY-MM-DD` działa leksykograficznie poprawnie), a jeśli żaden nie spełnia warunku — miesiąc ostatniego (najnowszego przeszłego) eventu; jeśli `events` puste — bieżący miesiąc.

## Phase 1: Kalendarz — siatka miesiąca, przełącznik widoku, ikona rękawicy

### Overview

Nowa czysta funkcja generująca siatkę dni miesiąca, komponent kalendarza, integracja z `schedule.vue` przez przełącznik trybu widoku, oraz custom SVG ikony rękawicy bokserskiej.

### Changes Required

#### 1. Funkcja generująca siatkę miesiąca

**File**: `utils/calendar.ts`

**Intent**: Czysta, testowalna funkcja licząca komórki siatki kalendarza dla danego roku/miesiąca — bez zależności od Vue, żeby dało się ją unit testować tak jak `utils/date.ts`.

**Contract**: Eksportuje `buildMonthGrid(year: number, month: number): CalendarCell[]` gdzie `month` to 0-indexed (styczeń=0, zgodnie z konwencją JS Date/dayjs), a `CalendarCell = { date: string, day: number, inMonth: boolean }`. Zwraca zawsze pełne tygodnie (wielokrotność 7 komórek) pokrywające cały miesiąc, z dniami z sąsiednich miesięcy oznaczonymi `inMonth: false` żeby wypełnić pierwszy/ostatni tydzień. Tydzień od poniedziałku (patrz Critical Implementation Details). Używa `dayjs.utc` (spójnie z resztą `utils/date.ts`) — brak nowych zależności.

#### 2. Ikona rękawicy bokserskiej

**File**: `app/components/BoxingGloveIcon.vue`

**Intent**: Prosty, spójny stylistycznie z ikoną dzwonu (`ManagerNav.vue:10`) inline SVG symbol oznaczający dzień z przypisaną galą.

**Contract**: Komponent bezpropsowy, `<svg>` z `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"` — kontur rękawicy bokserskiej (mitten-shape z kciukiem). Rozmiar i kolor kontrolowane przez CSS rodzica (`width`/`height`/`color`), analogicznie do `.bell-icon`.

#### 3. Komponent siatki kalendarza

**File**: `app/components/PersonelCalendarGrid.vue`

**Intent**: Renderuje przełącznik miesiąca (← / →) + siatkę 7-kolumnową dni bieżąco wybranego miesiąca, z nagłówkami dni tygodnia (Pon–Nd), podświetleniem dni z galami (ikona rękawicy + opcjonalna plakietka z liczbą), obsługą kliknięcia dnia.

**Contract**: Props: `events: EventItem[]` (ten sam typ co w `schedule.vue`). Emits: `select-event(id: string)`. Wewnętrzny stan: `currentMonth = ref<Dayjs>` zainicjalizowany logiką z Critical Implementation Details (obliczaną w rodzicu i przekazywaną jako prop `initialMonth: Dayjs`, żeby komponent siatki pozostał bezstanowy względem wyboru startowego miesiąca). Computed `grid = computed(() => buildMonthGrid(currentMonth.value.year(), currentMonth.value.month()))`. Computed `eventsByDate = computed(() => Map<string, EventItem[]>` z grupowaniem `events` po `date`. Dla dnia z 1 galą: klik emituje `select-event` bezpośrednio z `eventId`. Dla dnia z >1 galą: klik rozwija inline mini-listę tych gal (lokalny `ref` z aktywnym dniem), każda pozycja klikalna → emituje `select-event`. Styl: kratki `.calendar-cell` w tej samej stylistyce co `.event-card` (`#1a0808`, border `rgba(255,255,255,0.15)`), aktywny/dzisiejszy dzień z akcentem `#f20d0d` i lekką rotacją przy hover, spójnie z resztą UI.

#### 4. Integracja z `schedule.vue`

**File**: `app/pages/personel/schedule.vue`

**Intent**: Dodać przełącznik trybu widoku (LISTA / KALENDARZ) nad istniejącą listą, domyślnie LISTA. W trybie KALENDARZ renderować `PersonelCalendarGrid` zamiast `.event-list`, z tym samym prawym panelem szczegółów (`selectedEvent`) współdzielonym między oboma trybami.

**Contract**: Nowy `const viewMode = ref<'list' | 'calendar'>('list')`. Dwa przyciski przełącznika nad `.layout` (styl analogiczny do istniejących przycisków akcji — border + cień + rotacja). `PersonelCalendarGrid` dostaje `:events="events" :initial-month="..."` i nasłuchuje `@select-event="openDetail"` (funkcja już istnieje, bez zmian). Layout (grid 2-kolumnowy z panelem po prawej) zostaje bez zmian — zmienia się tylko zawartość lewej kolumny.

### Success Criteria

#### Automated Verification

- TypeScript kompiluje się bez błędów: `npm run build`

#### Manual Verification

- Przełącznik LISTA/KALENDARZ działa, domyślny widok to LISTA
- Kalendarz przy pierwszym otwarciu pokazuje miesiąc najbliższej nadchodzącej gali (lub bieżący, gdy brak)
- Dni z galą mają ikonę rękawicy, dni z >1 galą mają dodatkowo plakietkę z liczbą
- Klik dnia z 1 galą otwiera panel szczegółów; klik dnia z >1 galą pokazuje wybór, z którego można otworzyć każdą z gal
- Nawigacja ← / → działa bez ograniczeń (przeszłość i przyszłość), w tym przejście grudzień↔styczeń
- Styl siatki spójny z resztą aplikacji (rotacje, paleta, font)

**Implementation Note**: Po ukończeniu tej fazy i przejściu automated verification — poczekaj na potwierdzenie manual verification przed przejściem do Phase 2.

---

## Phase 2: Testy

### Overview

Unit test dla `buildMonthGrid` pokrywający przypadki brzegowe dat (lata przestępne, przejście między miesiącami/rokami, offset dnia tygodnia) + manualna regresja UI.

### Changes Required

#### 1. Unit test siatki kalendarza

**File**: `utils/calendar.test.ts`

**Intent**: Zweryfikować poprawność czystej funkcji `buildMonthGrid` bez potrzeby uruchamiania całej aplikacji — wzorzec `utils/date.test.ts`.

**Contract**: Test cases (project `unit` w `vitest.config.ts`, bez potrzeby workera):
- Luty roku przestępnego (np. 2028) ma 29 dni oznaczonych `inMonth: true`
- Luty roku nieprzestępnego (np. 2027) ma 28 dni oznaczonych `inMonth: true`
- Miesiąc zaczynający się w niedzielę ma poprawny offset 6 dni z poprzedniego miesiąca (`inMonth: false`) przed 1. dniem
- Miesiąc zaczynający się w poniedziałek ma offset 0 (brak dni z poprzedniego miesiąca w pierwszym tygodniu)
- Grudzień 2026 → pierwszy dzień stycznia w siatce (jeśli miesiąc kończy się przed pełnym tygodniem) ma poprawny rok w polu `date` (nie zawija się błędnie na grudzień)
- Długość zwróconej tablicy to zawsze wielokrotność 7

### Success Criteria

#### Automated Verification

- Unit testy przechodzą: `npm run test` (project `unit`)
- TypeScript kompiluje się bez błędów: `npm run build`

#### Manual Verification

- Brak regresji w widoku listy na `/personel/schedule` (istniejący tryb LISTA działa jak dotychczas)

**Implementation Note**: Po ukończeniu tej fazy i przejściu automated verification — poczekaj na potwierdzenie manual verification przed zakończeniem zmiany.

---

## Testing Strategy

### Unit Tests

- `buildMonthGrid`: lata przestępne, offset dnia tygodnia, przejścia miesiąc/rok, długość siatki

### Manual Testing Steps

1. Zaloguj się jako Personel z galami w różnych miesiącach (seed danych z `personnel-schedule-view`)
2. Wejdź na `/personel/schedule`, przełącz na KALENDARZ
3. Sprawdź że startowy miesiąc to miesiąc najbliższej nadchodzącej gali
4. Kliknij dzień z galą → panel szczegółów się otwiera
5. Nawiguj strzałkami wstecz/wprzód przez zmianę roku i miesiąca z 31/30/28 dniami
6. Przełącz z powrotem na LISTA → upewnij się że nic się nie zepsuło

## References

- Wzorzec strony: `app/pages/personel/schedule.vue`
- Wzorzec ikony SVG: `app/components/ManagerNav.vue:10` (bell icon)
- Date utils: `utils/date.ts`, `utils/date.test.ts`
- API (bez zmian): `server/api/personel/events/index.get.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Kalendarz — siatka miesiąca, przełącznik widoku, ikona rękawicy

#### Automated

- [x] 1.1 TypeScript kompiluje się bez błędów: `npm run build` — 552aa57

#### Manual

- [x] 1.2 Przełącznik LISTA/KALENDARZ działa, domyślny widok to LISTA — 7495b5f
- [x] 1.3 Kalendarz przy pierwszym otwarciu pokazuje miesiąc najbliższej nadchodzącej gali (lub bieżący) — 7495b5f
- [x] 1.4 Dni z galą mają ikonę rękawicy, dni z >1 galą mają plakietkę z liczbą — 7495b5f
- [x] 1.5 Klik dnia z 1 galą otwiera panel szczegółów; klik dnia z >1 galą pokazuje wybór — 7495b5f
- [x] 1.6 Nawigacja ← / → działa bez ograniczeń, w tym grudzień↔styczeń — 7495b5f
- [x] 1.7 Styl siatki spójny z resztą aplikacji — 7495b5f

### Phase 2: Testy

#### Automated

- [x] 2.1 Unit testy przechodzą: `npm run test` — 552aa57
- [x] 2.2 TypeScript kompiluje się bez błędów: `npm run build` — 552aa57

#### Manual

- [x] 2.3 Brak regresji w widoku listy na `/personel/schedule` — stan `selectedEvent` poprawnie współdzielony między trybami po przełączeniu
