-- db/triggers.sql
-- Triggers and functions for denormalized counters and notifications
-- Designed for Supabase / Postgres (uses public.notifications and counter columns on profiles)

-- 1) Opportunity counters (profiles.opportunities_count)
CREATE OR REPLACE FUNCTION public.fn_opportunity_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    UPDATE public.profiles
    SET opportunities_count = COALESCE(opportunities_count,0) + 1
    WHERE id = NEW.owner_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_opportunity_after_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.owner_id IS NOT NULL THEN
    UPDATE public.profiles
    SET opportunities_count = GREATEST(COALESCE(opportunities_count,0) - 1, 0)
    WHERE id = OLD.owner_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_opportunity_after_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- If owner changed, decrement old owner and increment new owner
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    IF OLD.owner_id IS NOT NULL THEN
      UPDATE public.profiles
      SET opportunities_count = GREATEST(COALESCE(opportunities_count,0) - 1, 0)
      WHERE id = OLD.owner_id;
    END IF;
    IF NEW.owner_id IS NOT NULL THEN
      UPDATE public.profiles
      SET opportunities_count = COALESCE(opportunities_count,0) + 1
      WHERE id = NEW.owner_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_opportunity_after_insert') THEN
    CREATE TRIGGER trg_opportunity_after_insert
    AFTER INSERT ON public.opportunities
    FOR EACH ROW EXECUTE PROCEDURE public.fn_opportunity_after_insert();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_opportunity_after_delete') THEN
    CREATE TRIGGER trg_opportunity_after_delete
    AFTER DELETE ON public.opportunities
    FOR EACH ROW EXECUTE PROCEDURE public.fn_opportunity_after_delete();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_opportunity_after_update') THEN
    CREATE TRIGGER trg_opportunity_after_update
    AFTER UPDATE ON public.opportunities
    FOR EACH ROW EXECUTE PROCEDURE public.fn_opportunity_after_update();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 2) Bookings counters (profiles.bookings_count) + notifications on booking create
CREATE OR REPLACE FUNCTION public.fn_booking_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Increment buyer counter
  IF NEW.buyer_id IS NOT NULL THEN
    UPDATE public.profiles
    SET bookings_count = COALESCE(bookings_count,0) + 1
    WHERE id = NEW.buyer_id;
  END IF;

  -- Optionally increment seller counter (if seller is a profile)
  IF NEW.seller_id IS NOT NULL THEN
    UPDATE public.profiles
    SET bookings_count = COALESCE(bookings_count,0) + 1
    WHERE id = NEW.seller_id;
  END IF;

  -- Create notifications for buyer and seller (if present)
  PERFORM
    CASE WHEN NEW.seller_id IS NOT NULL THEN
      (INSERT INTO public.notifications (id, user_id, type, data, created_at)
       VALUES (gen_random_uuid(), NEW.seller_id, 'booking_created', jsonb_build_object('booking_id', NEW.id, 'opportunity_id', NEW.opportunity_id, 'role', 'seller'), now()))
    END;

  PERFORM
    CASE WHEN NEW.buyer_id IS NOT NULL THEN
      (INSERT INTO public.notifications (id, user_id, type, data, created_at)
       VALUES (gen_random_uuid(), NEW.buyer_id, 'booking_created', jsonb_build_object('booking_id', NEW.id, 'opportunity_id', NEW.opportunity_id, 'role', 'buyer'), now()))
    END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_booking_after_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Decrement buyer counter
  IF OLD.buyer_id IS NOT NULL THEN
    UPDATE public.profiles
    SET bookings_count = GREATEST(COALESCE(bookings_count,0) - 1, 0)
    WHERE id = OLD.buyer_id;
  END IF;

  -- Decrement seller counter
  IF OLD.seller_id IS NOT NULL THEN
    UPDATE public.profiles
    SET bookings_count = GREATEST(COALESCE(bookings_count,0) - 1, 0)
    WHERE id = OLD.seller_id;
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_booking_after_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- If buyer/seller changed, adjust counters
  IF OLD.buyer_id IS DISTINCT FROM NEW.buyer_id THEN
    IF OLD.buyer_id IS NOT NULL THEN
      UPDATE public.profiles
      SET bookings_count = GREATEST(COALESCE(bookings_count,0) - 1, 0)
      WHERE id = OLD.buyer_id;
    END IF;
    IF NEW.buyer_id IS NOT NULL THEN
      UPDATE public.profiles
      SET bookings_count = COALESCE(bookings_count,0) + 1
      WHERE id = NEW.buyer_id;
    END IF;
  END IF;

  IF OLD.seller_id IS DISTINCT FROM NEW.seller_id THEN
    IF OLD.seller_id IS NOT NULL THEN
      UPDATE public.profiles
      SET bookings_count = GREATEST(COALESCE(bookings_count,0) - 1, 0)
      WHERE id = OLD.seller_id;
    END IF;
    IF NEW.seller_id IS NOT NULL THEN
      UPDATE public.profiles
      SET bookings_count = COALESCE(bookings_count,0) + 1
      WHERE id = NEW.seller_id;
    END IF;
  END IF;

  -- If booking status moved to confirmed/completed, create notification to parties
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'confirmed' THEN
      IF NEW.seller_id IS NOT NULL THEN
        INSERT INTO public.notifications (id, user_id, type, data, created_at)
        VALUES (gen_random_uuid(), NEW.seller_id, 'booking_confirmed', jsonb_build_object('booking_id', NEW.id), now());
      END IF;
      IF NEW.buyer_id IS NOT NULL THEN
        INSERT INTO public.notifications (id, user_id, type, data, created_at)
        VALUES (gen_random_uuid(), NEW.buyer_id, 'booking_confirmed', jsonb_build_object('booking_id', NEW.id), now());
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_booking_after_insert') THEN
    CREATE TRIGGER trg_booking_after_insert
    AFTER INSERT ON public.bookings
    FOR EACH ROW EXECUTE PROCEDURE public.fn_booking_after_insert();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_booking_after_delete') THEN
    CREATE TRIGGER trg_booking_after_delete
    AFTER DELETE ON public.bookings
    FOR EACH ROW EXECUTE PROCEDURE public.fn_booking_after_delete();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_booking_after_update') THEN
    CREATE TRIGGER trg_booking_after_update
    AFTER UPDATE ON public.bookings
    FOR EACH ROW EXECUTE PROCEDURE public.fn_booking_after_update();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 3) Reviews counters (profiles.reviews_count) for reviews targeting profiles
CREATE OR REPLACE FUNCTION public.fn_review_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.target_type = 'profile' AND NEW.target_id IS NOT NULL THEN
    UPDATE public.profiles
    SET reviews_count = COALESCE(reviews_count,0) + 1
    WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_review_after_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.target_type = 'profile' AND OLD.target_id IS NOT NULL THEN
    UPDATE public.profiles
    SET reviews_count = GREATEST(COALESCE(reviews_count,0) - 1, 0)
    WHERE id = OLD.target_id;
  END IF;
  RETURN OLD;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_review_after_insert') THEN
    CREATE TRIGGER trg_review_after_insert
    AFTER INSERT ON public.reviews
    FOR EACH ROW EXECUTE PROCEDURE public.fn_review_after_insert();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_review_after_delete') THEN
    CREATE TRIGGER trg_review_after_delete
    AFTER DELETE ON public.reviews
    FOR EACH ROW EXECUTE PROCEDURE public.fn_review_after_delete();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 4) Payments: notify on important status transitions (e.g., succeeded, refunded)
CREATE OR REPLACE FUNCTION public.fn_payment_after_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  booking_rec RECORD;
BEGIN
  -- Only act when status changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- get booking info
    SELECT * INTO booking_rec FROM public.bookings WHERE id = NEW.booking_id LIMIT 1;

    IF booking_rec IS NOT NULL THEN
      -- Notify buyer/seller on payment succeeded
      IF NEW.status = 'succeeded' THEN
        IF booking_rec.buyer_id IS NOT NULL THEN
          INSERT INTO public.notifications (id, user_id, type, data, created_at)
          VALUES (gen_random_uuid(), booking_rec.buyer_id, 'payment_succeeded', jsonb_build_object('payment_id', NEW.id, 'booking_id', booking_rec.id, 'amount_cents', NEW.amount_cents), now());
        END IF;
        IF booking_rec.seller_id IS NOT NULL THEN
          INSERT INTO public.notifications (id, user_id, type, data, created_at)
          VALUES (gen_random_uuid(), booking_rec.seller_id, 'payment_received', jsonb_build_object('payment_id', NEW.id, 'booking_id', booking_rec.id, 'amount_cents', NEW.amount_cents), now());
        END IF;
      ELSIF NEW.status = 'refunded' THEN
        -- Notify buyer about refund
        IF booking_rec.buyer_id IS NOT NULL THEN
          INSERT INTO public.notifications (id, user_id, type, data, created_at)
          VALUES (gen_random_uuid(), booking_rec.buyer_id, 'payment_refunded', jsonb_build_object('payment_id', NEW.id, 'booking_id', booking_rec.id, 'amount_cents', NEW.amount_cents), now());
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_after_update') THEN
    CREATE TRIGGER trg_payment_after_update
    AFTER UPDATE ON public.payments
    FOR EACH ROW EXECUTE PROCEDURE public.fn_payment_after_update();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5) Utility: notifications cleanup trigger example (optional placeholder)
-- (Left intentionally simple; real delivery (email/push) should be handled by off-db workers that poll notifications)

-- NOTES:
-- - These triggers assume gen_random_uuid() is available (pgcrypto extension). Ensure pgcrypto is enabled (created in schema).
-- - Service/webhook writes that should bypass RLS should use the Supabase service_role or SECURITY DEFINER functions.
-- - Test carefully in a staging DB before production.