-- Local/development seed data. Idempotent, so it is safe to re-run.
-- Apply with: pnpm db:seed:local
--
-- Covers every structural shape the schema supports, so a fresh clone can exercise
-- all of it without an admin UI:
--   quiz 1  N4 FULL_EXAM      FIXED   2 scoring bands (120 + 60), 3 sections
--   quiz 2  N3 MOCK_TEST      FIXED   3 scoring bands (60 each), 3 sections
--   quiz 3  N3 JLPT_PRACTICE  RANDOM  no bands, draws 5 from the bank
--
-- Scaled bands and pass marks are a LINEAR APPROXIMATION of JLPT scoring, which is
-- item-response-theory based and unpublished. Confirm against the official site
-- before showing any of it to a learner as an exam-readiness figure.

INSERT INTO users (id, public_id, email, display_name, role, status) VALUES
	(1, '01JSEEDUSERADMIN0000000000', 'admin@example.com', '管理者テスト', 'ADMIN', 'ACTIVE'),
	(2, '01JSEEDUSERLEARNER00000000', 'learner@example.com', '学習者テスト', 'USER', 'ACTIVE')
ON CONFLICT(id) DO NOTHING;

INSERT INTO quizzes (id, public_id, title, description, mode, level, selection_mode, time_limit_seconds, scaled_total_max, pass_mark_total, status, created_by, published_at) VALUES
	(1, '01JSEEDQUIZN4EXAM000000000', 'JLPT N4 模擬本試験', '本試験と同じ構成の N4 フルテストです。', 'FULL_EXAM', 'N4', 'FIXED', 6900, 180, 90, 'PUBLISHED', 1, unixepoch()),
	(2, '01JSEEDQUIZN3MOCK000000000', 'JLPT N3 模擬試験', 'N3 の三区分で採点される模擬試験です。', 'MOCK_TEST', 'N3', 'FIXED', 8400, 180, 95, 'PUBLISHED', 1, unixepoch()),
	(3, '01JSEEDQUIZN3DRILL00000000', 'N3 語彙ドリル', '語彙・漢字からランダムに 5 問出題します。', 'JLPT_PRACTICE', 'N3', 'RANDOM', 600, NULL, NULL, 'PUBLISHED', 1, unixepoch())
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

INSERT INTO question_groups (id, public_id, level, section, title, passage_text, instruction, status, created_by) VALUES
	(1, '01JSEEDGROUPREADING0000000', 'N3', 'GRAMMAR_READING', '図書館のお知らせ', '当図書館は、来月から開館時間を変更いたします。平日は午前九時から午後八時まで、土曜日と日曜日は午前十時から午後六時までとなります。なお、毎月第一月曜日は館内整理のため休館いたしますので、ご注意ください。', '次の文章を読んで、質問に答えなさい。', 'PUBLISHED', 1)
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
	(13, '01JSEEDQ001300000000000000', NULL, NULL, 'N3', 'LISTENING', '女の人は 何に ついて 話して いますか。', '会話全体が引っ越しの手続きについての内容です。', 1, 'PUBLISHED', 1)
ON CONFLICT(id) DO NOTHING;

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
	(52, 13, '料理の 作り方', 0, 4)
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
	(9, 2, 6, 13, 1)
ON CONFLICT(id) DO NOTHING;
