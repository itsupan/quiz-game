-- Local/development seed data. Idempotent, so it is safe to re-run.
-- Apply with: pnpm db:seed:local
INSERT INTO quizzes (id, title) VALUES
	(1, 'Capital cities'),
	(2, 'Periodic table')
ON CONFLICT(id) DO NOTHING;
