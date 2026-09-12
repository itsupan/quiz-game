import { describe, expect, it } from 'vitest';

import { toQuestionDto } from '$lib/features/quiz/api/dto';
import type {
	AttemptQuestionGroupView,
	AttemptQuestionView,
	AttemptView
} from '$lib/features/quiz/attempts/types.server';
import type { QuestionFormat } from '$lib/domain/enums';

const NOW = new Date('2026-09-13T12:00:00.000Z');

const readingGroup: AttemptQuestionGroupView = {
	publicId: '01JTESTGROUPREADING00000000',
	format: 'READING_PASSAGE',
	title: 'Passage 04',
	instruction: 'Read the passage.',
	passageText: '明日はこの靴を履いて、友達と山へ行きます。',
	bodyTranslation: 'Tomorrow I will wear these shoes and go to the mountains.',
	exampleText: null,
	exampleTransliteration: null,
	exampleTranslation: null,
	image: null,
	audio: null
};

const listeningGroup: AttemptQuestionGroupView = {
	...readingGroup,
	publicId: '01JTESTGROUPLISTENING00000',
	format: 'LISTENING_CLIP',
	title: 'Station announcement',
	passageText: null,
	bodyTranslation: null,
	image: {
		publicId: '01JTESTIMAGE00000000000000',
		mimeType: 'image/png',
		width: 800,
		height: 800,
		altText: 'A railway station.'
	},
	audio: {
		publicId: '01JTESTAUDIO00000000000000',
		mimeType: 'audio/mpeg',
		durationMs: 90_000
	}
};

function question(format: QuestionFormat): AttemptQuestionView {
	return {
		attemptQuestionId: 1,
		questionId: 1,
		section:
			format === 'LISTENING_COMPREHENSION'
				? 'LISTENING'
				: format === 'READING_COMPREHENSION' || format === 'GRAMMAR_CLOZE'
					? 'GRAMMAR_READING'
					: 'VOCAB_KANJI',
		position: 1,
		points: 1,
		format,
		stem: 'Question prompt',
		promptTranslation: 'Translated prompt',
		focusText:
			format === 'VOCABULARY_MEANING' ? '勉強' : format === 'KANJI_READING' ? '図書館' : null,
		focusReading: format === 'VOCABULARY_MEANING' ? 'べんきょう' : null,
		contextText: format === 'GRAMMAR_CLOZE' ? '私は毎日 ___ 行きます。' : null,
		contextTransliteration: format === 'GRAMMAR_CLOZE' ? 'Watashi wa mainichi ...' : null,
		group:
			format === 'READING_COMPREHENSION'
				? readingGroup
				: format === 'LISTENING_COMPREHENSION'
					? listeningGroup
					: null,
		image: null,
		audio: null,
		options: [
			{ id: 1, body: 'A', position: 1 },
			{ id: 2, body: 'B', position: 2 }
		],
		selectedOptionId: null
	};
}

function view(format: QuestionFormat): AttemptView {
	return {
		attempt: {
			id: 1,
			publicId: '01JTESTATTEMPT000000000000',
			userId: 1,
			status: 'IN_PROGRESS',
			startedAt: NOW,
			expiresAt: null,
			showStudyAidsDuringAttempt: true
		},
		quiz: {
			id: 1,
			publicId: '01JTESTQUIZ000000000000000',
			title: 'Quiz',
			mode: 'JLPT_PRACTICE',
			level: 'N4',
			timeLimitSeconds: null
		},
		sectionDeadlines: [],
		questions: [question(format)]
	};
}

describe('learner question presentation DTOs', () => {
	it.each([
		'STANDARD',
		'VOCABULARY_MEANING',
		'KANJI_READING',
		'GRAMMAR_CLOZE',
		'READING_COMPREHENSION',
		'LISTENING_COMPREHENSION'
	] as const)('returns a discriminated %s presentation', (format) => {
		const dto = toQuestionDto(view(format), 1, NOW);

		expect(dto.presentation.type).toBe(format);
		expect(dto.presentation.prompt).toEqual({
			text: 'Question prompt',
			translation: 'Translated prompt'
		});
	});

	it('returns semantic focus, cloze, passage, and listening data', () => {
		expect(toQuestionDto(view('VOCABULARY_MEANING'), 1, NOW).presentation).toMatchObject({
			focus: { text: '勉強', reading: 'べんきょう' }
		});
		expect(toQuestionDto(view('KANJI_READING'), 1, NOW).presentation).toMatchObject({
			focus: { text: '図書館', reading: null }
		});
		expect(toQuestionDto(view('GRAMMAR_CLOZE'), 1, NOW).presentation).toMatchObject({
			context: { text: '私は毎日 ___ 行きます。' }
		});
		expect(toQuestionDto(view('READING_COMPREHENSION'), 1, NOW).presentation).toMatchObject({
			stimulus: { type: 'READING_PASSAGE', body: readingGroup.passageText }
		});
		expect(toQuestionDto(view('LISTENING_COMPREHENSION'), 1, NOW).presentation).toMatchObject({
			stimulus: {
				type: 'LISTENING_CLIP',
				audio: { durationMs: 90_000 },
				image: { altText: 'A railway station.' }
			}
		});
	});

	it('never includes a listening transcript in an active response', () => {
		const dto = toQuestionDto(view('LISTENING_COMPREHENSION'), 1, NOW);

		expect(JSON.stringify(dto)).not.toMatch(/transcript/i);
	});
});
