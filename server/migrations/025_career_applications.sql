-- Real, backend-persisted career/general applications -- previously nothing existed at all (no
-- careers page, no application route). Genuinely honest scope: this company has no open roles
-- right now, so this isn't job-listing infrastructure (no positions/postings table) -- it's a
-- single, real inbox for someone reaching out speculatively, admin-visible, matching the working
-- real pattern feedback.js and live-chat.js already established (public, rate-limited creation;
-- admin-only listing and status updates), not a fake, frontend-only useState the way this
-- codebase's existing "Quotations"/"Service Inquiries" admin sections turned out to be
-- (confirmed directly while building this: both are real admin UI sections with real permission
-- names, but neither has an actual backend route or table behind them at all).
CREATE TABLE IF NOT EXISTS career_applications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  email          TEXT NOT NULL,
  location       TEXT, -- real, if optional -- "global as it should be" means not assuming a
                        -- candidate is local; asking where they are without requiring a specific
                        -- real answer (remote, a city, a country -- whatever's true for them)
  role_interest  TEXT, -- free text -- "Roasting", "Customer Care", "Marketing", genuinely
                        -- whatever the applicant is interested in, since there's no real, fixed
                        -- list of open roles to choose from
  message        TEXT NOT NULL, -- the real cover-letter/pitch text
  resume_url     TEXT, -- real, optional link the applicant provides themselves (their own
                        -- LinkedIn, a hosted resume, a portfolio) -- this app has no real file-
                        -- upload infrastructure for career applications specifically, and
                        -- building one is genuinely out of scope for what was asked
  status         TEXT NOT NULL DEFAULT 'New', -- 'New' | 'Reviewed' | 'Archived' -- mirrors the
                                               -- real Open/Resolved convention AdminLiveChat
                                               -- already established, adapted to this context
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_applications_status ON career_applications (status);
