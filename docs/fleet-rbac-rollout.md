# Fleet OS RBAC rollout

This document tracks the staged authorization hardening of Fleet OS. The canonical roles are owner, admin, dispatcher, technician, and viewer. Authentication remains with Neon Auth; organization membership and permissions remain Fleet OS concerns.

Sprint 1 hardens server-side permissions before role-aware UI. Operational mutations must require capability permissions even when a user has a valid organization session. Read permissions remain separate from manage/execute permissions. Agent-executed mutations must satisfy both agent execution permission and the target domain permission.
