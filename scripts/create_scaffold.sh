#!/usr/bin/env bash
set -euo pipefail

# Creates project scaffold for Gigator:
# - app/frontend
# - app/backend
# - app/worker
# - infra
# Each directory receives a minimal README.md

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Creating scaffold under $ROOT"

mkdir -p "$ROOT/app/frontend"
mkdir -p "$ROOT/app/backend"
mkdir -p "$ROOT/app/worker"
mkdir -p "$ROOT/infra"
mkdir -p "$ROOT/_bmad/adrs"  # ensure ADR folder exists

# frontend README
cat > "$ROOT/app/frontend/README.md" <<'MD'
# frontend

Purpose
- Web frontend for Gigator.
- Suggested stack: React + TypeScript (Next.js recommended).

Contents (to add)
- UI components
- Pages: Dashboard, Inbox, Opportunities, Composer, Contacts, Salles
- Styling: design system / tokens (monochrome)
- Accessibility & responsiveness notes

How to start (MVP)
- npx create-next-app --typescript
- Add linting, testing and CI steps in root README or CI pipeline
MD

# backend README
cat > "$ROOT/app/backend/README.md" <<'MD'
# backend

Purpose
- Backend API and integration layer for Gigator.

Suggested stack
- Node.js + TypeScript (Fastify or Express)
- Postgres for relational data
- Redis for cache/locks/queues

Core responsibilities
- REST/GraphQL API (opportunities, threads, contacts, venues, activity)
- Gmail OAuth sync & webhook handling
- LLM/AI proxy service (suggestions)
- Worker orchestration endpoints / admin tasks

How to start (MVP)
- Initialize a TypeScript Node project
- Add basic server with a health endpoint and /api/ping
MD

# worker README
cat > "$ROOT/app/worker/README.md" <<'MD'
# worker

Purpose
- Background jobs: mail sync, AI suggestion generation, dedup checks, exports.

Suggested stack
- Node.js worker using BullMQ (Redis) or similar
- Job types: gmail_sync, ai_suggest, dedupe_check, export_png_svg

How to start (MVP)
- Implement a simple worker that listens to a queue and logs jobs.
MD

# infra README
cat > "$ROOT/infra/README.md" <<'MD'
# infra

Purpose
- Infrastructure-as-code for environments (dev/staging/production).

Suggested contents
- Terraform modules for: Postgres, Redis, Storage (S3), Service deployments
- Example: `terraform` folder with modules and README linking deploy steps
- CI/CD deployment pipelines (GitHub Actions templates) referenced here

MVP approach
- Provide a minimal Terraform example for managed Postgres and Redis (or document manual steps)
MD

# ADR folder hint
cat > "$ROOT/_bmad/adrs/README.md" <<'MD'
# ADRs

Store architecture decision records here. Example filenames:
- 0001-gig-stack.md
- 0002-database-schema.md

Reference ARCHITECTURE.md from root.
MD

# Make files world-readable
chmod +r "$ROOT/app"/*/README.md || true
chmod +r "$ROOT/infra/README.md" || true
chmod +r "$ROOT/_bmad/adrs/README.md" || true

echo "Scaffold created:"
echo " - $ROOT/app/frontend/README.md"
echo " - $ROOT/app/backend/README.md"
echo " - $ROOT/app/worker/README.md"
echo " - $ROOT/infra/README.md"
echo " - $ROOT/_bmad/adrs/README.md"

exit 0