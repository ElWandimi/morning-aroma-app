-- Real, backend-persisted newsletter subscriber capture. The footer's newsletter signup
-- previously had nowhere real to submit to -- no endpoint, no table, no admin view -- so a
-- working form here would have quietly discarded every email address typed into it. This gives
-- it the same real persistence every other capture feature on this site already has (feedback,
-- quotations, service inquiries).
--
-- Anonymous by design, same reasoning as feedback's own migration -- an email address plus
-- optional name is all this needs; nothing here requires an account.
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL,
  name         TEXT,
  source       TEXT NOT NULL DEFAULT 'footer', -- where the signup happened, for the admin view --
                                                 -- only 'footer' exists today, but a second signup
                                                 -- surface (e.g. checkout) shouldn't need a schema
                                                 -- change to be told apart from this one
  unsubscribed BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One real subscription per email address -- resubmitting the same email (e.g. someone signs up
-- twice by mistake) updates the existing row rather than creating a duplicate, handled in the
-- route itself via ON CONFLICT, which this unique index is what makes possible.
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON newsletter_subscribers (lower(email));
