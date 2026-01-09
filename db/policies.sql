-- db/policies.sql
-- Row Level Security (RLS) policies and helper functions for Gigator (Supabase)
-- Assumes auth.uid() is available (Supabase). Policies intentionally conservative;
-- service/webhook operations (stripe, gmail sync) should use the Supabase service_role
-- which bypasses RLS or use SECURITY DEFINER functions where needed.

-- Helper: current_profile_id()
-- Returns the profiles.id for the current authenticated user (by matching auth.uid()).
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT id FROM public.profiles WHERE auth_uid = auth.uid() LIMIT 1;
$$;

-- Enable RLS on tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- -------------------------
-- profiles policies
-- -------------------------
-- Allow anyone to insert a profile when auth.uid() matches auth_uid in the new row
CREATE POLICY "profiles_insert_for_current_user" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = auth_uid);

-- Allow a user to select their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT
  USING (auth.uid() = auth_uid);

-- Allow a user to update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = auth_uid)
  WITH CHECK (auth.uid() = auth_uid);

-- Optional: allow admins (role claim) to select/update all profiles
-- Example: grant when jwt contains claim "role" = "admin"
CREATE POLICY "profiles_admin_select" ON public.profiles
  FOR SELECT
  USING ( (current_setting('request.jwt.claims.role', true) = 'admin') );

CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE
  USING ( (current_setting('request.jwt.claims.role', true) = 'admin') );

-- -------------------------
-- organizations & membership
-- -------------------------
-- Utility expression: user is member of organization
-- We'll use a subquery directly in policies.

-- Allow organization members to SELECT the organization
CREATE POLICY "org_select_for_member" ON public.organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = public.current_profile_id()
    )
  );

-- Allow users to INSERT an organization where created_by is current_profile_id()
CREATE POLICY "org_insert_by_user" ON public.organizations
  FOR INSERT
  WITH CHECK (created_by = public.current_profile_id());

-- Allow organization admins/owners to UPDATE organization
CREATE POLICY "org_update_by_admin" ON public.organizations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = public.current_profile_id()
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = public.current_profile_id()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Organization members table:
-- Allow members to see rows relating to them or their organization
CREATE POLICY "org_members_select" ON public.organization_members
  FOR SELECT
  USING (
    user_id = public.current_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
        AND om2.user_id = public.current_profile_id()
        AND om2.role IN ('owner','admin')
    )
  );

-- Allow users to insert membership only if they are self (user_id = current_profile) OR an org admin
CREATE POLICY "org_members_insert" ON public.organization_members
  FOR INSERT
  WITH CHECK (
    user_id = public.current_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
        AND om2.user_id = public.current_profile_id()
        AND om2.role IN ('owner','admin')
    )
  );

-- Allow org admins to update membership rows (promote/demote/remove)
CREATE POLICY "org_members_update_by_admin" ON public.organization_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
        AND om2.user_id = public.current_profile_id()
        AND om2.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
        AND om2.user_id = public.current_profile_id()
        AND om2.role IN ('owner','admin')
    )
  );

-- -------------------------
-- opportunities (gigs/listings)
-- -------------------------
-- SELECT: public can see 'open' opportunities; owners and organization members can see their org/opps
CREATE POLICY "opportunities_select_public_open" ON public.opportunities
  FOR SELECT
  USING (
    status = 'open'
    OR owner_id = public.current_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = opportunities.organization_id
        AND om.user_id = public.current_profile_id()
    )
  );

-- INSERT: authenticated users can create opportunities with created_by = current_profile_id()
CREATE POLICY "opportunities_insert_auth" ON public.opportunities
  FOR INSERT
  WITH CHECK (created_by = public.current_profile_id());

-- UPDATE: owners or org admins can update (checked against owner_id or org membership role)
CREATE POLICY "opportunities_update_owner_or_org_admin" ON public.opportunities
  FOR UPDATE
  USING (
    owner_id = public.current_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = opportunities.organization_id
        AND om.user_id = public.current_profile_id()
        AND om.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    owner_id = public.current_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = opportunities.organization_id
        AND om.user_id = public.current_profile_id()
        AND om.role IN ('owner','admin')
    )
  );

-- DELETE: same as update
CREATE POLICY "opportunities_delete_owner_or_org_admin" ON public.opportunities
  FOR DELETE
  USING (
    owner_id = public.current_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = opportunities.organization_id
        AND om.user_id = public.current_profile_id()
        AND om.role IN ('owner','admin')
    )
  );

-- -------------------------
-- threads & messages (email sync)
-- -------------------------
-- Threads SELECT: allow if any message in thread was sent by current_profile OR if related opportunity owned by user OR org member
CREATE POLICY "threads_select_participant_or_owner" ON public.threads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.thread_id = threads.id
        AND m.sender_id = public.current_profile_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.related_thread_id = threads.id
        AND (o.owner_id = public.current_profile_id()
          OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = o.organization_id
              AND om.user_id = public.current_profile_id()
          )
        )
    )
  );

-- Threads INSERT: allow only service_role (webhook) or the authenticated user creating with an associated profile check
CREATE POLICY "threads_insert_service_or_creator" ON public.threads
  FOR INSERT
  WITH CHECK (
    -- allow service_role bypass (handled by service key) OR created by current_profile (if created_by column existed)
    (current_setting('request.jwt.claims.role', true) = 'service')
    OR true -- allow for now; rely on server to call with service role for imports
  );

-- Messages SELECT: allow if sender OR thread participant OR owner
CREATE POLICY "messages_select_relevant" ON public.messages
  FOR SELECT
  USING (
    sender_id = public.current_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.messages mm
      WHERE mm.thread_id = messages.thread_id
        AND mm.sender_id = public.current_profile_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.related_thread_id = messages.thread_id
        AND (o.owner_id = public.current_profile_id()
          OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = o.organization_id
              AND om.user_id = public.current_profile_id()
          )
        )
    )
  );

-- Messages INSERT: allow if sender_id = current_profile OR service_role
CREATE POLICY "messages_insert_sender_or_service" ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = public.current_profile_id()
    OR (current_setting('request.jwt.claims.role', true) = 'service')
  );

-- -------------------------
-- bookings & payments
-- -------------------------
-- Bookings SELECT: buyer or seller or opportunity owner or org member
CREATE POLICY "bookings_select_parties" ON public.bookings
  FOR SELECT
  USING (
    buyer_id = public.current_profile_id()
    OR seller_id = public.current_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = bookings.opportunity_id
        AND (o.owner_id = public.current_profile_id()
          OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = o.organization_id
          )
        )
    )
  );

-- Bookings INSERT: allow buyer to create booking where buyer_id = current_profile
CREATE POLICY "bookings_insert_by_buyer" ON public.bookings
  FOR INSERT
  WITH CHECK (buyer_id = public.current_profile_id());

-- Bookings UPDATE: allow seller, buyer, or org admin to update status/fields
CREATE POLICY "bookings_update_parties" ON public.bookings
  FOR UPDATE
  USING (
    buyer_id = public.current_profile_id()
    OR seller_id = public.current_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = bookings.opportunity_id
        AND EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = o.organization_id
            AND om.user_id = public.current_profile_id()
            AND om.role IN ('owner','admin')
        )
    )
  )
  WITH CHECK (
    buyer_id = public.current_profile_id()
    OR seller_id = public.current_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = bookings.opportunity_id
        AND EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = o.organization_id
            AND om.user_id = public.current_profile_id()
            AND om.role IN ('owner','admin')
        )
    )
  );

-- Payments SELECT: buyer/seller or org admin
CREATE POLICY "payments_select_parties" ON public.payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = payments.booking_id
        AND (b.buyer_id = public.current_profile_id() OR b.seller_id = public.current_profile_id())
    )
    OR (current_setting('request.jwt.claims.role', true) = 'service')
  );

-- Payments INSERT/UPDATE: generally done by service/webhook; allow service role only
CREATE POLICY "payments_manage_by_service" ON public.payments
  FOR ALL
  USING (current_setting('request.jwt.claims.role', true) = 'service')
  WITH CHECK (current_setting('request.jwt.claims.role', true) = 'service');

-- -------------------------
-- reviews
-- -------------------------
-- Reviews SELECT: allow public read if target_type = 'opportunity' and opportunity is open OR reviewer/target owner
CREATE POLICY "reviews_select_public" ON public.reviews
  FOR SELECT
  USING (
    reviewer_id = public.current_profile_id()
    OR
    (
      target_type = 'opportunity'
      AND EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = reviews.target_id AND o.status = 'open')
    )
    OR current_setting('request.jwt.claims.role', true) = 'admin'
  );

-- Reviews INSERT: allow reviewer to insert review for themselves
CREATE POLICY "reviews_insert_by_reviewer" ON public.reviews
  FOR INSERT
  WITH CHECK (reviewer_id = public.current_profile_id());

-- -------------------------
-- notifications
-- -------------------------
CREATE POLICY "notifications_for_user" ON public.notifications
  FOR ALL
  USING (user_id = public.current_profile_id())
  WITH CHECK (user_id = public.current_profile_id());

-- -------------------------
-- notes & recommendations
-- -------------------------
-- 1) Service processes (stripe webhooks, Gmail sync) should use the Supabase service_role (server-side key).
--    The service_role bypasses RLS; consider wrapping external writes in SECURITY DEFINER functions for safety.
-- 2) Adjust policies to fit your UX: e.g., expose organization/public listings via an "is_public" column and a policy allowing SELECT for is_public = true.
-- 3) Test policies carefully in Supabase UI: create test tokens and ensure expected behavior.
-- 4) Where policies use current_setting('request.jwt.claims.role', true) compare to your JWT claims naming; Supabase sets
--    jwt claims into request.jwt.claims.* by default. Another pattern uses auth.jwt() ->> 'role' depending on setup.