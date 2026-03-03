# Phase 3.16 – chat_core

- BASE_REF: `57100a6`
- HEAD: `6a259a5`
- Slice: `chat_core`
- Evidence: `reports/verification/phase3-chat_core-20260116-002740`

## Permissions & Module Gate
- Module gate: `assertModuleEnabled('chat')`.
- READ permission: `ui:finance_reports:view`.
- MANAGE permission: `inventory:manage` (used for force deletes/archives).

## Endpoints
- Channels: `GET/POST /api/chat/channels`, `GET/PATCH /api/chat/channels/[channelId]`, `POST /api/chat/channels/[channelId]/archive`, `POST /api/chat/channels/[channelId]/unarchive`.
- Messages: `GET/POST /api/chat/channels/[channelId]/messages`, `PATCH/DELETE /api/chat/messages/[messageId]`.
- Calls: `POST /api/chat/channels/[channelId]/calls`, `GET /api/chat/calls/[callId]`, `POST /api/chat/calls/[callId]/join`, `POST /api/chat/calls/[callId]/leave`, `POST /api/chat/calls/[callId]/end`.

## UI Routes
- `/chat` (channel list/create).
- `/chat/channels/[channelId]` (messages + call panel).

## Behaviour Notes
- Channels default workspace auto-created; `general`/`ops` seeded if missing.
- Messages paginated; 30-minute edit/delete window for authors, MANAGE can override. Outside-window edits return 409.
- Calls are signalling-only: start → active → ended; join/leave idempotent; second end returns 409.
- All state stored in chat Prisma models (no schema changes); tenant-scoped.

## Seed / Unseed / Verifier
- Seed `scripts/qa/seed_chat_core.ts`: creates tenant/workspace/channel, posts 3 messages (one backdated >1h), edits within window, seeds active call with participant.
- Unseed `scripts/qa/unseed_chat_core.ts`: deletes chat messages/channels/workspace/call sessions/participants by tenant.
- Verifier `scripts/verification/verify_phase3_chat_core.mjs`: seeds, asserts channel/message pagination, edit window enforcement (409 on stale edit), manage delete, call lifecycle (start/join/leave/end, second end 409), then unseeds and checks cleanup.

## Commands
- Slice gate (ran & passed):
  - `TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/nexa_vitest?schema=phase3_main_chat_db01' SLICE_KEY=chat_core BASE_REF=57100a6 bash scripts/verification/run_phase3_slice.sh`
