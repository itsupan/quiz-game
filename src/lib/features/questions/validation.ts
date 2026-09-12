import { JLPT_LEVELS, SECTIONS, type JlptLevel, type Section } from '$lib/domain/enums';
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
	points: number;
	imageMediaId: number | null;
	audioMediaId: number | null;
	options: QuestionOptionInput[];
};

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
			points,
			imageMediaId: imageMediaId ?? null,
			audioMediaId: audioMediaId ?? null,
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
	question: { stem: string },
	media: {
		image: { altText: string | null } | null;
		audio: { transcript: string | null } | null;
	},
	options?: { isCorrect: boolean }[]
): string[] {
	const blockers: string[] = [];

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

	return blockers;
}
