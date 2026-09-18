-- Real, backend-persisted blog posts -- previously nothing existed at all (no blog route, no
-- posts table, no public pages). Built for genuine organic search traffic (product/coffee-related
-- content Google can actually index), distinct from Academy (paid courses) and the Source Library
-- (static, hand-authored origin pages).
CREATE TABLE IF NOT EXISTS blog_posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL UNIQUE, -- real, stable URL segment -- generated from title at
                                        -- creation, but stored (not recomputed at read time) so
                                        -- editing a title later never silently breaks an already-
                                        -- published, already-indexed, already-shared URL
  title          TEXT NOT NULL,
  excerpt        TEXT NOT NULL, -- a real, short summary -- used on the blog index page and as the
                                 -- real meta description / og:description for the post's own page
  cover_image_url TEXT,         -- real, absolute URL -- same real reasoning as the welcome
                                 -- email's own product photos: must work standalone (social
                                 -- shares, RSS-style consumption), not rely on the site's own
                                 -- relative-path convention
  content_html   TEXT NOT NULL, -- real, admin-authored rich text, sanitized server-side on write
                                 -- (see routes/blog.js) -- never trust stored HTML to be safe just
                                 -- because it was sanitized once on the way in from a different
                                 -- code path; this migration doesn't change how sanitization
                                 -- happens, just notes that this column holds real HTML, not
                                 -- plain text like the Academy chapters' own content column
  author_name    TEXT NOT NULL DEFAULT 'The Morning Aroma Team',
  status         TEXT NOT NULL DEFAULT 'Draft', -- 'Draft' | 'Published' -- a genuine draft/publish
                                                 -- workflow, since admin-authored long-form
                                                 -- content is realistically written over more than
                                                 -- one sitting, unlike a quick feedback/contact
                                                 -- submission
  published_at   TIMESTAMPTZ,   -- real, set only when status first becomes 'Published' (see
                                 -- routes/blog.js) -- distinct from created_at, which reflects
                                 -- when the draft was first started, not when it actually went
                                 -- live; the public blog index and sitemap both need the real,
                                 -- correct publish date, not an early draft timestamp
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts (status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts (slug);
