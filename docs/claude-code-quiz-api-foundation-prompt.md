# Claude Code prompt — Quiz API package 1 of 2

Copy everything below into Claude Code.

---

You are implementing package 1 of 2 for the QuizGame API in
`/home/blaze/japan/quiz-game`.

Read and obey the repository `AGENTS.md` instructions supplied by the environment. Read
`docs/quiz-api-ui-coverage-plan.md` completely before editing. This package builds the
domain, persistence, migrations, and admin authoring API foundation. A second package will
later implement attempt snapshots and learner-facing attempt/result DTOs.

## Required outcome

Implement the content-authoring half needed to represent these quiz styles through the
API:

1. standard multiple choice;
2. vocabulary meaning with a focus term and optional reading;
3. kanji reading with a focus term;
4. grammar cloze with sentence/transliteration and optional concept review;
5. reading comprehension with a shared passage and optional translation;
6. listening comprehension with shared audio and optional cover image.

Do not implement or restyle learner Svelte quiz screens.

## Scope

### Domain enums

In `src/lib/domain/enums.ts`, add and export:

- `QUESTION_FORMATS` and `QuestionFormat`:
  - `STANDARD`
  - `VOCABULARY_MEANING`
  - `KANJI_READING`
  - `GRAMMAR_CLOZE`
  - `READING_COMPREHENSION`
  - `LISTENING_COMPREHENSION`
- `GROUP_FORMATS` and `GroupFormat`:
  - `READING_PASSAGE`
  - `LISTENING_CLIP`
  - `CONCEPT_REVIEW`

Follow the existing enum pattern: Drizzle typing plus SQLite check constraints.

### Content schema and migration

Extend `questions` with:

- `format`, non-null and defaulting to `STANDARD`;
- nullable `promptTranslation`;
- nullable `focusText` and `focusReading`;
- nullable `contextText` and `contextTransliteration`.

Extend `question_groups` with:

- `format`, typed by `GROUP_FORMATS`;
- nullable `bodyTranslation`;
- nullable `exampleText`;
- nullable `exampleTransliteration`;
- nullable `exampleTranslation`.

Keep the existing `passageText` database/application field. The public API may expose it
as `body`. Do not perform a destructive rename.

Extend `quizzes` with:

- `showStudyAidsDuringAttempt`, non-null boolean, default `false`;
- `xpReward`, non-null integer, default `0`, with a database check preventing negatives.

Generate and commit the next Drizzle SQL migration and metadata. Existing questions must
migrate as `STANDARD`; existing quizzes must migrate with hidden study aids and zero XP.
Do not modify old migration files.

Do not add attempt snapshot columns or tables in this package; package 2 owns those.

### Question-group admin API

Add a focused feature module under `src/lib/features/questions/` and admin routes for:

- `GET/POST /api/v1/admin/question-groups`;
- `GET/PATCH /api/v1/admin/question-groups/{groupId}`;
- `PUT /api/v1/admin/question-groups/{groupId}/publication`.

Follow the conventions used by the existing admin question API:

- admin authentication and same-origin protections already supplied by hooks/routes;
- public ULIDs in HTTP payloads, never internal numeric IDs;
- problem+json errors and strict rejection of unknown body fields;
- pagination and filters for level, section, status, and group format;
- media references by public ID;
- audit records for create creation/update/publication/archive actions;
- content is archived, not deleted.

Publication blockers must validate:

- reading groups have non-empty `passageText`;
- listening groups have an audio asset with a non-empty transcript;
- concept-review groups have non-empty explanatory content and a usable example;
- attached images have non-empty alt text;
- media exists and matches its declared image/audio slot.

Use intentional 400/404/409/415/422 responses matching current API behavior.

### Existing question admin API

Extend question create, detail, patch, list, validation, storage, and DTO code to support:

- `format`;
- `promptTranslation`;
- `focusText` and `focusReading`;
- `contextText` and `contextTransliteration`;
- `groupId` as a public group ULID or `null`;
- `groupPosition` as a positive integer or `null`.

Add optional question-list filters for `format` and `groupId`.

Format-aware validation and publication blockers:

- `STANDARD`: retains current behavior;
- `VOCABULARY_MEANING`: requires non-empty `focusText`;
- `KANJI_READING`: requires non-empty `focusText`;
- `GRAMMAR_CLOZE`: requires non-empty `contextText` containing exactly one `___` token;
- `READING_COMPREHENSION`: requires a compatible `READING_PASSAGE` group;
- `LISTENING_COMPREHENSION`: requires a compatible `LISTENING_CLIP` group;
- attached group level and section must equal the question level and section;
- a grammar question may optionally attach a compatible `CONCEPT_REVIEW` group;
- all formats keep the current option-count and exactly-one-answer-key rules.

Patch semantics must distinguish omitted fields from explicit `null`. An update must not
silently detach a group or erase presentation fields when they are omitted.

Do not expose internal option IDs or weaken the existing answer-key protections.

### Existing quiz admin API

Extend quiz create/detail/patch/list payloads and validation with:

- `showStudyAidsDuringAttempt`;
- `xpReward`.

`xpReward` must be a non-negative integer. Learner endpoints must never accept either
field as input.

### OpenAPI

Document all admin additions in the appropriate API documentation. If the existing
`docs/api/openapi.yaml` intentionally contains only learner endpoints, create a separate
`docs/api/admin-openapi.yaml` only if that is consistent with current repository patterns;
otherwise extend the existing document with admin tags and schemas. Do not document
package-2 learner presentation/result fields yet.

## Explicitly out of scope

Do not implement:

- learner attempt-question `presentation` DTOs;
- `attempt_question_groups` snapshots or any other attempt snapshot schema;
- attempt abandonment;
- XP awarding/finalization;
- learner result summary changes;
- learner UI or admin Svelte UI;
- cumulative user XP or a progression ledger.

The second package owns those areas. Leave a clear handoff describing the new exported
types/services and migration columns it should use.

## Tests required

Add or update flat tests under `tests/unit/` for:

- enum and database check constraints;
- migration correctness and defaults for existing rows;
- group create/detail/patch/list/publication/archive HTTP behavior;
- strict unknown-field validation;
- media kind, transcript, and alt-text blockers;
- every question format's valid and invalid create/patch/publication cases;
- group ULID resolution, level/section/type mismatch, and omitted-versus-null patch cases;
- quiz study-aid/XP fields and negative XP rejection;
- proof that admin detail can return answer keys while no learner endpoint changes or
  leaks are introduced.

Every test must assert behavior and use deterministic local data.

## Quality gate

Run and fix all failures from:

```sh
pnpm format:check
pnpm lint
pnpm check
pnpm test:unit --run
pnpm build
```

Run relevant Playwright tests if any existing HTTP/admin journey is affected. Do not skip
or weaken tests or lint rules.

## Handoff response

When complete, report:

1. schema and migration added;
2. routes and API contracts added or changed;
3. validation decisions and compatibility behavior;
4. tests and exact commands run;
5. any remaining blocker for package 2;
6. a concise list of files changed.

Do not commit unless explicitly asked. Preserve unrelated existing working-tree changes.
