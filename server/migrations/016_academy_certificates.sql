-- Real, verifiable certificates -- issued once a real completion condition is met (every chapter
-- in the course that actually has a quiz has been passed by that user), checked server-side at
-- issue time, never trusted from the client. A verification_code is the whole point of this
-- being a real record rather than just a PDF anyone could edit: anyone holding the code (printed
-- on the certificate itself) can confirm it's genuine via the public verify endpoint, independent
-- of the PDF file itself.

CREATE TABLE IF NOT EXISTS certificates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id),
  course_id           TEXT NOT NULL REFERENCES courses(id),
  verification_code   TEXT NOT NULL UNIQUE,
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id) -- one certificate per person per course -- re-requesting returns
                               -- the existing one rather than issuing a second
);

CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON certificates (user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_verification_code ON certificates (verification_code);
