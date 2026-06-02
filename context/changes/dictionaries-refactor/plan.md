---
change_id: dictionaries-refactor
title: Dictionaries UI refactor — merge tables, back button, button transforms
status: planned
created: 2026-06-02
updated: 2026-06-02
---

## Overview

Trzy zmiany UI po S-02:
1. Merge tabel ROLE + WYMAGANIA WALK w jedną tabelę z kolumną MIN. NA WALKĘ
2. Dodanie przycisku powrotu (dzwonek + WRÓĆ) w AdminNav
3. Zmiana transform na buttonach z `skewX(-8deg)` → `rotate(2deg)` base / `rotate(-2deg)` hover

## Current State Analysis

- `app/pages/admin/dictionaries.vue` — 2 osobne sekcje (ROLE + WYMAGANIA WALK), 4 modale, redundantne dane
- `app/components/AdminNav.vue` — brak linku powrotu do `/`
- Buttony w `users.vue`, `index.vue`, `dictionaries.vue`, `AdminNav.vue` używają `skewX(-8deg)` base + `skewX(8deg)` hover (efekt lustra)

## Desired End State

Jedna tabela ROLE z kolumnami NAZWA | MIN. NA WALKĘ | EDIT. Modal DODAJ ROLĘ ma 2 pola: nazwa + min. na walkę (opcjonalne). Brak min. → szary tekst "BRAK" w tabeli. AdminNav ma link ← WRÓĆ z ikoną dzwonka. Wszystkie buttony używają `rotate(2deg)` base / `rotate(-2deg)` hover.

## What We're NOT Doing

- Zmiany w API / backendzie
- Zmiany w DB
- Usunięcie endpointów `/api/admin/dictionaries/requirements/*` (zostają, przydadzą się w S-04)
- Zmiany w roadmap.md (zmiana nie dotyczy slice'a)

## Implementation Approach

Jedna faza — czysto frontend. Brak zależności.

---

## Phase 1: UI refactor

### Overview

Merge tabel w `dictionaries.vue`, dodanie back button w `AdminNav.vue`, update transform na buttonach we wszystkich 4 plikach.

### Changes Required

#### 1. `app/pages/admin/dictionaries.vue`

**Intent**: Usuń sekcję WYMAGANIA WALK. W tabeli ROLE dodaj kolumnę MIN. NA WALKĘ z badge'em liczby (lub szarym "BRAK" jeśli brak wymagania). Modal DODAJ ROLĘ → 2 pola (nazwa + count opcjonalne). Modal EDIT ROLI → 2 pola (nazwa + count, oba prefillowane). Przy save — jeśli count podany: upsert requirement; jeśli pusty i istniał: delete requirement.

**Contract**: Komponent zarządza stanem `roles` i `requirements` razem. Funkcja `saveAddRole()` po dodaniu roli sprawdza czy count podany — jeśli tak, wywołuje POST `/api/admin/dictionaries/requirements`. Funkcja `saveEditRole()` sprawdza zmianę count — jeśli nowy count: POST lub PATCH; jeśli count wyczyszczony a requirement istniał: DELETE. Tabela: 3 kolumny (NAZWA | MIN. NA WALKĘ | akcje).

#### 2. `app/components/AdminNav.vue`

**Intent**: Dodaj link ← WRÓĆ z emoji dzwonka 🔔 po lewej stronie loga, prowadzący do `/`.

**Contract**: Element `<a href="/" class="back-link">🔔 WRÓĆ</a>` przed `.nav-logo`. Styl: `color: rgba(255,255,255,0.5)`, border, `rotate(2deg)` base, `rotate(-2deg)` hover.

#### 3. Buttony we wszystkich plikach

**Intent**: Zamień `skewX(-8deg)` / `skewX(8deg)` na `rotate(2deg)` / `rotate(-2deg)` we wszystkich elementach interaktywnych.

**Contract**: Pliki: `AdminNav.vue`, `dictionaries.vue`, `users.vue`, `index.vue`. Wzorzec: base `.btn { transform: rotate(2deg); transition: none; }`, hover `.btn:hover { transform: rotate(-2deg); }`. Decorative/static badges (`.section-badge`, `.title-badge`, `.count-badge`, `.role-badge`) — pozostają ze `skewX(-8deg)` bez hover transformu.

### Success Criteria

#### Automated Verification

- `npm run build` przechodzi bez błędów

#### Manual Verification

- `/admin/dictionaries` — jedna tabela ROLE z kolumną MIN. NA WALKĘ
- Dodaj rolę bez count → kolumna pokazuje szary "BRAK"
- Dodaj rolę z count → kolumna pokazuje badge z liczbą
- EDIT roli — można zmienić nazwę i count jednocześnie
- AdminNav pokazuje 🔔 WRÓĆ, kliknięcie przenosi do `/`
- Hover na buttonach — `rotate(-2deg)` bez ease

---

## Progress

### Phase 1: UI refactor

#### Automated

- [x] 1.1 npm run build passes — c506f34

#### Manual

- [x] 1.2 One table with MIN. NA WALKĘ column — c506f34
- [x] 1.3 BRAK shown when no count set — c506f34
- [x] 1.4 Add role with count — badge visible — c506f34
- [x] 1.5 Edit role — name + count in one modal — c506f34
- [x] 1.6 AdminNav WRÓĆ button navigates to / — c506f34
- [x] 1.7 Hover rotate(-2deg) on all buttons — c506f34
