---
project: RingAbell
version: 1
status: draft
created: 2026-05-28
updated: 2026-06-15
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: RingAbell

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Firma promocji bokserskiej zarządza dziesiątkami ludzi w ściśle określonych rolach przy każdej gali. Ręczne planowanie przez telefon i arkusz przestaje działać gdy skala rośnie — ta sama osoba ląduje w dwóch miejscach naraz, gala trafia na ring bez lekarza. RingAbell to jedno miejsce: manager planuje obsadę z automatyczną walidacją konfliktów i wymagań, a każdy uczestnik widzi swój harmonogram.

## North star

**S-05: Manager tworzy galę z kompletną obsadą i wysyła emaile do personelu** — najważniejszy przepływ end-to-end, który udowadnia że rdzeń produktu działa (czyli: najmniejszy kompletny przepływ, którego powodzenie potwierdza główną hipotezę produktu — że system zastępuje telefon i arkusz w organizacji gali). Jeśli ten flow działa, wszystko inne jest rozszerzeniem.

## At a glance

| ID   | Change ID                    | Outcome (użytkownik może …)                                              | Prerequisites      | PRD refs                               | Status   |
|------|------------------------------|--------------------------------------------------------------------------|--------------------|----------------------------------------|----------|
| F-01 | auth-scaffold                | (fundament) OAuth social login działa; sesje i role systemowe dostępne   | —                  | Access Control, FR-001, FR-002         | done     |
| F-02 | data-scaffold                | (fundament) Cloudflare D1 jako baza danych; modele bazowe zdefiniowane (User, Person, BoxingEvent, Fight, Assignment) | F-01          | FR-001–FR-015, Business Logic          | done     |
| S-01 | admin-user-management        | Admin zarządza kontami użytkowników i przypisuje role systemowe          | F-01, F-02         | FR-001, FR-002                         | done     |
| S-02 | admin-dictionaries           | Admin zarządza słownikami ról personelu i wymagań per walka              | F-01, F-02         | FR-003                                 | done     |
| S-03 | personnel-management         | Manager dodaje, edytuje i dezaktywuje osoby z bazy personelu             | F-01, F-02         | FR-004, FR-005                         | proposed |
| S-04 | event-and-fight-management   | Manager tworzy galę, dodaje walki i przypisuje personel z walidacją live | F-01, F-02, S-02, S-03 | FR-006, FR-007, FR-008, FR-009, FR-010, FR-012 | proposed |
| S-05 | event-publish-and-email      | Manager publikuje galę i cały przypisany personel otrzymuje email        | S-04               | US-01, FR-011                          | proposed |
| S-06 | personnel-schedule-view      | Personel widzi swój kalendarz i szczegóły przypisanych gal               | F-01, F-02, S-05   | FR-013, FR-014                         | proposed |

## Streams

Pomoc nawigacyjna — grupuje elementy ze wspólnym łańcuchem prerequisites. Kanoniczna kolejność żyje w grafie zależności poniżej; ta tabela to proponowana kolejność czytania między równoległymi ścieżkami.

| Stream | Temat                    | Łańcuch                                              | Uwaga                                                           |
|--------|--------------------------|------------------------------------------------------|-----------------------------------------------------------------|
| A      | Fundamenty               | `F-01` → `F-02`                                      | Prerequisite dla wszystkich slice'ów; główna oś sekwencji       |
| B      | Panel admina             | `S-01` / `S-02`                                      | Równoległe po F-01+F-02; S-02 prerequisite dla S-04             |
| C      | Zarządzanie personelem   | `S-03`                                               | Równoległy z S-01/S-02 po F-01+F-02; S-03 prerequisite dla S-04 |
| D      | Gwiazda przewodnia       | `S-04` → `S-05`                                      | Główna ścieżka walidacji; cel sekwencjonowania `speed`          |
| E      | Widok personelu          | `S-06`                                               | Secondary Success Criterion; dołącza po S-05                    |

## Baseline

Stan bazy kodu na 2026-05-28 (auto-researched + potwierdzone przez użytkownika).
Fundamenty poniżej zakładają że te warstwy są obecne i NIE re-scaffoldują ich.

- **Frontend:** partial — Nuxt 4 + Vue 3 + vue-router, brak stron, brak komponentów UI. `app/app.vue`
- **Backend / API:** absent — brak `server/api/`, brak middleware, brak logiki serwerowej
- **Data:** absent — mongoose niezainstalowany, brak modeli, brak schematów
- **Auth:** absent — nuxt-auth-utils niezainstalowany, brak OAuth handlers
- **Deploy / infra:** present — Cloudflare Pages, `wrangler.toml`, deploy na `ringabell-foe.pages.dev`
- **Observability:** absent — brak loggera, brak error trackingu, brak `/healthz`

## Foundations

### F-01: Auth scaffold

- **Outcome:** (fundament) OAuth social login działa przez nuxt-auth-utils; sesje użytkowników są wydawane i weryfikowane; middleware chroni wszystkie trasy przed niezalogowanym dostępem; model User z polem `role` (Admin/Manager/Personel) jest gotowy do odczytu.
- **Change ID:** auth-scaffold
- **PRD refs:** Access Control, FR-001, FR-002
- **Unlocks:** F-02 (model User potrzebny do powiązania z encjami), S-01, S-02, S-03, S-04, S-05, S-06 — każdy slice wymaga zalogowanego użytkownika z rolą
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - ~~Czy nuxt-auth-utils sesje działają poprawnie na Cloudflare Workers (Web Crypto vs Node.js crypto)?~~ — Zweryfikowane smoke-testem 2026-05-28. Google OAuth + sesje działają na Workers. NUXT_SESSION_PASSWORD wymagany w Cloudflare Workers env vars.
- **Risk:** Pierwsze wdrożenie auth na Workers może wymagać debugowania Web Crypto — zablokuje cały downstream. Najważniejsza weryfikacja całego projektu.
- **Status:** ready

### F-02: Data scaffold

- **Outcome:** (fundament) Cloudflare D1 jako baza danych; modele bazowe zdefiniowane: User (rozszerzony o role i profil), Person (baza personelu), BoxingEvent (gala), Fight (walka), Assignment (przypisanie personelu do walki/gali). Schemat zarządzany przez migracje D1. ~~MongoDB Atlas~~ — zrezygnowano: cold start na Workers free plan był zbyt duży (change: mongodb-to-d1).
- **Change ID:** data-scaffold, mongodb-to-d1
- **PRD refs:** FR-001–FR-015, Business Logic, NFR (walidacja poniżej 1s)
- **Unlocks:** S-01, S-02, S-03, S-04, S-05, S-06 — wszystkie slice'y czytają/piszą do bazy
- **Prerequisites:** F-01 (model User musi istnieć przed rozszerzeniem o dane domenowe)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - ~~Czy MongoDB Atlas połączy się poprawnie na Cloudflare Workers?~~ — Zweryfikowane 2026-05-29, następnie zrezygnowano z MongoDB na rzecz D1 z powodu cold start (change: mongodb-to-d1, 2026-06-xx).
  - ~~Czy CPU limit 30ms na Workers nie będzie przekroczony przy złożonych zapytaniach?~~ — D1 jest natywny dla Workers, cold start wyeliminowany. Monitorować przy S-04.
- **Risk:** Schemat zdefiniowany tutaj determinuje walidację biznesową w S-04. Błąd w modelu Assignment (wymagane role per walka) odkryty późno kosztuje refactor wszystkich slice'ów downstream.
- **Status:** ready

## Slices

### S-01: Zarządzanie użytkownikami (Admin)

- **Outcome:** Admin może dodawać, edytować i usuwać konta użytkowników oraz przypisywać im role systemowe (Admin/Manager/Personel). Login przez Google OAuth (email musi być w bazie) lub email+hasło (credentials, hasło ustawiane przez Admina przy tworzeniu konta). Strona główna `/` z formularzem credentials + Google button. Strona `/admin/users` z tabelą, modalem edycji i formularzem dodawania.
- **Change ID:** admin-user-management
- **PRD refs:** FR-001, FR-002
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-02, S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Usunięcie użytkownika przypisanego do przyszłej gali zostawia lukę w obsadzie — PRD akceptuje to zachowanie (manager widzi błąd walidacji). Upewnić się że cascade delete nie usuwa historycznych przypisań.
- **Status:** done

### S-02: Słowniki ról i wymagań (Admin)

- **Outcome:** Admin może zarządzać słownikami ról personelu (bokser, sędzia, lekarz, konferansjer, ratownik) oraz definiować wymagania per walka (liczba bokserów, sędziów, lekarzy).
- **Change ID:** admin-dictionaries
- **PRD refs:** FR-003
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-01, S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Słownik wymagań per walka jest twardym prerequisite dla logiki walidacji w S-04. Jeśli struktura słownika zmieni się po S-04, refactor walidacji będzie konieczny. Zdefiniować schemat raz, przed S-04.
- **Status:** done

### S-03: Zarządzanie personelem (Manager)

- **Outcome:** Manager może dodawać, edytować i dezaktywować osoby z bazy personelu oraz przypisywać im kategorie ról (bokser, sędzia, lekarz itp.). Dezaktywacja usuwa osobę z list wyboru, historia przypisań zostaje.
- **Change ID:** personnel-management
- **PRD refs:** FR-004, FR-005
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-01, S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Dezaktywacja vs usunięcie to kluczowa decyzja domenowa (PRD §FR-004). Upewnić się że soft-delete jest zaimplementowany przed pierwszym przypisaniem personelu do gali.
- **Status:** proposed

### S-04: Tworzenie gali, walk i przypisanie personelu (Manager)

- **Outcome:** Manager może tworzyć galę (data, miejsce), dodawać walki, przypisywać personel do walk i gali, z walidacją live na dwóch poziomach: per walka (brak sędziego, konflikt dat) i per gala (brak ratownika, konferansjera). Ostrzeżenia widoczne na bieżąco; przypisanie możliwe mimo ostrzeżenia. Publikacja zablokowana przy aktywnych błędach.
- **Change ID:** event-and-fight-management
- **PRD refs:** FR-006, FR-007, FR-008, FR-009, FR-010, FR-012
- **Prerequisites:** F-01, F-02, S-02, S-03
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Czy walidacja live (NFR: poniżej 1s) zmieści się w CPU limicie 30ms Workers przy złożonej gali? — Owner: dev. Block: no. Zoptymalizować zapytania jeśli problem wystąpi po wdrożeniu.
- **Risk:** To najszerszy slice — obejmuje 6 must-have FR i całą logikę walidacji biznesowej. Jeśli zabraknie czasu, można podzielić: najpierw CRUD gali/walk bez walidacji (S-04a), potem walidacja live (S-04b). Takie podzielenie robi się przez `/10x-plan`, nie tutaj.
- **Status:** proposed

### S-05: Publikacja gali i wysyłka emaili (Manager) ★ GWIAZDA PRZEWODNIA

- **Outcome:** Manager może opublikować galę przyciskiem "STWÓRZ GALĘ" — status gali zmienia się na opublikowaną, każda przypisana osoba otrzymuje email z nazwą gali, datą, miejscem i swoją rolą. Opublikowana gala nie może być usunięta, tylko anulowana.
- **Change ID:** event-publish-and-email
- **PRD refs:** US-01, FR-011, FR-007
- **Prerequisites:** S-04
- **Parallel with:** —
- **Blockers:** Konto Resend (lub MailChannels) z skonfigurowanym RESEND_API_KEY w Cloudflare Workers secrets — wymagane przed wdrożeniem tego slice'a
- **Unknowns:**
  - Czy wysyłka emaili do całego personelu gali zmieści się w CPU limicie 30ms Workers? — Owner: dev. Block: yes. Jeśli nie — przenieść wysyłkę do Cloudflare Queue Worker (osobny worker, per-message). Rozwiązanie znane, implementacja zależy od testu.
- **Risk:** nodemailer nie działa na V8 isolates — należy użyć Resend SDK lub MailChannels. To jest znane ograniczenie (infrastructure.md §Risk Register). Nie używać nodemailer pod żadnym pozorem.
- **Status:** proposed

### S-06: Widok harmonogramu (Personel)

- **Outcome:** Personel może zalogować się i zobaczyć swój kalendarz nadchodzących gal z datami i rolami oraz szczegóły każdej gali do której jest przypisany.
- **Change ID:** personnel-schedule-view
- **PRD refs:** FR-013, FR-014
- **Prerequisites:** F-01, F-02, S-05
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Ten slice jest użyteczny tylko po S-05 — bez opublikowanej gali nie ma co wyświetlać. Sekwencjonowany ostatni celowo; jeśli zabraknie czasu, MVP jest nadal spójny bez niego (Primary Success Criterion to US-01, nie ten widok).
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                  | Sugerowany tytuł issue                                      | Gotowe do `/10x-plan` | Uwagi                                        |
|------------|----------------------------|-------------------------------------------------------------|-----------------------|----------------------------------------------|
| F-01       | auth-scaffold              | [RingAbell] Auth scaffold — OAuth + sesje + role systemowe  | ~~nie~~ **done**      | Zaimplementowane                             |
| F-02       | data-scaffold              | [RingAbell] Data scaffold — D1 + modele bazowe              | ~~nie~~ **done**      | Zaimplementowane (MongoDB → D1)              |
| S-01       | admin-user-management      | [RingAbell] Admin — zarządzanie użytkownikami i rolami      | ~~nie~~ **done**      | Zaimplementowane — zarchiwizowane 2026-06-15 |
| S-02       | admin-dictionaries         | [RingAbell] Admin — słowniki ról i wymagań per walka        | ~~nie~~ **done**      | Zaimplementowane                             |
| S-03       | personnel-management       | [RingAbell] Manager — baza personelu (CRUD + dezaktywacja)  | tak                   | Prerequisites spełnione (F-01 + F-02 ready) |
| S-04       | event-and-fight-management | [RingAbell] Manager — gale, walki, obsada, walidacja live   | nie                   | Czeka na S-03                                |
| S-05       | event-publish-and-email    | [RingAbell] Manager — publikacja gali + wysyłka emaili      | nie                   | Czeka na S-04 + konto Resend                 |
| S-06       | personnel-schedule-view    | [RingAbell] Personel — widok kalendarza i szczegółów gali   | nie                   | Czeka na S-05; Secondary SC, parkuj gdy brak czasu |

## Open Roadmap Questions

1. ~~**Czy nuxt-auth-utils działa poprawnie na Cloudflare Workers (Web Crypto)?**~~ — Rozwiązane 2026-05-28. Google OAuth + sesje działają na Workers.
2. **Czy wysyłka emaili do całego personelu gali zmieści się w CPU limicie 30ms Workers?** — Owner: dev. Blokuje: S-05. Rozwiązanie: test po wdrożeniu S-04; jeśli przekroczenie — Cloudflare Queue Worker.

## Parked

- **Powiadomienia emailowe przy zmianach obsady** — PRD §Non-Goals: "Zmiany w obsadzie nie wysyłają kolejnych powiadomień (v2)."
- **Raportowanie i statystyki** — PRD §Non-Goals: "Brak historii gal, statystyk bokserów, eksportu danych w MVP."
- **Integracja z zewnętrznymi kalendarzami** — PRD §Non-Goals: "Brak synchronizacji z zewnętrznymi systemami kalendarzy."
- **Zgłoszenie niedyspozycji przez personel (FR-015)** — PRD: nice-to-have, odłożone do v2. "Ten workflow to niemal tyle roboty co cały MVP."
- **Observability / error tracking** — brak w PRD jako must-have; dodać po MVP gdy produkcja jest stabilna.
- **CI/CD (GitHub Actions auto-deploy)** — infrastructure.md §Out of Scope: "deferred to next milestone."

## Done

| ID   | Change ID             | Co zostało dostarczone                                                                 | Data       |
|------|-----------------------|----------------------------------------------------------------------------------------|------------|
| F-01 | auth-scaffold         | OAuth Google + sesje nuxt-auth-utils + middleware RBAC + role Admin/Manager/Personel   | 2026-05-28 |
| F-02 | data-scaffold         | D1 jako baza (po migracji z MongoDB), modele: User/Person/BoxingEvent/Fight/Assignment | 2026-06-xx |
| S-01 | admin-user-management | CRUD użytkowników, przypisywanie ról, strona `/admin/users`                            | 2026-06-xx |
| S-02 | admin-dictionaries    | Słowniki ról personelu i wymagań per walka, strona `/admin/dictionaries`               | 2026-06-15 |
