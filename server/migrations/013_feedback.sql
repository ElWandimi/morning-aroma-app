-- Real, backend-persisted product feedback/reviews -- was purely local, in-memory React state
-- before this (see ROADMAP.md), meaning a submitted review disappeared on refresh, was never seen
-- by any other visitor, and the product page's own "aggregate rating" SEO structured data was
-- always empty for a fresh visitor since there was nothing real behind it.
--
-- Anonymous submission is intentional, not an oversight -- this matches the existing, established
-- UX (the "Leave Your Aroma" widget never asked for a name or login), and this migration doesn't
-- change that design decision, only makes the result of using it real and persistent.
CREATE TABLE IF NOT EXISTS feedback (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   TEXT REFERENCES products(id), -- nullable -- "general feedback" (not tied to any
                                               -- one variety) is a real, existing option in the
                                               -- submission form, not an edge case to design around
  rating       INTEGER NOT NULL,
  aroma        INTEGER NOT NULL,
  texture      INTEGER NOT NULL,
  tags         JSONB NOT NULL DEFAULT '[]'::jsonb,
  note         TEXT,
  reviewed     BOOLEAN NOT NULL DEFAULT false, -- a real moderation gate, not just a label --
                                                -- unreviewed feedback never appears on the public
                                                -- product page, only in the admin moderation queue
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_product_id ON feedback (product_id);
CREATE INDEX IF NOT EXISTS idx_feedback_reviewed ON feedback (reviewed);
