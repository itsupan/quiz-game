import {
	JLPT_LEVELS,
	SECTIONS,
	type JlptLevel,
	type QuestionFormat,
	type Section
} from '$lib/domain/enums';
import {
	echoValues,
	formText,
	isOneOf,
	optionalPositiveInteger,
	type Invalid
} from '$lib/features/admin/form-data';

export { echoValues } from '$lib/features/admin/form-data';

export type InvalidQuestion = Invalid & {
	submitted: { options: { id: number | null; body: string }[]; correctOption: number };
};

export type QuestionOptionInput = {
	id: number | null;
	body: string;
	isCorrect: boolean;
	position: number;
};

export type QuestionInput = {
	stem: string;
	explanation: string | null;
	level: JlptLevel;
	section: Section;
	format: QuestionFormat;
	promptTranslation: string | null;
	focusText: string | null;
	focusReading: string | null;
	contextText: string | null;
	contextTransliteration: string | null;
	points: number;
	imageMediaId: number | null;
	audioMediaId: number | null;
	groupId: number | null;
	groupPosition: number | null;
	options: QuestionOptionInput[];
};

/** The single blank token a `GRAMMAR_CLOZE` sentence must contain, exactly once. */
export const CLOZE_BLANK_TOKEN = '___';

/**
 * `true` when `text` contains exactly one run of underscores, and that run is exactly
 * three characters — so `"a___b"` passes but `"a____b"` (a four-underscore run) and
 * `"a___b___c"` (two separate runs) do not.
 */
export function hasExactlyOneClozeBlank(text: string): boolean {
	const runs = text.match(/_+/g) ?? [];
	return runs.length === 1 && runs[0] === CLOZE_BLANK_TOKEN;
}

/**
 * The format-specific required-content rules from the coverage plan, enforced as a hard
 * validation (not just a publish blocker) so stored data can never drift out of shape
 * with its own declared format.
 */
export function formatContentErrors(input: {
	format: QuestionFormat;
	focusText: string | null;
	contextText: string | null;
}): string[] {
	const errors: string[] = [];

	if (
		(input.format === 'VOCABULARY_MEANING' || input.format === 'KANJI_READING') &&
		(input.focusText ?? '').trim() === ''
	) {
		errors.push(`${input.format} requires a non-empty focusText.`);
	}

	if (input.format === 'GRAMMAR_CLOZE') {
		const contextText = (input.contextText ?? '').trim();
		if (contextText === '') {
			errors.push('GRAMMAR_CLOZE requires a non-empty contextText.');
		} else if (!hasExactlyOneClozeBlank(contextText)) {
			errors.push('GRAMMAR_CLOZE requires contextText to contain exactly one ___ token.');
		}
	}

	return errors;
}

export function parseQuestionForm(
	data: FormData
): { ok: true; value: QuestionInput } | InvalidQuestion {
	const errors: Record<string, string> = {};
	const stem = formText(data, 'stem');
	const explanation = formText(data, 'explanation');
	const level = formText(data, 'level');
	const section = formText(data, 'section');
	const points = Number(formText(data, 'points'));

	if (stem === '') errors.stem = 'Enter the question text.';
	if (!isOneOf(level, JLPT_LEVELS)) errors.level = `Choose a level: ${JLPT_LEVELS.join(', ')}.`;
	if (!isOneOf(section, SECTIONS)) errors.section = `Choose a section: ${SECTIONS.join(', ')}.`;
	if (!Number.isInteger(points) || points < 1) {
		errors.points = 'Points must be a whole number of 1 or more.';
	}

	const bodies = data.getAll('optionBody').map(String);
	const ids = data.getAll('optionId').map((value) => optionalPositiveInteger(String(value).trim()));

	if (ids.some((id) => id === undefined)) {
		errors.options = 'One of the options could not be identified. Reload the page and try again.';
	}
	if (bodies.length < 2) errors.options = 'A multiple-choice question needs at least two options.';
	bodies.forEach((body, index) => {
		if (body.trim() === '') errors[`optionBody.${index}`] = 'Enter this option, or remove the row.';
	});

	const rawCorrect = formText(data, 'correctOption');
	const correctIndex = rawCorrect === '' ? -1 : Number(rawCorrect);
	if (correctIndex < 0 || !Number.isInteger(correctIndex) || correctIndex >= bodies.length) {
		errors.correctOption = 'Mark exactly one option as the correct answer.';
	}

	const imageMediaId = optionalPositiveInteger(formText(data, 'imageMediaId'));
	const audioMediaId = optionalPositiveInteger(formText(data, 'audioMediaId'));
	if (imageMediaId === undefined) errors.imageMediaId = 'That image could not be identified.';
	if (audioMediaId === undefined) errors.audioMediaId = 'That audio file could not be identified.';

	if (Object.keys(errors).length > 0) {
		return {
			ok: false,
			errors,
			values: echoValues(data),
			submitted: {
				options: bodies.map((body, index) => ({ id: ids[index] ?? null, body })),
				correctOption: correctIndex
			}
		};
	}

	return {
		ok: true,
		value: {
			stem,
			explanation: explanation === '' ? null : explanation,
			level: level as JlptLevel,
			section: section as Section,
			// The admin dashboard form only ever authors STANDARD questions; the richer
			// formats are authored through the JSON API (`parseQuestionCreateBody`).
			format: 'STANDARD',
			promptTranslation: null,
			focusText: null,
			focusReading: null,
			contextText: null,
			contextTransliteration: null,
			points,
			imageMediaId: imageMediaId ?? null,
			audioMediaId: audioMediaId ?? null,
			groupId: null,
			groupPosition: null,
			options: bodies.map((body, index) => ({
				id: ids[index] ?? null,
				body: body.trim(),
				isCorrect: index === correctIndex,
				position: index + 1
			}))
		}
	};
}

/**
 * `options` is optional so every existing 2-argument call site is unaffected — it checks
 * "at least one answer key" (the half of the rule SQLite's partial unique index cannot
 * express) and "at least two options" only when a caller actually has the options to
 * check, instead of forcing every caller to fetch them just to pass an empty array.
 */
export function questionPublishBlockers(
	question: {
		stem: string;
		format?: QuestionFormat;
		focusText?: string | null;
		contextText?: string | null;
	},
	media: {
		image: { altText: string | null } | null;
		audio: { transcript: string | null } | null;
	},
	options?: { isCorrect: boolean }[],
	/** The attached group's own readiness, when this question's format requires one. */
	group?: { status: string; blockers: string[] } | null
): string[] {
	const blockers: string[] = [];
	const format = question.format ?? 'STANDARD';

	if (question.stem.trim() === '') blockers.push('The question has no text.');
	if (media.image && (media.image.altText ?? '').trim() === '') {
		blockers.push('The attached image needs alt text before this question can be published.');
	}
	if (media.audio && (media.audio.transcript ?? '').trim() === '') {
		blockers.push('The attached audio needs a transcript before this question can be published.');
	}
	if (options !== undefined) {
		if (options.length < 2) blockers.push('A published question needs at least two options.');
		if (!options.some((option) => option.isCorrect)) {
			blockers.push('Mark one option as the correct answer before publishing.');
		}
	}
	blockers.push(
		...formatContentErrors({
			format,
			focusText: question.focusText ?? null,
			contextText: question.contextText ?? null
		})
	);
	if (format === 'READING_COMPREHENSION' || format === 'LISTENING_COMPREHENSION') {
		if (!group) {
			blockers.push(`${format} requires an attached, compatible question group.`);
		} else if (group.status !== 'PUBLISHED') {
			blockers.push('The attached question group must be published before this question can be.');
		} else if (group.blockers.length > 0) {
			blockers.push(`The attached question group is not ready: ${group.blockers.join(' ')}`);
		}
	}

	return blockers;
}
