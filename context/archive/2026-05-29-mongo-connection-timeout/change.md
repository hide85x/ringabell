---
change_id: mongo-connection-timeout
title: Fix MongoDB connection hang on Workers — serverSelectionTimeoutMS doesn't interrupt V8 isolate network ops
status: archived
created: 2026-05-29
updated: 2026-06-15
archived_at: 2026-06-15T19:34:19Z
---

## Notes

serverSelectionTimeoutMS nie przerywa wiszącej operacji sieciowej na V8 isolates — Worker wisi i zostaje zabity przez runtime zamiast rzucić timeout error
