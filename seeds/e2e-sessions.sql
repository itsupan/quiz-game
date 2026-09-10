-- Sessions for the Playwright suite. LOCAL ONLY: applied by `pnpm db:seed:e2e`, which
-- passes --local, and never referenced by a deploy.
--
-- Each id is the SHA-256 of the matching token in e2e/sessions.ts, which is exactly what
-- src/lib/server/auth/session.ts stores. The tests hold the token; the database holds only
-- the hash — the same property that makes a leaked production dump useless.
--
-- user 1 is the seeded administrator and user 2 the seeded learner, from dev.sql.

INSERT INTO sessions (id, user_id, expires_at) VALUES
	('d37c84ca4647e3a81f5650c75353af4aa21cf15ce37ce955bc13634fa548281b', 1, unixepoch() + 2592000),
	('fafc837f972ce707e556dd899b62563d86f87394352cdb6a8701680b3eebc0c8', 2, unixepoch() + 2592000),
	-- Deleted by the sign-out test, so it is re-created on every run rather than shared.
	('be5e8b0b72b4214e804b191fb2f390cbc82717638bc6f998f416a668e04b4235', 1, unixepoch() + 2592000)
ON CONFLICT(id) DO UPDATE SET expires_at = excluded.expires_at;
