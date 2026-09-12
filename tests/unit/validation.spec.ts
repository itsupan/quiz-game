import { describe, expect, it } from 'vitest';

import { parseQuizForm, parseQuizSectionForm } from '$lib/features/quiz/admin/validation';
import { parseQuestionForm, questionPublishBlockers } from '$lib/features/questions/validation';

/** Builds the multipart body an option row submits, in DOM order. */
function withOptions(
	data: FormData,
	options: { body: string; id?: string }[],
	correctIndex: number | null
) {
	for (const option of options) {
		data.append('optionId', option.id ?? '');
		data.append('optionBody', option.body);
	}

	if (correctIndex !== null) {
		data.set('correctOption', String(correctIndex));
	}

	return data;
}

function questionForm(overrides: Record<string, string> = {}, correctIndex: number | null = 0) {
	const data = new FormData();

	data.set('stem', 'この漢字の読み方はどれですか。「病院」');
	data.set('explanation', '「病院」は「びょういん」と読みます。');
	data.set('level', 'N4');
	data.set('section', 'VOCAB_KANJI');
	data.set('points', '1');

	for (const [key, value] of Object.entries(overrides)) {
		data.set(key, value);
	}

	return withOptions(
		data,
		[{ body: 'びょういん' }, { body: 'びよういん' }, { body: 'へいいん' }, { body: 'びょうえん' }],
		correctIndex
	);
}

function quizForm(overrides: Record<string, string> = {}) {
	const data = new FormData();

	data.set('title', 'JLPT N4 模擬本試験');
	data.set('description', '本試験と同じ構成の N4 フルテストです。');
	data.set('mode', 'FULL_EXAM');
	data.set('level', 'N4');
	data.set('selectionMode', 'FIXED');
	data.set('timeLimitMinutes', '115');

	for (const [key, value] of Object.entries(overrides)) {
		data.set(key, value);
	}

	return data;
}

function sectionForm(overrides: Record<string, string> = {}) {
	const data = new FormData();

	data.set('section', 'VOCAB_KANJI');
	data.set('position', '1');
	data.set('timeLimitMinutes', '25');

	for (const [key, value] of Object.entries(overrides)) {
		data.set(key, value);
	}

	return data;
}

describe('parseQuestionForm', () => {
	it('accepts a question with exactly one answer key', () => {
		const result = parseQuestionForm(questionForm());

		expect(result).toMatchObject({
			ok: true,
			value: {
				stem: 'この漢字の読み方はどれですか。「病院」',
				level: 'N4',
				section: 'VOCAB_KANJI',
				points: 1
			}
		});
	});

	it('numbers options from one, in submitted order', () => {
		const result = parseQuestionForm(questionForm());

		expect(result.ok && result.value.options).toEqual([
			{ id: null, body: 'びょういん', isCorrect: true, position: 1 },
			{ id: null, body: 'びよういん', isCorrect: false, position: 2 },
			{ id: null, body: 'へいいん', isCorrect: false, position: 3 },
			{ id: null, body: 'びょうえん', isCorrect: false, position: 4 }
		]);
	});

	it('rejects a question with no answer key', () => {
		// The partial unique index already makes a SECOND key impossible, so zero is the
		// only case left for a validator to catch.
		const result = parseQuestionForm(questionForm({}, null));

		expect(result.ok ? null : result.errors.correctOption).toMatch(/correct/i);
	});

	it('rejects an answer key pointing at an option that was not submitted', () => {
		const result = parseQuestionForm(questionForm({ correctOption: '9' }));

		expect(result.ok ? null : result.errors.correctOption).toBeDefined();
	});

	it('rejects a question with fewer than two options', () => {
		const data = new FormData();
		data.set('stem', '問題');
		data.set('level', 'N4');
		data.set('section', 'VOCAB_KANJI');
		data.set('points', '1');

		const result = parseQuestionForm(withOptions(data, [{ body: 'ひとつだけ' }], 0));

		expect(result.ok ? null : result.errors.options).toMatch(/two/i);
	});

	it('rejects a blank stem', () => {
		const result = parseQuestionForm(questionForm({ stem: '   ' }));

		expect(result.ok ? null : result.errors.stem).toBeDefined();
	});

	it('rejects a blank option body, naming the row that is blank', () => {
		const data = new FormData();
		data.set('stem', '問題');
		data.set('level', 'N4');
		data.set('section', 'VOCAB_KANJI');
		data.set('points', '1');

		const result = parseQuestionForm(withOptions(data, [{ body: 'ある' }, { body: '  ' }], 0));

		expect(result.ok ? null : result.errors['optionBody.1']).toBeDefined();
	});

	it.each([
		['level', 'N9'],
		['section', 'KANJI_ONLY']
	])('rejects a %s outside the schema enum', (field, value) => {
		const result = parseQuestionForm(questionForm({ [field]: value }));

		expect(result.ok ? null : result.errors[field]).toBeDefined();
	});

	it.each(['0', '-3', 'abc'])('rejects points of %s', (points) => {
		const result = parseQuestionForm(questionForm({ points }));

		expect(result.ok ? null : result.errors.points).toBeDefined();
	});

	it('keeps a blank explanation as null rather than an empty string', () => {
		const result = parseQuestionForm(questionForm({ explanation: '   ' }));

		expect(result.ok && result.value.explanation).toBeNull();
	});

	it('echoes what was submitted so a rejected form is not wiped', () => {
		const result = parseQuestionForm(questionForm({ stem: '', level: 'N2' }));

		expect(result.ok ? null : result.values.level).toBe('N2');
	});

	it('carries existing option ids through so edits update rather than replace', () => {
		const data = new FormData();
		data.set('stem', '問題');
		data.set('level', 'N4');
		data.set('section', 'VOCAB_KANJI');
		data.set('points', '1');

		const result = parseQuestionForm(
			withOptions(data, [{ id: '12', body: 'ある' }, { body: 'ない' }], 0)
		);

		expect(result.ok && result.value.options.map((option) => option.id)).toEqual([12, null]);
	});
});

describe('parseQuizForm', () => {
	it('accepts a well-formed quiz and converts minutes to seconds', () => {
		const result = parseQuizForm(quizForm());

		expect(result).toMatchObject({
			ok: true,
			value: { title: 'JLPT N4 模擬本試験', mode: 'FULL_EXAM', timeLimitSeconds: 6900 }
		});
	});

	it('rejects a blank title', () => {
		const result = parseQuizForm(quizForm({ title: ' ' }));

		expect(result.ok ? null : result.errors.title).toBeDefined();
	});

	it.each(['MOCK_TEST', 'FULL_EXAM'])('requires a time limit for %s', (mode) => {
		// These modes are defined by being timed; an untimed one is a misconfiguration.
		const result = parseQuizForm(quizForm({ mode, timeLimitMinutes: '' }));

		expect(result.ok ? null : result.errors.timeLimitMinutes).toMatch(/time limit/i);
	});

	it('lets a practice quiz be untimed', () => {
		const result = parseQuizForm(quizForm({ mode: 'JLPT_PRACTICE', timeLimitMinutes: '' }));

		expect(result.ok && result.value.timeLimitSeconds).toBeNull();
	});

	it.each([
		['mode', 'SPEED_RUN'],
		['level', 'N0'],
		['selectionMode', 'SHUFFLED']
	])('rejects a %s outside the schema enum', (field, value) => {
		const result = parseQuizForm(quizForm({ [field]: value }));

		expect(result.ok ? null : result.errors[field]).toBeDefined();
	});

	it.each(['0', '-1', 'soon'])('rejects a time limit of %s minutes', (timeLimitMinutes) => {
		const result = parseQuizForm(quizForm({ timeLimitMinutes }));

		expect(result.ok ? null : result.errors.timeLimitMinutes).toBeDefined();
	});
});

describe('parseQuizSectionForm', () => {
	it('accepts a fixed-quiz section without a draw count', () => {
		const result = parseQuizSectionForm(sectionForm(), 'FIXED');

		expect(result).toMatchObject({
			ok: true,
			value: { section: 'VOCAB_KANJI', position: 1, timeLimitSeconds: 1500, drawCount: null }
		});
	});

	it('requires a draw count on a random quiz', () => {
		const result = parseQuizSectionForm(sectionForm(), 'RANDOM');

		expect(result.ok ? null : result.errors.drawCount).toMatch(/random/i);
	});

	it('rejects a draw count on a fixed quiz', () => {
		// A FIXED quiz serves quiz_questions; a draw count here would be silently ignored.
		const result = parseQuizSectionForm(sectionForm({ drawCount: '5' }), 'FIXED');

		expect(result.ok ? null : result.errors.drawCount).toMatch(/fixed/i);
	});

	it.each(['0', '-2', 'five'])('rejects a draw count of %s', (drawCount) => {
		const result = parseQuizSectionForm(sectionForm({ drawCount }), 'RANDOM');

		expect(result.ok ? null : result.errors.drawCount).toBeDefined();
	});

	it('rejects a position below one', () => {
		const result = parseQuizSectionForm(sectionForm({ position: '0' }), 'FIXED');

		expect(result.ok ? null : result.errors.position).toBeDefined();
	});

	it('allows a section with no time limit of its own', () => {
		const result = parseQuizSectionForm(sectionForm({ timeLimitMinutes: '' }), 'FIXED');

		expect(result.ok && result.value.timeLimitSeconds).toBeNull();
	});
});

describe('questionPublishBlockers', () => {
	const question = { stem: '音声を聞いてください。', status: 'DRAFT' as const };

	it('lets a question with no media publish', () => {
		expect(questionPublishBlockers(question, { image: null, audio: null })).toEqual([]);
	});

	it('blocks an image with no alt text', () => {
		// Nobody using a screen reader can answer a question whose image is undescribed.
		const blockers = questionPublishBlockers(question, {
			image: { altText: null },
			audio: null
		});

		expect(blockers).toHaveLength(1);
		expect(blockers[0]).toMatch(/alt text/i);
	});

	it('blocks audio with no transcript', () => {
		const blockers = questionPublishBlockers(question, {
			image: null,
			audio: { transcript: '   ' }
		});

		expect(blockers[0]).toMatch(/transcript/i);
	});

	it('reports every blocker at once rather than one per attempt', () => {
		const blockers = questionPublishBlockers(question, {
			image: { altText: '' },
			audio: { transcript: '' }
		});

		expect(blockers).toHaveLength(2);
	});

	it('passes described media', () => {
		expect(
			questionPublishBlockers(question, {
				image: { altText: '駅の時刻表' },
				audio: { transcript: '男：すみません、駅はどこですか。' }
			})
		).toEqual([]);
	});
});

describe('rejected question submissions', () => {
	it('carries the typed option rows back, since the scalar echo cannot', () => {
		// `optionBody` appears once per row, so a flat record of values keeps only the
		// last one and the form would re-render with every option blank.
		const data = new FormData();
		data.set('stem', '');
		data.set('level', 'N4');
		data.set('section', 'VOCAB_KANJI');
		data.set('points', '1');

		const result = parseQuestionForm(
			withOptions(data, [{ id: '12', body: 'ある' }, { body: 'ない' }], 1)
		);

		expect(result.ok ? null : result.submitted).toEqual({
			options: [
				{ id: 12, body: 'ある' },
				{ id: null, body: 'ない' }
			],
			correctOption: 1
		});
	});

	it('reports no answer key as -1 rather than guessing at one', () => {
		const result = parseQuestionForm(questionForm({ stem: '' }, null));

		expect(result.ok ? null : result.submitted.correctOption).toBe(-1);
	});
});
