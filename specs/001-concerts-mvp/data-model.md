# Data Model: Concerts MVP

## Entities

### Concert

- Description: Represents a scheduled or historical performance.
- Table: `concerts`
- Fields:
  - `id` (uuid, PK, default: gen_random_uuid())
  - `date_start` (timestamptz, not null)
  - `date_end` (timestamptz, nullable)
  - `status` (enum/text, not null) — values: `contacted`, `scheduled`, `completed`, `cancelled`
  - `title` (text, not null) — stored title; the frontend derives it as `venue_name — city` when not provided
  - `venue_name` (text, not null)
  - `city` (text, nullable)
  - `country` (text, nullable)
  - `address` (text, nullable)
  - `lat` (numeric, nullable)
  - `lng` (numeric, nullable)
  - `venue_contact_name` (text, nullable)
  - `venue_contact_email` (text, nullable)
  - `notes` (text, nullable)
  - `created_by` (uuid, FK -> `app_users`.id, not null)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

- Validation rules:
  - `date_start` must be present and `date_end` if present must be >= `date_start`.
  - `venue_contact_email` must match a simple email regex when provided.
  - `lat`/`lng` if provided must be valid decimal coordinates.

> Implementation note (current UI): the create/edit form currently requires `city` even though the DB model allows it to be null.

- Indexes:
  - Index on `date_start` for chronological queries.
  - GIST/GEOGRAPHY index if using PostGIS for spatial queries (optional).

- Access control & RLS:
  - Row-level policy: only rows visible to authorized users; editing/deletion requires `created_by = auth.uid()` or a separate admin flag.

### AppUser

- Description: Authorized application users.
- Table: `app_users`
- Fields:
  - `id` (uuid, PK) — matches Supabase auth UID
  - `email` (text, unique, not null)
  - `is_active` (boolean, default true)
  - `name` (text, nullable)
  - `picture` (text, nullable)
  - `last_login_at` (timestamptz, nullable)
  - `created_at` (timestamptz, default now())

- Validation rules:
  - `email` must be unique and non-null.

- Access control:
  - Only `is_active = true` users are allowed to use the app. RLS policies enforce this.

## Relationships

- `concerts.created_by` -> `app_users.id` (many concerts per user)

## State transitions (Concert.status)

- `scheduled` -> `completed` when `date_end` passes and user marks as complete or system-derived
- `scheduled` -> `cancelled` when explicitly cancelled
- `cancelled` -> (no transitions) — archived state

## Notes

- Denormalized fields (e.g., `venue_name`, `city`) are allowed for simplicity; ensure derived values are reproducible from inputs.
- For MVP, geocoding is manual; lat/lng are optional and used for map rendering only.
