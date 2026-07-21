# Personnel Calendar View — Plan Brief

> Full plan: `context/changes/personnel-calendar-view/plan.md`

## What & Why

Personel widzi obecnie swoje gale jako listę kart. Dodajemy alternatywny widok — miesięczną siatkę kalendarza z ikoną rękawicy bokserskiej na dniach, w które ma przypisaną galę. To wizualne dopełnienie istniejącego widoku, nie jego zastąpienie.

## Starting Point

`/personel/schedule` już pokazuje listę gal (lewa kolumna) + panel szczegółów (prawa kolumna) po kliknięciu karty. `/api/personel/events` zwraca wszystkie opublikowane gale osoby z datami — dane te wystarczą do zbudowania kalendarza, bez zmian w API.

## Desired End State

Na tej samej stronie pojawia się przełącznik LISTA / KALENDARZ. Tryb kalendarza pokazuje siatkę dni bieżącego (lub najbliższego z galą) miesiąca, z nawigacją strzałkami bez ograniczeń w czasie. Dni z galą mają ikonę rękawicy; kliknięcie otwiera ten sam panel szczegółów co lista.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| Umiejscowienie | Przełącznik na tej samej stronie, nie nowa podstrona | Reużywa panel szczegółów i fetch danych, zero duplikacji |
| Domyślny widok | LISTA | Nie zmienia już przetestowanego zachowania |
| Znaczenie ikony rękawicy | Każdy dzień z jakąkolwiek galą (event lub fight), nie tylko "walka" | Ikona to symbol zajętości, nie literalne rozróżnienie typu przypisania |
| Źródło danych | Ten sam `/api/personel/events`, grupowanie po dniu na froncie | Brak potrzeby nowego endpointu przy małej skali danych |
| Zakres nawigacji | Bez ograniczeń (przeszłość + przyszłość) | Spójne z listą, która też pokazuje pełną historię |
| Startowy miesiąc | Miesiąc najbliższej nadchodzącej gali (lub bieżący) | Unika pustego kalendarza gdy najbliższa gala jest za kilka miesięcy |
| Wiele gal w dniu | Mała plakietka z liczbą + wybór po kliknięciu | Skaluje się wizualnie bez rozjeżdżania siatki |
| Biblioteka kalendarzowa | Brak — własna siatka na dayjs | Dayjs już jest zależnością; biblioteka wymagałaby nadpisywania stylu pod brutalistyczny design appki |
| Testy | Unit test czystej funkcji `buildMonthGrid` | Pokrywa lata przestępne i offsety dnia tygodnia bez uruchamiania całej appki |

## Scope

**In scope:**
- Przełącznik LISTA/KALENDARZ na `/personel/schedule`
- Nowa czysta funkcja `utils/calendar.ts` (`buildMonthGrid`)
- Nowy komponent `PersonelCalendarGrid.vue` + `BoxingGloveIcon.vue`
- Unit test dla logiki siatki dni

**Out of scope:**
- Zmiany w API/backendzie
- Nowa podstrona (`/personel/calendar`)
- Rozróżnienie ikony per typ przypisania (fight vs event)
- Zewnętrzna biblioteka kalendarzowa

## Architecture / Approach

`buildMonthGrid(year, month)` — czysta funkcja dayjs zwracająca komórki dni (z dopełnieniem sąsiednich miesięcy). `PersonelCalendarGrid` renderuje siatkę na bazie tej funkcji + propa `events`, emituje `select-event(id)` do rodzica. `schedule.vue` przełącza między istniejącą listą a nowym komponentem, współdzieląc już istniejący `selectedEvent` + `openDetail`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Kalendarz | Siatka miesiąca, przełącznik widoku, ikona rękawicy, integracja z schedule.vue | Offset dnia tygodnia / lata przestępne policzone błędnie |
| 2. Testy | Unit test `buildMonthGrid` + manualna regresja listy | Brak — czysto weryfikacyjna faza |

**Prerequisites:** Brak — bazuje wyłącznie na już istniejącym `/api/personel/events`
**Estimated effort:** ~1 sesja, 2 fazy

## Open Risks & Assumptions

- Zakładamy że `events.date` zawsze jest w formacie `YYYY-MM-DD` (potwierdzone w kodzie tworzenia gali) — brak walidacji formatu na wejściu do `buildMonthGrid`, bo dane pochodzą z zaufanego wewnętrznego API

## Success Criteria (Summary)

- Personel może przełączyć się na widok kalendarza i zobaczyć swoje gale jako podświetlone dni z ikoną rękawicy
- Kliknięcie dnia pokazuje te same szczegóły co w liście
- Widok listy działa dokładnie tak jak przed zmianą (brak regresji)
