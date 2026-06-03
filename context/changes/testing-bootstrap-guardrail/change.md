---
change_id: testing-bootstrap-guardrail
title: Bootstrap test runner i integration testy guardrail publikacji gali (Phase 1 rollout)
status: impl_reviewed
created: 2026-06-02
updated: 2026-06-02
archived_at: null
---

## Notes

Rollout Phase 1 z context/foundation/test-plan.md: "Bootstrap + guardrail walidacji".
Risks covered: #1 (publikacja bez wymaganej roli blokuje galę), #2 (konflikt dat blokuje publikację).
Test types planned: unit, integration.
Risk response intent:
- Risk #1: udowodnij że próba opublikowania gali z brakującą wymaganą rolą per walka lub per gala zwraca błąd i blokuje publikację; challenge: nie zakładaj że "ostrzeżenie = blokada"; avoid: happy-path only.
- Risk #2: udowodnij że próba opublikowania gali gdy ta sama osoba ma konflikt dat zwraca błąd i blokuje publikację; challenge: nie zakładaj że wyświetlenie ostrzeżenia = blokada; avoid: testowanie tylko ostrzeżenia przy przypisaniu bez testu blokady przy publikacji.
