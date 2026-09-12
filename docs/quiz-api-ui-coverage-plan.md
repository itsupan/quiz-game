# Quiz API coverage plan

## Goal and scope

Extend the existing quiz persistence and JSON API so a client can build every quiz and
result layout in the supplied references. This phase is API-only: it does not restyle or
replace the learner Svelte pages.

The implementation must preserve the current guarantees:

- answer keys, explanations, transcripts, and review-only study aids never leak before
  completion;
- questions, options, media metadata, grouped stimuli, scoring rules, and rewards are
  frozen when an attempt starts;
- the server clock remains authoritative;
- answer, start, submit, and exit operations are idempotent and ownership-scoped;
- old `STANDARD` questions and existing API clients continue to work.

## Reference coverage audit

| Reference capability                                        | Current API                                                   | Required work                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| Question number, total, quiz mode, level, section, progress | Mostly covered                                                | Add display format and per-question navigation metadata             |
| Previous, next, and skip                                    | Covered by question GET and answer PUT with `null`            | Document the flow and return previous/next links                    |
| Exit/close session                                          | `ABANDONED` exists in the schema, but no API operation exists | Add an idempotent abandonment endpoint                              |
| Vocabulary meaning with a large term and reading            | Not representable separately from `stem`                      | Add a typed vocabulary presentation                                 |
| Kanji reading with a large focus word                       | Not representable separately from `stem`                      | Add a typed kanji-reading presentation                              |
| Grammar cloze, transliteration, concept review, and example | Not representable                                             | Add a typed grammar presentation and optional study-aid stimulus    |
| Reading passage shared by questions, optional translation   | Tables exist but are not served or frozen                     | Expose and snapshot question groups; gate study aids by quiz policy |
| Listening cover image, audio, custom player duration        | Basic per-question image/audio works                          | Support grouped listening stimuli and expose duration metadata      |
| Result accuracy, correct/incorrect counts, duration         | Covered or derivable                                          | Return normalized summary fields for consistent clients             |
| All/incorrect review with selected and correct answers      | Covered                                                       | Add presentation/stimulus data to review items                      |
| Retry quiz                                                  | Start endpoint already supports a new attempt                 | Add an explicit retry/start link to the result payload              |
| XP gained                                                   | Not covered                                                   | Add a frozen quiz reward and `xpAwarded` result field               |

The dashboard navigation, notification/settings icons, and visual artwork are outside this
API-only phase. Images used by a quiz remain R2 media assets returned through `/media`.

## Proposed domain model

### 1. Question formats

Add `QUESTION_FORMATS` to `src/lib/domain/enums.ts`:

- `STANDARD` — the current `stem + options + optional media` behavior;
- `VOCABULARY_MEANING` — a focus term with an optional reading;
- `KANJI_READING` — a focus kanji/word whose reading is selected;
- `GRAMMAR_CLOZE` — a sentence containing one explicit blank token;
- `READING_COMPREHENSION` — a prompt attached to a reading group;
- `LISTENING_COMPREHENSION` — a prompt attached to a listening group.

Add nullable question fields in `src/lib/server/db/schema/content.ts`:

- `format` (non-null, default `STANDARD`);
- `promptTranslation`;
- `focusText` and `focusReading`;
- `contextText` and `contextTransliteration`.

Keep `stem` as the primary question prompt. Do not encode these parts in one markdown or
HTML string: clients need semantic fields to produce the desktop split layouts, accessible
mobile ordering, and safe escaping.

### 2. Shared stimuli

Promote the existing `question_groups` table into the supported authoring model. Add a
`GROUP_FORMATS` enum with:

- `READING_PASSAGE`;
- `LISTENING_CLIP`;
- `CONCEPT_REVIEW`.

Retain the existing title, instruction, passage text, image, and audio fields. Add:

- `bodyTranslation` for an optional passage translation;
- `exampleText`, `exampleTransliteration`, and `exampleTranslation` for grammar review.

The API will call `passageText` the group's `body` so the public contract is not tied to a
legacy database column name. A group can be reused by multiple questions through the
existing `groupId` and `groupPosition` fields.

Validation must require group level and section to match every attached question. A
reading format requires a published `READING_PASSAGE` with non-empty body; listening
requires a published `LISTENING_CLIP` with audio and transcript; grammar may optionally
attach a `CONCEPT_REVIEW`.

### 3. Study-aid policy

Add `showStudyAidsDuringAttempt` to quizzes, defaulting to `false`, and freeze it on the
attempt. This lets a practice quiz expose passage translations, transliterations, or
concept review while mock/full-exam attempts withhold them. The completed result may
include the aids regardless of that flag.

This policy prevents an API client from receiving a translation that unintentionally
reveals an exam answer merely because the same content is reused by a practice quiz.

### 4. Media metadata

When an image or audio asset is frozen, also freeze the fields needed by a custom player:

- MIME type;
- audio duration in milliseconds;
- image dimensions when available;
- image alt text;
- transcript for result/review only.

The media bytes continue to be served by the authenticated range-capable `/media` route.

### 5. Result reward

Add `xpReward` to quizzes (non-negative, default `0`), snapshot it onto attempts, and set
`xpAwarded` exactly once during successful submission. An expired or abandoned attempt
earns `0` in the first version. This is enough for the referenced result UI without
introducing a user-wide progression ledger into the quiz API scope.

If XP later affects account totals, add a separate idempotent ledger keyed by attempt ID;
do not recompute historical awards from the live quiz row.

## Learner API contract

Keep the existing `/api/v1` paths and make the response additions backwards compatible.
The old `stem`, `image`, and `audio` fields remain during this version.

### Attempt question

`GET /api/v1/attempts/{attemptId}/questions/{questionNumber}` gains a discriminated
`presentation` object. Its shape is selected by `presentation.type`:

```json
{
	"type": "VOCABULARY_MEANING",
	"prompt": { "text": "What is the meaning of this word?", "translation": null },
	"focus": { "text": "勉強", "reading": "べんきょう" }
}
```

```json
{
	"type": "GRAMMAR_CLOZE",
	"prompt": { "text": "Choose the correct particle.", "translation": null },
	"context": { "text": "私は毎日 ___ 行きます。", "transliteration": "Watashi wa ..." },
	"studyAid": {
		"title": "Concept review",
		"body": "Particles indicate relationships between words.",
		"example": {
			"text": "私は学生です。",
			"transliteration": null,
			"translation": "I am a student."
		}
	}
}
```

Reading and listening variants return a `stimulus` containing the frozen group ID, title,
instruction, body or media, and only the study-aid fields permitted for the active quiz.
The transcript remains absent while an attempt is in progress.

The response also gains:

```json
{
	"progress": { "current": 4, "total": 10, "answered": 3 },
	"navigation": {
		"previous": "/api/v1/attempts/.../questions/3",
		"next": "/api/v1/attempts/.../questions/5"
	}
}
```

Either link is `null` at the boundary. `selectedOptionNumber` and the current `PUT` answer
contract remain unchanged. Skip is still an explicit `selectedOptionNumber: null` write,
so leaving a question blank is persisted rather than inferred.

### Abandonment

Add:

`PUT /api/v1/attempts/{attemptId}/abandonment`

- transitions only `IN_PROGRESS -> ABANDONED`;
- is idempotent when repeated;
- applies deadline settlement first;
- rejects cross-user access as 404;
- does not score, reveal an answer key, or grant XP;
- returns attempt status and a dashboard/catalog link.

Add this URL to the attempt's `links` object as `abandonment`. The UI can place its own
confirmation dialog in front of the call.

### Result

`GET /api/v1/attempts/{attemptId}/result` and submission responses gain:

- `summary.accuracyPercent`, `correctCount`, `incorrectCount`, `unansweredCount`, and
  `durationMs`;
- `reward.xpAwarded`;
- each review item's full typed `presentation`, including review-allowed translations,
  concept notes, transcript, and media metadata;
- `links.retry` pointing to the existing quiz attempts collection and `links.quiz`.

The existing selected/correct option numbers, option bodies, correctness, explanation,
raw/scaled scores, band scores, and pass state remain authoritative. “All” versus
“incorrect only” is a client-side filter over this returned question array and needs no
new endpoint.

## Admin API contract

### Question groups

Add authenticated admin endpoints:

- `GET/POST /api/v1/admin/question-groups`;
- `GET/PATCH /api/v1/admin/question-groups/{groupId}`;
- `PUT /api/v1/admin/question-groups/{groupId}/publication`.

They use media public IDs, return publication blockers, and follow the same problem+json,
pagination, audit, and archive conventions as the existing question endpoints.

### Questions

Extend question create/detail/patch payloads with:

- `format`, `promptTranslation`, `focusText`, `focusReading`;
- `contextText`, `contextTransliteration`;
- `groupId` and `groupPosition`.

Reject unknown properties as today. Publish blockers are format-aware and must check the
attached group's status, type, section, level, media accessibility metadata, and required
content. Question list filters gain optional `format` and `groupId` parameters.

Extend quiz create/detail/patch payloads with `showStudyAidsDuringAttempt` and `xpReward`.

## Attempt snapshot changes

Update `src/lib/features/quiz/attempts/start.server.ts` so fixed and random serving joins
the question group and its media. Freeze every presentation field and group stimulus used
by a served question into attempt-owned data. Do not render or score an attempt by joining
back to live questions, groups, options, quizzes, or media metadata.

Implementation preference:

1. add an `attempt_question_groups` snapshot table, unique by attempt and source group;
2. reference that snapshot from `attempt_questions`;
3. add the question-format/focus/context fields to `attempt_questions`;
4. snapshot study-aid policy and XP reward on `attempts`.

This avoids duplicating a long passage for every question and keeps all questions in a
group on one immutable stimulus. Standalone questions keep a null snapshot-group ID.

Existing attempts migrate to `STANDARD`, with null group presentation fields and zero XP.
Existing in-progress attempts must remain playable after deployment.

## Validation rules

- All formats retain at least two options and exactly one answer key.
- `VOCABULARY_MEANING`: non-empty `focusText`; reading optional.
- `KANJI_READING`: non-empty `focusText`.
- `GRAMMAR_CLOZE`: non-empty `contextText` containing exactly one documented `___` token.
- `READING_COMPREHENSION`: compatible published reading group with non-empty body.
- `LISTENING_COMPREHENSION`: compatible published listening group with audio; audio must
  have a transcript before publication.
- A group and its question must have identical level and section.
- Image alt text is required before publication; duration and dimensions, when supplied,
  must be positive.
- Study aids are withheld according to the frozen quiz policy, not a client query flag.
- XP values are non-negative integers and cannot be supplied by learner endpoints.

## Delivery sequence

The work is split into two sequential implementation packages to avoid overlapping edits
to the attempt engine while the content model is still changing:

1. **Package 1 — content foundation and admin API.** Domain enums, content/quiz schema,
   migration, question-group admin API, question/quiz admin extensions, validation, and
   authoring contract tests. The copy-ready external-agent brief is in
   `docs/claude-code-quiz-api-foundation-prompt.md`.
2. **Package 2 — attempt and learner API.** Attempt-owned group snapshots, learner
   presentation DTOs, study-aid withholding, media metadata, abandonment, XP finalization,
   result summaries, learner OpenAPI schemas, fixtures, and end-to-end proof. Start this
   only after Package 1 is integrated and its migration/tests pass.

### Phase 1 — Contract and migration

- Add enum/types and a generated migration for content, quiz, attempt, and snapshot data.
- Add schema and migration regression tests, including migration of existing rows.
- Add DTO contract tests first for every discriminated presentation variant and leakage
  boundary.

### Phase 2 — Admin authoring API

- Implement question-group service, validation, routes, publication, and audit records.
- Extend question and quiz create/patch/detail/list DTOs and validation.
- Update admin API tests for required fields, incompatible groups, media rules, and unknown
  properties.

### Phase 3 — Serving and immutable snapshots

- Extend fixed/random serving queries and snapshot writes.
- Load typed presentation data only from snapshots for active attempts and results.
- Add regression tests proving edits to live questions, groups, study-aid policy, media,
  reward, and options cannot change an existing attempt.

### Phase 4 — Learner API

- Extend attempt/question/result DTOs and links.
- Implement abandonment with deadline and concurrency handling.
- Update `docs/api/openapi.yaml` with complete `oneOf` schemas, examples, response fields,
  and the abandonment endpoint.
- Add HTTP tests for authentication, ownership, content type, validation, idempotency, and
  no-answer-key/no-transcript leakage.

### Phase 5 — Fixtures and end-to-end API proof

- Add deterministic fixtures for all six formats, including shared reading and listening
  groups and a practice quiz with study aids enabled.
- Exercise create -> load -> answer/skip -> submit -> review for every format.
- Exercise exit -> repeated exit and verify no result/XP is produced.
- Verify audio range requests and all media URLs.

## Quality gate and acceptance criteria

Run:

```sh
pnpm format:check
pnpm lint
pnpm check
pnpm test:unit --run
pnpm build
pnpm test:e2e
```

The API phase is complete when:

- every reference screen can be rendered without parsing presentation text or inventing
  missing data client-side;
- all six question formats can be authored, published, served, answered/skipped, and
  reviewed through documented APIs;
- reading/listening groups and their media are frozen per attempt;
- active responses contain no correctness, explanation, transcript, or disallowed study
  aid;
- exit, answer, start, and submit retries are safe;
- current `STANDARD` quizzes and existing consumers remain compatible;
- OpenAPI, migrations, fixtures, unit tests, HTTP tests, and E2E API journeys agree.
