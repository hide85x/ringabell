# Boxer Fight Conflict — Implementation Plan

## Overview

Bokser nie powinien walczyć więcej niż raz na tej samej gali. Aktualna funkcja `availableForFightSlot` wyklucza duplikaty tylko w ramach jednej walki (ten sam slot), ale nie sprawdza czy bokser jest już przypisany do innej walki tej samej gali.

## Current State Analysis

- `availableForFightSlot` w `app/pages/manager/events.vue:337-344` buduje listę `takenIds` tylko z przypisań do **tej samej walki** (ten sam fight, ta sama rola)
- `conflictingPersonIds` z backendu (`[id].get.ts:67-82`) sprawdza wyłącznie konflikty **między galami** (ta sama data, inna gala)
- Wszystkie walki i ich przypisania są dostępne w `eventDetail.value.fights` — brak potrzeby dodatkowych queries
- Backend `assignments/index.post.ts` nie waliduje tego przypadku (świadoma decyzja: fix tylko frontendowy)
- `canPublish` nie musi się zmieniać — istniejące duplikaty w DB nie blokują publikacji

## Desired End State

Bokser przypisany do walki #1 nie pojawia się w dropdownie walki #2 tej samej gali (jest ukryty, spójnie z istniejącym wzorcem `takenIds`). Nadal widoczny jeśli jest aktualnie wybrany w danym slocie (żeby można go było odznaczyć).

### Key Discoveries

- Wzorzec: `app/pages/manager/events.vue:337-344` — `availableForFightSlot` już filtruje `takenIds`, wystarczy dodać jeden blok
- Dane dostępne: `eventDetail.value.fights` zawiera wszystkie walki + ich `assignments` — zero nowych queries
- Rola `'Bokser'` to jedyna rola z tym ograniczeniem; sędziowie, lekarze itp. mogą pracować przy wielu walkach

## What We're NOT Doing

- Brak walidacji w `assignments/index.post.ts` (API nie zwraca 400)
- Brak zmiany w `canPublish` — stare dane z duplikatami nie blokują publikacji
- Brak disabled opcji z etykietą w dropdown — ukrycie jest wystarczające i spójne z istniejącym wzorcem

## Implementation Approach

Jedna zmiana w jednej funkcji frontendowej. Dla `role === 'Bokser'` zbieramy ID bokserów przypisanych do wszystkich innych walk tej gali i dodajemy je do `takenIds`.

---

## Phase 1: Frontend fix + testy

### Overview

Zmiana funkcji `availableForFightSlot` w `events.vue` + manualna weryfikacja 3 scenariuszy.

### Changes Required

#### 1. Blokada duplikatu boksera między walkami

**File**: `app/pages/manager/events.vue`

**Intent**: Dla slotu z rolą `Bokser` ukryć w dropdownie bokserów już przypisanych do innych walk tej samej gali.

**Contract**: W `availableForFightSlot` (linia ~337), po zbudowaniu `takenIds` z przypisań w tej samej walce, dodać blok:

```ts
if (role === 'Bokser' && eventDetail.value) {
  const boxersInOtherFights = eventDetail.value.fights
    .filter(f => f.id !== fight.id)
    .flatMap(f => f.assignments.filter(a => a.role === 'Bokser').map(a => a.personId))
  takenIds.push(...boxersInOtherFights)
}
```

`currentPersonId` jest już na liście wyjątków (`|| p.id === currentPersonId`) — bokser wybrany w bieżącym slocie pozostaje widoczny.

### Success Criteria

#### Automated Verification

- [ ] 1.1 TypeScript kompiluje się bez błędów: `npm run build`

#### Manual Verification

- [ ] 1.2 Bokser przypisany do walki #1 nie pojawia się w dropdownie walki #2
- [ ] 1.3 Bokser nieprzypisany do żadnej walki pojawia się we wszystkich dropdownach
- [ ] 1.4 Bokser wybrany w walce #1 — po ponownym otwarciu walki #1 nadal widoczny w swoim slocie (można go odznaczyć)

**Implementation Note**: Po ukończeniu tej fazy i przejściu automated verification — poczekaj na potwierdzenie manual verification przed zakończeniem zmiany.

---

## Testing Strategy

### Manual Testing Steps

1. Otwórz galę z ≥ 2 walkami z wymaganiem Bokser ×2
2. Przypisz boksera X do walki #1
3. Przejdź do walki #2 — bokser X nie powinien być widoczny w dropdownie
4. Upewnij się że pozostali boksery są widoczni
5. Wróć do walki #1 — bokser X nadal widoczny w swoim slocie

## References

- Zmieniana funkcja: `app/pages/manager/events.vue:337-344`
- Wzorzec konfliktów między galami: `server/api/manager/events/[id].get.ts:67-82`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Frontend fix + testy

#### Automated

- [x] 1.1 TypeScript kompiluje się bez błędów: `npm run build`

#### Manual

- [ ] 1.2 Bokser przypisany do walki #1 nie pojawia się w dropdownie walki #2
- [ ] 1.3 Bokser nieprzypisany do żadnej walki pojawia się we wszystkich dropdownach
- [ ] 1.4 Bokser wybrany w walce #1 nadal widoczny w swoim slocie po przypisaniu
