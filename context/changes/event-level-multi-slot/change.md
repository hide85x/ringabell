---
change_id: event-level-multi-slot
title: Event-level dropdown w Managerze nie wspiera count > 1 z event_requirement_defaults
status: preparing
created: 2026-08-13
updated: 2026-08-13
archived_at: null
---

## Notes

app/pages/manager/events.vue: sekcja OBSŁUGA GALI (event-level requirements, dodane w zmianie event-level-requirements-dictionary) renderuje jeden dropdown na rolę bez uwzględnienia req.count, mimo że event_requirement_defaults pozwala Adminowi ustawić count > 1 dla dowolnej roli na poziomie gali. Poziom walki (fight_requirements) ma pełne wsparcie multi-slot. Research: zakres problemu — czy to tylko UI, czy też backend/walidacja, i czy są inne miejsca zależne od założenia "1 osoba per rola na poziomie gali".

**Superseded**: cała koncepcja event-level dictionary zostaje usunięta w `context/changes/unify-personnel-dictionary/` — ten bug staje się nieaktualny, nie jest naprawiany.
