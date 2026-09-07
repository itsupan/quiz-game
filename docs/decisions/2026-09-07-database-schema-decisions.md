# Database schema decisions — 2026-09-07

Decisions taken in the schema design session for the Japanese QuizGame, recorded for
team review. Ten decisions, each with what was chosen, what was turned down, why it
matters in the schema, and what changing it later would cost.

Companion documents:

- Full table-by-table design: `docs/superpowers/specs/2026-09-07-quiz-game-database-schema-design.md`
- Implementation plan: `~/.claude/plans/design-the-d1-drizzle-database-quizzical-newt.md`

**Status:** implemented and code-reviewed. Schema, migration `0001_schema.sql`, seeds
and tests are in the repository. Two open items: decision 5, and the destructive drop
noted under Post-review corrections.

---

## Summary table

| #   | Question                             | Chosen                                       | Rejected                                      |
| --- | ------------------------------------ | -------------------------------------------- | --------------------------------------------- |
| 1   | How does a quiz get its questions?   | Both, per quiz (`FIXED` \| `RANDOM`)         | Fixed-list only; random-draw only             |
| 2   | What is a homepage "category"?       | JLPT level + section                         | Free-form tags; one generic category table    |
| 3   | Model shared passages / audio clips? | Yes — question groups                        | Standalone questions only                     |
| 4   | Who appears on the leaderboard?      | Best attempt per user per quiz, all modes    | Exams only; every completed attempt           |
| 5   | How is score calculated?             | JLPT scaled scoring                          | One point per question; weighted raw points   |
| 6   | When do answers reach the server?    | Every answer, immediately                    | On submit; checkpoint on navigation           |
| 7   | Can a signed-out visitor play?       | Yes, results not saved                       | Sign-in required                              |
| 8   | Deleting referenced content?         | Archive, never hard-delete                   | Hard delete + snapshot; hard delete + cascade |
| 9   | Primary key style?                   | Integer PKs inside, ULID `public_id` outside | Integers everywhere; ULIDs everywhere         |
| 10  | Sections vs. JLPT scoring bands?     | Separate `quiz_scoring_bands` table          | Approximate on sections; drop scaled scoring  |

---

## 1. A quiz can use a fixed list _or_ a random draw

**Chosen:** both, selected per quiz via `quizzes.selection_mode` (`FIXED` | `RANDOM`).
`FULL_EXAM` and `MOCK_TEST` pin an explicit ordered list; `JLPT_PRACTICE` draws N
questions from a shared bank at attempt start.

**Rejected:** fixed lists only (no endless practice); random draws only (two learners
get different questions, so ranking them against each other is unsound).

**Consequence in the schema.** Two tables instead of one: `quiz_questions` holds the
fixed list, and `attempt_questions` records what a given attempt was actually served.
The snapshot is not optional — with a random draw the server cannot score an attempt
unless it remembers which questions it handed out, in what order, worth how many points.

**Cost to revisit.** Low. Dropping random mode means `attempt_questions` becomes
redundant but harmless. Adding a third selection strategy (adaptive difficulty, say) is
a new `selection_mode` value plus draw logic — no table changes.

---

## 2. "Category" means JLPT level and section

**Chosen:** the homepage filters on JLPT level and section. `quizzes.level` accepts
N5–N1; N4 and N3 are the levels with content today. Sections are `VOCAB_KANJI`,
`GRAMMAR_READING`, `LISTENING`.

**Rejected:** a free-form tags table (travel, business, food) alongside level; a single
generic `categories` table holding levels and topics alike.

**Consequence in the schema.** No taxonomy tables at all. Level is a checked column on
`quizzes`; section filtering joins `quiz_sections`. The level column allows all five
JLPT levels from day one, so publishing N2 content later is a data change, not a
migration.

**Cost to revisit.** Moderate. Adding topical tags later means two new tables
(`categories`, `quiz_categories`) and a filter UI, but nothing existing has to change —
the level and section filters keep working alongside.

---

## 3. Shared passages and audio clips are modelled

**Chosen:** a `question_groups` table holds one stimulus — a reading passage, an audio
clip — that several questions hang off.

**Rejected:** every question standalone, carrying its own text, image and audio, with
admins pasting a shared passage once per question.

**Consequence in the schema.** `questions.group_id` is nullable, so standalone questions
stay simple and grouped ones cost nothing extra. A 400-character reading passage is
stored once. This is what makes a mock or full exam read like a real JLPT paper rather
than a list of disconnected items.

**Cost to revisit.** High if deferred, low as built. Retrofitting grouping onto live
content means a migration plus de-duplicating passages that admins had already pasted
several times. Building it now costs one table.

---

## 4. The leaderboard shows each user's best attempt

**Chosen:** one row per user per quiz — their best result. Ranked by score descending,
then shortest duration, then earliest completion. All three modes are eligible.

**Rejected:** restricting eligibility to `MOCK_TEST` and `FULL_EXAM`; ranking every
completed attempt separately.

**Consequence in the schema.** No leaderboard table. Ranking is computed live from
`attempts` with `ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY raw_score DESC,
duration_ms ASC, submitted_at ASC)` filtered to `= 1`, backed by a partial index whose
column order _is_ the tie-breaker chain. "The leaderboard updates after a completed
attempt" is then automatically true — there is no sync step that can drift.

Ranking sorts on raw score, which is always present and comparable because a board is
always scoped to one quiz. Scaled score is displayed, not sorted on.

**Cost to revisit.** Low. If the live query ever measures slow, the escape hatch is a
materialised `leaderboard_entries` table keyed `(quiz_id, user_id, period)`, written on
submit. Noted, deliberately not built.

---

## 5. JLPT scaled scoring — **open item**

**Chosen:** model the real exam. Sections carry scaled bands and pass marks, and an
attempt yields a scaled total plus per-section pass/fail.

**Rejected:** one point per correct answer; weighted raw points with no scaling.

**Consequence in the schema.** `scaled_max` and `pass_mark` live per row in
`quiz_scoring_bands` — see decision 10, which was taken during implementation once it
became clear sections and bands are not the same thing. An N3 quiz gets three bands at
60 each; an N4 quiz gets two, at 120 and 60. Both reach 180, and the scorer needs no
level-specific branching. Scaled results land in `attempt_band_scores`; raw per-section
feedback stays in `attempt_section_scores`.

> **Open item — resolve before seeding.** Official JLPT scaling is item-response-theory
> based and unpublished, so no implementation can reproduce it. The section bands and
> pass marks above need confirming against the official JLPT site, and what we ship is a
> linear approximation (`round(raw / raw_max * scaled_max)`).
>
> **This must be labelled as an estimate in the UI.** Presenting an approximated score
> as an official JLPT result would mislead learners about their exam readiness, which is
> the one thing this app exists to help them judge.

**Cost to revisit.** Low to change the numbers (they are data), higher to abandon
scaling entirely — `quiz_scoring_bands`, `attempt_band_scores` and three columns on
`attempts` would become dead weight, though raw scoring keeps working underneath either
way.

---

## 6. Every answer is saved the moment it is chosen

**Chosen:** each answer upserts to the server as the learner picks it.

**Rejected:** buffering answers in the browser until submit; flushing in batches when the
learner moves between questions.

> **This reverses an earlier choice made in the same session.** "Save only on submit" was
> selected first, then changed once it was clear it contradicted two acceptance criteria
> already written into the epics: _"timer expiry safely saves the learner's answers and
> produces a result"_ and _"a time-limited session is submitted automatically when its
> timer reaches zero."_ Answers held only in the browser satisfy neither — a closed tab
> during a 170-minute `FULL_EXAM` loses the whole sitting, and the server cannot score an
> expired attempt it never received.

**Consequence in the schema.** A unique constraint on `(attempt_id,
attempt_question_id)` in `attempt_answers` makes each save an idempotent upsert — a
learner changing their mind updates the row rather than appending a second one. Combined
with a server-computed `attempts.expires_at`, an abandoned or expired attempt is always
scorable from what was received.

`is_correct` and `points_earned` stay null until scoring, so there is exactly one place
in the codebase that decides whether an answer was right.

**Cost to revisit.** Very low, in either direction. The table shape is identical for all
three options; only write timing differs. Batching later is a client change alone.

---

## 7. Signed-out visitors can play

**Chosen:** guests can take a quiz and see their score. Results are not saved.

**Rejected:** requiring Google sign-in before a quiz can start.

**Consequence in the schema.** `attempts.user_id` is nullable, and a guest is simply
`user_id IS NULL` — no separate flag that could disagree with it. Guests are excluded
from the leaderboard by the partial index rather than by a query filter someone can
forget, and a scheduled purge clears guest rows on `(status, started_at) WHERE user_id
IS NULL`.

The homepage CTA can then say "start a quiz" and mean it, with signing in framed as
"keep your history" rather than a wall before anyone has seen the product.

**Cost to revisit.** Low. Requiring sign-in later is a route guard plus making the
column `NOT NULL` once guest rows are purged.

---

## 8. Content is archived, never hard-deleted

**Chosen:** admin "delete" sets `status = ARCHIVED`. Foreign keys use `ON DELETE
RESTRICT`. Archived content is hidden from the homepage and cannot be added to new
quizzes.

**Rejected:** hard deletion with a frozen JSON copy of the stem and options on every
attempt row; hard deletion with cascade.

**Consequence in the schema.** Past attempts and their review pages keep working
indefinitely, with no duplicated content on every attempt row. Admins still get the
confirmation dialog the epic asks for — it just archives rather than destroys.

**Known trade-off, accepted:** because attempts reference the live question rather than a
snapshot of it, an admin editing a published question changes how an old attempt reads
back on the review page. The mitigation is process, not schema — treat a published
question as immutable and create a new one instead of rewriting its meaning. If that
proves unrealistic, question versioning is the fix.

**Cost to revisit.** Moderate. Adding snapshots later protects new attempts only; history
already taken cannot be reconstructed.

---

## 9. Integer primary keys inside, ULIDs in URLs

**Chosen:** integer autoincrement `id` for joins, plus a unique 26-character ULID
`public_id` on the tables that appear in URLs — `users`, `quizzes`, `questions`,
`attempts`, `media_assets`.

**Rejected:** integer autoincrement everywhere (the current placeholder's style); ULIDs
as the primary key everywhere.

**Consequence in the schema.** Joins and indexes stay compact on SQLite's native rowid,
while nothing public is enumerable — nobody can walk `/quiz/1`, `/quiz/2` to count the
catalogue, and a leaked attempt URL reveals nothing about total volume. ULIDs sort by
creation time, so they index well as a secondary key.

**Cost of the choice:** two identifiers per row on those five tables, and remembering
which one a given query wants. Internal code takes `id`; anything crossing the network
boundary takes `public_id`.

**Cost to revisit.** Low to add `public_id` to another table; high to remove it once URLs
are public and shared.

---

## 10. Content sections and JLPT scoring bands are separate tables

**Taken during implementation**, after decisions 1–9, when seeding an N4 quiz exposed a
contradiction: the spec claimed "N4 gets two sections at 120 and 60", but the section
enum from the epic only has `VOCAB_KANJI`, `GRAMMAR_READING` and `LISTENING`. Neither
level maps onto those three cleanly — `GRAMMAR_READING` straddles two of N3's bands.

**Chosen:** a `quiz_scoring_bands` table (`code`, `label`, `scaled_max`, `pass_mark`),
with `quiz_sections.scoring_band_id` pointing at it. Scaled results move to
`attempt_band_scores`; `attempt_section_scores` keeps raw per-section numbers as study
feedback.

**Rejected:** approximating with three 60-point sections at every level, which would make
an N4 result disagree with the one number a learner would check it against; and dropping
scaled scoring altogether.

**Consequence in the schema.** Seventeen tables rather than fifteen. Sections stay the
content taxonomy the homepage filters on and questions are tagged with; bands are how a
score is reported. An N4 quiz can keep separate vocabulary and grammar sections while
both feed one 0–120 band — exactly how the real paper works.

**Cost to revisit.** Low. The band tables are additive; nothing else in the schema
depends on how many bands a quiz declares.

---

## Post-review corrections

A code review after implementation found four integrity defects, each reproduced against
a real database before and after the fix. None changed a decision above; all four were
the decisions being enforced less completely than the text claimed.

| Defect                                                                                                                                                                                                                                    | Fix                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attempt_answers` unique on `(attempt_id, attempt_question_id)` allowed **two answers for one served question** — a served question already belongs to one attempt, so adding `attempt_id` widened the constraint instead of narrowing it | Unique on `attempt_question_id` alone                                                                                                                |
| An answer could cite an option belonging to a **different question**, so a client posting any option id could be scored against an unrelated answer key                                                                                   | `question_id` denormalised onto `attempt_answers` plus composite FKs to `attempt_questions(id, question_id)` and `question_options(id, question_id)` |
| A quiz could attach a question to **another quiz's section**                                                                                                                                                                              | Composite FK `(quiz_id, quiz_section_id) → quiz_sections(quiz_id, id)`                                                                               |
| A section could point at **another quiz's scoring band**, producing a scaled total above the quiz's own maximum                                                                                                                           | Composite FK `(quiz_id, scoring_band_id) → quiz_scoring_bands(quiz_id, id)`                                                                          |

Also corrected: six seeded `public_id` values contained `I`, `L`, `O` and `U`, which the
Crockford alphabet excludes and `ids.spec.ts` rejects; the homepage was serialising the
internal integer `id` that `public_id` exists to hide; `publicId()` did not wire
`newPublicId`, leaving the generator dead code; foreign-key child columns had no indexes,
making every `RESTRICT` check a full scan; and `docs/` was in `.gitignore`, so this file
and the design spec — both cited from committed source — would not have reached the repo.

### Still open

`migrations/0001_schema.sql` **drops the `0000_init` placeholder `quizzes` table**. Its
rows cannot be carried forward: the new table requires `mode` and `level`, which the
placeholder never had, so no data-preserving path exists. Confirm the target database
holds no real quizzes before `db:migrate:staging` or `db:migrate:production` — a D1
migration applies once and cannot be rolled back.

---

## Rules that live in code, not in constraints

Recorded here so they are not lost when someone reads only the schema:

- **Final-admin guard** — refuse any role change that would leave zero active admins, and
  refuse self-demotion.
- **At least one correct option** — the database enforces _at most_ one, via a partial
  unique index on `question_options (question_id) WHERE is_correct = 1`. "At least one"
  is an application check at publish time.
- **Suspended users cannot start an attempt.**
- **Answer keys never leave the server** — `question_options.is_correct` is only ever
  selected inside `$lib/server/**`; the quiz page projects `{ id, body, position }` only.
- **Image alt text is required** before an image asset can be attached to a published
  question.
