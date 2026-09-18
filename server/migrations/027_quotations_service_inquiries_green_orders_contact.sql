-- Real, backend-persisted quotations, service inquiries, and green coffee wholesale orders --
-- all three previously lived only in client-side React state (useState arrays in
-- src/context/index.jsx), meaning a real submission looked like it worked in the submitting
-- tab, but never reached anyone else, including the admin who'd need to actually act on it, and
-- vanished entirely on refresh. green_orders specifically was already flagged as a known,
-- documented gap in migrations/006_green_beans.sql's own comment from an earlier round -- this
-- finally closes it, alongside the other two found during a direct audit of this codebase.

-- Real, textual, human-facing IDs (Q-1000, SVC-1000, GB-1000) -- matching the exact real format
-- the fake frontend state already generated, since these numbers may already be visible to real
-- customers in a toast or a confirmation they've seen, and changing to a UUID here would be a
-- real, visible regression for no benefit. A real, monotonic sequence per table, not derived from
-- row count (which breaks once rows are ever deleted) -- see each table's own id default below.

CREATE SEQUENCE IF NOT EXISTS quotations_seq START 1000;
CREATE TABLE IF NOT EXISTS quotations (
  id              TEXT PRIMARY KEY DEFAULT ('Q-' || nextval('quotations_seq')),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  variety         TEXT NOT NULL, -- "Premium" | "Everyday" | "Not sure yet" -- free text on
                                  -- purpose, not a real FK to a product/tier -- this is a request
                                  -- for a quote, not an order against real, live catalog data
  quantity        TEXT,          -- free text ("40kg/month") -- deliberately not a real number +
                                  -- unit pair; a prospective wholesale buyer's own estimate, not
                                  -- something this app fulfills automatically
  message         TEXT,
  status          TEXT NOT NULL DEFAULT 'New', -- 'New' | 'Contacted' | 'Closed'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations (status);

CREATE SEQUENCE IF NOT EXISTS service_inquiries_seq START 1000;
CREATE TABLE IF NOT EXISTS service_inquiries (
  id              TEXT PRIMARY KEY DEFAULT ('SVC-' || nextval('service_inquiries_seq')),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  company         TEXT,
  interest        TEXT NOT NULL, -- "Remote Consulting" | "Kenyan Auction Representation" |
                                  -- "Both / not sure yet" -- matches Services.jsx's own real
                                  -- <select> options exactly
  message         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'New', -- 'New' | 'Discovery Call Booked' | 'In Progress' | 'Closed'
  agreed_fee_cents INTEGER,      -- real, admin-entered once a consulting fee is actually agreed --
                                  -- nullable, since most inquiries never reach that point, and
                                  -- there's no real, fixed price list this could be derived from
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_inquiries_status ON service_inquiries (status);

CREATE SEQUENCE IF NOT EXISTS green_orders_seq START 1000;
CREATE TABLE IF NOT EXISTS green_orders (
  id                          TEXT PRIMARY KEY DEFAULT ('GB-' || nextval('green_orders_seq')),
  name                        TEXT NOT NULL,
  email                       TEXT NOT NULL,
  company                     TEXT,
  message                     TEXT,
  bean_id                     TEXT NOT NULL REFERENCES green_beans (id),
  bean_name                   TEXT NOT NULL, -- real, denormalized snapshot of the bean's name AT
                                              -- ORDER TIME -- the same real reasoning
                                              -- orders.items already applies to retail products:
                                              -- an admin could rename or even remove a green lot
                                              -- later, and a real, historical order record should
                                              -- keep showing what the buyer actually ordered, not
                                              -- silently reflect today's catalog
  quantity_kg                 INTEGER NOT NULL,
  price_per_kg_cents_at_order INTEGER NOT NULL, -- real, server-computed AT THE TIME of the
                                                 -- request (see routes/greenOrders.js) -- never
                                                 -- trusts whatever price the client sent, the
                                                 -- exact same real reasoning routes/orders.js
                                                 -- already applies to retail checkout
  total_cents                 INTEGER NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'New', -- 'New' | 'Quoted' | 'Invoiced' | 'Shipped' | 'Fulfilled'
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Real, backend-persisted general contact messages ("Contact Us" -- ContactPage in
-- src/pages/Misc.jsx). Found during the same audit that surfaced quotations/service_inquiries/
-- green_orders: this form's own onSubmit never called any real API at all, just
-- setSent(true) -- every message anyone had ever sent through it was silently discarded the
-- instant the tab closed. Deliberately simpler than the other three tables this same migration
-- adds: a general "say hello" message has no real variety/interest/fee/multi-stage-status
-- workflow attached to it the way a wholesale quote or a consulting inquiry does -- just a real
-- inbox an admin can mark read.
CREATE SEQUENCE IF NOT EXISTS contact_messages_seq START 1000;
CREATE TABLE IF NOT EXISTS contact_messages (
  id          TEXT PRIMARY KEY DEFAULT ('MSG-' || nextval('contact_messages_seq')),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  message     TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contact_messages_read ON contact_messages (read);
