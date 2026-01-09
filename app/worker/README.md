# worker

Purpose
- Background jobs: mail sync, AI suggestion generation, dedup checks, exports.

Suggested stack
- Node.js worker using BullMQ (Redis) or similar
- Job types: gmail_sync, ai_suggest, dedupe_check, export_png_svg

How to start (MVP)
- Implement a simple worker that listens to a queue and logs jobs.
