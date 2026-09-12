-- Local/development seed data. Idempotent, so it is safe to re-run.
-- Apply with: pnpm db:seed:local
--
-- Every public_id here is valid Crockford base32 (no I, L, O or U), matching the
-- alphabet src/lib/server/db/ids.ts generates and ids.spec.ts asserts.
--
-- Covers every structural shape the schema supports, so a fresh clone can exercise
-- all of it without an admin UI:
--   quiz 1  N4 FULL_EXAM      FIXED   2 scoring bands (120 + 60), 3 sections, has media
--   quiz 2  N3 MOCK_TEST      FIXED   3 scoring bands (60 each), 3 sections
--   quiz 3  N3 JLPT_PRACTICE  RANDOM  no bands, draws 5 from the bank
--   quiz 4  N5 JLPT_PRACTICE  FIXED   3 second first section, 8 second quiz clock
--
-- The questions linked to those published quizzes also cover every learner-facing
-- presentation: STANDARD, VOCABULARY_MEANING, KANJI_READING, GRAMMAR_CLOZE,
-- READING_COMPREHENSION and LISTENING_COMPREHENSION. Their shared stimuli cover every
-- group format: READING_PASSAGE, LISTENING_CLIP and CONCEPT_REVIEW.
--
-- Scaled bands and pass marks are a LINEAR APPROXIMATION of JLPT scoring, which is
-- item-response-theory based and unpublished. Confirm against the official site
-- before showing any of it to a learner as an exam-readiness figure.

INSERT INTO users (id, public_id, email, display_name, jlpt_level, role, status) VALUES
	(1, '01JSEEDACCTADMN00000000000', 'admin@example.com', '管理者テスト', NULL, 'ADMIN', 'ACTIVE'),
	(2, '01JSEEDACCTSTDNT0000000000', 'learner@example.com', '学習者テスト', 'N4', 'USER', 'ACTIVE')
ON CONFLICT(id) DO NOTHING;

-- Keep a database seeded before learner levels existed useful for the level filter.
UPDATE users SET jlpt_level = 'N4' WHERE id = 2 AND role = 'USER';

-- The bytes these rows describe live in R2, not here — `pnpm db:seed:media` puts
-- seeds/fixtures/sample-image.png and sample-audio.mp3 at these exact keys in the local
-- bucket. Without that step the rows exist but `/media/[publicId]` 404s them, the same
-- as a half-completed delete.
INSERT INTO media_assets
	(id, public_id, kind, r2_key, mime_type, byte_size, alt_text, transcript, original_filename, uploaded_by)
VALUES
	(1, '01JSEEDASSETPNG00000000000', 'IMAGE', '01JSEEDASSETPNG00000000000.png', 'image/png', 74,
		'赤い正方形のサンプル画像。', NULL, 'sample-image.png', 1),
	(2, '01JSEEDASSETMP300000000000', 'AUDIO', '01JSEEDASSETMP300000000000.mp3', 'audio/mpeg', 4510,
		NULL, '（音声）男の人と女の人が話しています。「では、これで会議を終わります。」',
		'sample-audio.mp3', 1)
ON CONFLICT(id) DO NOTHING;

INSERT INTO quizzes (id, public_id, title, description, mode, level, selection_mode, time_limit_seconds, scaled_total_max, pass_mark_total, status, created_by, published_at) VALUES
	(1, '01JSEEDQZN4EXAM00000000000', 'JLPT N4 模擬本試験', '本試験と同じ構成の N4 フルテストです。', 'FULL_EXAM', 'N4', 'FIXED', 6900, 180, 90, 'PUBLISHED', 1, unixepoch()),
	(2, '01JSEEDQZN3MCK000000000000', 'JLPT N3 模擬試験', 'N3 の三区分で採点される模擬試験です。', 'MOCK_TEST', 'N3', 'FIXED', 8400, 180, 95, 'PUBLISHED', 1, unixepoch()),
	(3, '01JSEEDQZN3PRAC00000000000', 'N3 語彙ドリル', '語彙・漢字からランダムに 5 問出題します。', 'JLPT_PRACTICE', 'N3', 'RANDOM', 600, NULL, NULL, 'PUBLISHED', 1, unixepoch())
ON CONFLICT(id) DO NOTHING;

-- N4 combines language knowledge and reading into one 0-120 band; N3 reports three.
INSERT INTO quiz_scoring_bands (id, quiz_id, code, label, position, scaled_max, pass_mark) VALUES
	(1, 1, 'LANGUAGE_KNOWLEDGE_READING', '言語知識（文字・語彙・文法）・読解', 1, 120, 38),
	(2, 1, 'LISTENING', '聴解', 2, 60, 19),
	(3, 2, 'LANGUAGE_KNOWLEDGE', '言語知識（文字・語彙・文法）', 1, 60, 19),
	(4, 2, 'READING', '読解', 2, 60, 19),
	(5, 2, 'LISTENING', '聴解', 3, 60, 19)
ON CONFLICT(id) DO NOTHING;

-- Quiz 1 has three sections feeding only two bands: that split is the whole point of
-- keeping sections and bands in separate tables.
INSERT INTO quiz_sections (id, quiz_id, section, position, time_limit_seconds, draw_count, scoring_band_id) VALUES
	(1, 1, 'VOCAB_KANJI',     1, 1500, NULL, 1),
	(2, 1, 'GRAMMAR_READING', 2, 3300, NULL, 1),
	(3, 1, 'LISTENING',       3, 2100, NULL, 2),
	(4, 2, 'VOCAB_KANJI',     1, 1800, NULL, 3),
	(5, 2, 'GRAMMAR_READING', 2, 4200, NULL, 4),
	(6, 2, 'LISTENING',       3, 2400, NULL, 5),
	(7, 3, 'VOCAB_KANJI',     1, NULL, 5, NULL)
ON CONFLICT(id) DO NOTHING;

INSERT INTO question_groups
	(id, public_id, level, section, format, title, passage_text, body_translation, instruction,
	 example_text, example_transliteration, example_translation, audio_media_id, status, created_by)
VALUES
	(1, '01JSEEDGRPRDNG000000000000', 'N3', 'GRAMMAR_READING', 'READING_PASSAGE', '図書館のお知らせ', '当図書館は、来月から開館時間を変更いたします。平日は午前九時から午後八時まで、土曜日と日曜日は午前十時から午後六時までとなります。なお、毎月第一月曜日は館内整理のため休館いたしますので、ご注意ください。', 'The library will change its opening hours next month. On weekdays it will be open from 9 a.m. to 8 p.m.; on weekends from 10 a.m. to 6 p.m. It is closed on the first Monday of every month.', '次の文章を読んで、質問に答えなさい。', NULL, NULL, NULL, NULL, 'PUBLISHED', 1),
	(2, '01JSEEDGRPLSTN000000000000', 'N4', 'LISTENING', 'LISTENING_CLIP', '会議の後', NULL, NULL, '音声を聞いて、質問に答えなさい。', NULL, NULL, NULL, 2, 'PUBLISHED', 1),
	(3, '01JSEEDGRPCNCP000000000000', 'N4', 'GRAMMAR_READING', 'CONCEPT_REVIEW', '助詞「に」', '「に」は目的地や到着点を示します。', 'The particle に marks a destination or arrival point.', '最も自然な助詞を選びなさい。', '私は毎日学校に行きます。', 'Watashi wa mainichi gakkou ni ikimasu.', 'I go to school every day.', NULL, 'PUBLISHED', 1)
ON CONFLICT(id) DO NOTHING;

INSERT INTO questions (id, public_id, group_id, group_position, level, section, stem, explanation, points, status, created_by) VALUES
	(1, '01JSEEDQ000100000000000000', NULL, NULL, 'N4', 'VOCAB_KANJI', 'この漢字の読み方はどれですか。「病院」', '「病院」は「びょういん」と読みます。「美容院（びよういん）」と混同しやすいので注意。', 1, 'PUBLISHED', 1),
	(2, '01JSEEDQ000200000000000000', NULL, NULL, 'N4', 'VOCAB_KANJI', '「＿＿＿を ひきます」に 入る ことばは どれですか。', '楽器の演奏には「ひく」を使います。', 1, 'PUBLISHED', 1),
	(3, '01JSEEDQ000300000000000000', NULL, NULL, 'N4', 'GRAMMAR_READING', '雨が ふって いる ので、試合は 中止に ＿＿＿。', '「なる」の丁寧な過去形「なりました」が入ります。', 1, 'PUBLISHED', 1),
	(4, '01JSEEDQ000400000000000000', NULL, NULL, 'N4', 'LISTENING', '男の人は これから 何を しますか。', '会話の最後に「銀行に 行って きます」と言っています。', 1, 'PUBLISHED', 1),
	(5, '01JSEEDQ000500000000000000', NULL, NULL, 'N3', 'VOCAB_KANJI', '「彼の 説明は とても ＿＿＿だった。」', '「明確（めいかく）」＝はっきりしていること。', 1, 'PUBLISHED', 1),
	(6, '01JSEEDQ000600000000000000', NULL, NULL, 'N3', 'VOCAB_KANJI', '「約束の 時間に ＿＿＿ 合った。」', '「間に合う」で「時間に遅れない」という意味になります。', 1, 'PUBLISHED', 1),
	(7, '01JSEEDQ000700000000000000', NULL, NULL, 'N3', 'VOCAB_KANJI', '「この 問題は 彼には ＿＿＿ 難しい。」', '「やや」＝少し。程度を表す副詞です。', 1, 'PUBLISHED', 1),
	(8, '01JSEEDQ000800000000000000', NULL, NULL, 'N3', 'VOCAB_KANJI', '「彼女は 仕事を ＿＿＿ こなす。」', '「手際よく」＝上手に、効率よく。', 1, 'PUBLISHED', 1),
	(9, '01JSEEDQ000900000000000000', NULL, NULL, 'N3', 'VOCAB_KANJI', '「新しい 制度が ＿＿＿ された。」', '制度は「導入」されます。', 1, 'PUBLISHED', 1),
	(10, '01JSEEDQ001000000000000000', NULL, NULL, 'N3', 'VOCAB_KANJI', '「彼は 責任を ＿＿＿。」', '責任は「果たす」ものです。', 1, 'PUBLISHED', 1),
	(11, '01JSEEDQ001100000000000000', 1, 1, 'N3', 'GRAMMAR_READING', '平日の 開館時間は 何時までですか。', '本文に「平日は午前九時から午後八時まで」とあります。', 1, 'PUBLISHED', 1),
	(12, '01JSEEDQ001200000000000000', 1, 2, 'N3', 'GRAMMAR_READING', '休館日は いつですか。', '本文に「毎月第一月曜日は館内整理のため休館」とあります。', 1, 'PUBLISHED', 1),
	(13, '01JSEEDQ001300000000000000', NULL, NULL, 'N3', 'LISTENING', '女の人は 何に ついて 話して いますか。', '会話全体が引っ越しの手続きについての内容です。', 1, 'PUBLISHED', 1),
	-- N4, VOCAB_KANJI, with an image: the sample admin dashboard has nothing to show an
	-- image or audio question until at least one of each exists.
	(14, '01JSEEDQ001400000000000000', NULL, NULL, 'N4', 'VOCAB_KANJI', 'この 図形は 何色ですか。', '画像の正方形は赤色です。', 1, 'PUBLISHED', 1)
ON CONFLICT(id) DO NOTHING;

-- Question 4 already asks a LISTENING question; giving it audio here rather than at
-- INSERT keeps that block reading as pure seed data instead of mixing two migrations of
-- intent.
UPDATE questions SET audio_media_id = 2 WHERE id = 4;
UPDATE questions SET image_media_id = 1 WHERE id = 14;

-- Keep the demo bank aligned with every typed learner presentation. These updates also
-- upgrade an older local database where the idempotent inserts above already existed.
UPDATE questions
SET format = 'KANJI_READING', focus_text = '病院', focus_reading = 'びょういん'
WHERE id = 1;
UPDATE questions
SET format = 'VOCABULARY_MEANING', focus_text = '明確', focus_reading = 'めいかく'
WHERE id = 5;
UPDATE questions
SET format = 'GRAMMAR_CLOZE', group_id = 3, group_position = 1,
	context_text = '雨が ふって いる ので、試合は 中止に ___。',
	context_transliteration = 'Ame ga futte iru node, shiai wa chuushi ni ___.',
	prompt_translation = 'Choose the correct form to complete the sentence.'
WHERE id = 3;
UPDATE questions
SET format = 'READING_COMPREHENSION'
WHERE id IN (11, 12);
UPDATE questions
SET format = 'LISTENING_COMPREHENSION', group_id = 2, group_position = 1,
	audio_media_id = 2
WHERE id = 4;

UPDATE quizzes
SET show_study_aids_during_attempt = true, xp_reward = 120
WHERE id = 1;

-- Exactly one option per question carries is_correct = 1. A second would be rejected
-- by the question_options_one_correct_idx partial unique index, not by a validator.
INSERT INTO question_options (id, question_id, body, is_correct, position) VALUES
	(1, 1, 'びょういん', 1, 1),
	(2, 1, 'びよういん', 0, 2),
	(3, 1, 'びょうえん', 0, 3),
	(4, 1, 'へいいん', 0, 4),
	(5, 2, 'ピアノ', 1, 1),
	(6, 2, 'うた', 0, 2),
	(7, 2, 'ダンス', 0, 3),
	(8, 2, 'テレビ', 0, 4),
	(9, 3, 'なりました', 1, 1),
	(10, 3, 'しました', 0, 2),
	(11, 3, 'ありました', 0, 3),
	(12, 3, 'いました', 0, 4),
	(13, 4, '銀行へ 行く', 1, 1),
	(14, 4, '家に 帰る', 0, 2),
	(15, 4, '昼ごはんを 食べる', 0, 3),
	(16, 4, '会議に 出る', 0, 4),
	(17, 5, '明確', 1, 1),
	(18, 5, '明白', 0, 2),
	(19, 5, '明朗', 0, 3),
	(20, 5, '明細', 0, 4),
	(21, 6, '間に', 1, 1),
	(22, 6, '時に', 0, 2),
	(23, 6, '中に', 0, 3),
	(24, 6, '内に', 0, 4),
	(25, 7, 'やや', 1, 1),
	(26, 7, 'ぜひ', 0, 2),
	(27, 7, 'まさか', 0, 3),
	(28, 7, 'いっそ', 0, 4),
	(29, 8, '手際よく', 1, 1),
	(30, 8, '手前よく', 0, 2),
	(31, 8, '手先よく', 0, 3),
	(32, 8, '手元よく', 0, 4),
	(33, 9, '導入', 1, 1),
	(34, 9, '投入', 0, 2),
	(35, 9, '記入', 0, 3),
	(36, 9, '収入', 0, 4),
	(37, 10, '果たした', 1, 1),
	(38, 10, '終わった', 0, 2),
	(39, 10, 'できた', 0, 3),
	(40, 10, '返した', 0, 4),
	(41, 11, '午後八時', 1, 1),
	(42, 11, '午後六時', 0, 2),
	(43, 11, '午後九時', 0, 3),
	(44, 11, '午前十時', 0, 4),
	(45, 12, '毎月第一月曜日', 1, 1),
	(46, 12, '毎週月曜日', 0, 2),
	(47, 12, '毎月最終日曜日', 0, 3),
	(48, 12, '祝日', 0, 4),
	(49, 13, '引っ越しの 手続き', 1, 1),
	(50, 13, '旅行の 計画', 0, 2),
	(51, 13, '仕事の 面接', 0, 3),
	(52, 13, '料理の 作り方', 0, 4),
	(53, 14, '赤', 1, 1),
	(54, 14, '青', 0, 2),
	(55, 14, '緑', 0, 3),
	(56, 14, '黄色', 0, 4)
ON CONFLICT(id) DO NOTHING;

-- FIXED quizzes only. Quiz 3 is RANDOM, so what it serves is decided per attempt and
-- recorded in attempt_questions instead.
INSERT INTO quiz_questions (id, quiz_id, quiz_section_id, question_id, position) VALUES
	(1, 1, 1, 1, 1),
	(2, 1, 1, 2, 2),
	(3, 1, 2, 3, 1),
	(4, 1, 3, 4, 1),
	(5, 2, 4, 5, 1),
	(6, 2, 4, 6, 2),
	(7, 2, 5, 11, 1),
	(8, 2, 5, 12, 2),
	(9, 2, 6, 13, 1),
	(10, 1, 1, 14, 3)
ON CONFLICT(id) DO NOTHING;

-- Quiz 4: a real sitting with a three-second first section and an eight-second overall
-- limit. Playwright watches both deadlines without fake clocks or test-only app paths.
INSERT INTO quizzes
	(id, public_id, title, description, mode, level, selection_mode, time_limit_seconds, status, created_by, published_at)
VALUES
	(4, '01JSEEDQZN5TEST00000000000', 'タイマー確認用（8秒）',
		'タイマーの動作確認専用のクイズです。制限時間はわずか8秒です。',
		'JLPT_PRACTICE', 'N5', 'FIXED', 8, 'PUBLISHED', 1, unixepoch())
ON CONFLICT(id) DO NOTHING;

-- Unlike ordinary demo content, this row is executable test configuration, so keep a
-- previously seeded local database aligned with the current timing assertions.
UPDATE quizzes
SET title = 'タイマー確認用（8秒）',
	description = 'タイマーの動作確認専用のクイズです。制限時間はわずか8秒です。',
	time_limit_seconds = 8
WHERE id = 4;

INSERT INTO quiz_sections (id, quiz_id, section, position, time_limit_seconds, draw_count, scoring_band_id) VALUES
	(8, 4, 'VOCAB_KANJI', 1, 3, NULL, NULL)
ON CONFLICT(id) DO NOTHING;

UPDATE quiz_sections SET time_limit_seconds = 3 WHERE id = 8 AND quiz_id = 4;

INSERT INTO quiz_sections
	(quiz_id, section, position, time_limit_seconds, draw_count, scoring_band_id)
VALUES
	(4, 'GRAMMAR_READING', 2, NULL, NULL, NULL)
ON CONFLICT(quiz_id, section) DO UPDATE SET
	position = excluded.position,
	time_limit_seconds = excluded.time_limit_seconds;

INSERT INTO questions (id, public_id, group_id, group_position, level, section, stem, explanation, points, status, created_by) VALUES
	(15, '01JSEEDQ001500000000000000', NULL, NULL, 'N5', 'VOCAB_KANJI', '「＿＿＿」に 入る ことばは どれですか。「これは ＿＿＿ です。」', '「ほん」＝本のことです。', 1, 'PUBLISHED', 1),
	(16, '01JSEEDQ001600000000000000', NULL, NULL, 'N5', 'GRAMMAR_READING', '「みず」を 漢字で 書くと どれですか。', '「水」と書きます。', 1, 'PUBLISHED', 1)
ON CONFLICT(id) DO NOTHING;

UPDATE questions SET section = 'GRAMMAR_READING' WHERE id = 16;

INSERT INTO question_options (id, question_id, body, is_correct, position) VALUES
	(57, 15, 'ほん', 1, 1),
	(58, 15, 'えき', 0, 2),
	(59, 15, 'いす', 0, 3),
	(60, 15, 'つくえ', 0, 4),
	(61, 16, '水', 1, 1),
	(62, 16, '木', 0, 2),
	(63, 16, '火', 0, 3),
	(64, 16, '土', 0, 4)
ON CONFLICT(id) DO NOTHING;

INSERT INTO quiz_questions (id, quiz_id, quiz_section_id, question_id, position) VALUES
	(11, 4, 8, 15, 1),
	(12, 4, 8, 16, 2)
ON CONFLICT(id) DO NOTHING;

UPDATE quiz_questions
SET quiz_section_id = (
	SELECT id FROM quiz_sections WHERE quiz_id = 4 AND section = 'GRAMMAR_READING'
)
WHERE id = 12;
