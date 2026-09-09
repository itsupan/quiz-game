import {
	JLPT_LEVELS,
	QUIZ_MODES,
	SECTIONS,
	SELECTION_MODES,
	type JlptLevel,
	type QuizMode,
	type Section,
	type SelectionMode
} from '$lib/server/db/schema/enums';

/**
 * Form validation for the admin dashboard.
 *
 * Pure functions over `FormData` — no database, no `RequestEvent` — so every rule is
 * exhaustively testable in the node project and the route handlers stay thin.
 *
 * These rules are the layer that produces a *sentence* for the administrator. Several
 * of them are also enforced in SQLite (enum checks, the one-answer-key partial unique
 * index, the per-quiz section uniqueness), which is what makes them true even if a
 * write ever reaches the database another way. Neither layer replaces the other.
 */

export type Invalid = {
	ok: false;
	errors: Record<string, string>;
	/** Echoes the submitted text so a rejected form re-renders with the user's work. */
	values: Record<string, string>;
};

export type ValidationResult<T> = { ok: true; value: T } | Invalid;

/**
 * A rejected question submission.
 *
 * The scalar `values` echo cannot carry the option rows, because `optionBody` appears
 * once per row and a flat record keeps only the last. Without these, a rejected submit
 * re-renders with four empty options and the administrator retypes everything.
 */
export type InvalidQuestion = Invalid & {
	submitted: { options: { id: number | null; body: string }[]; correctOption: number };
};

export type QuestionOptionInput = {
	/** The existing row's id, or null for an option being added. */
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

export type QuizInput = {
	title: string;
	description: string | null;
	mode: QuizMode;
	level: JlptLevel;
	selectionMode: SelectionMode;
	timeLimitSeconds: number | null;
};

export type QuizSectionInput = {
	section: Section;
	position: number;
	timeLimitSeconds: number | null;
	drawCount: number | null;
};

/** Modes whose whole point is the clock. An untimed one is a misconfiguration. */
const TIMED_MODES: readonly QuizMode[] = ['MOCK_TEST', 'FULL_EXAM'];

const text = (data: FormData, field: string) => String(data.get(field) ?? '').trim();

/** Collects the raw submission so a rejected form can be re-rendered as typed. */
export function echoValues(data: FormData): Record<string, string> {
	const values: Record<string, string> = {};

	for (const [key, value] of data.entries()) {
		if (typeof value === 'string') {
			values[key] = value;
		}
	}

	return values;
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
	return (allowed as readonly string[]).includes(value);
}

/** Parses a positive whole number. Returns null for blank, undefined for malformed. */
function optionalCount(raw: string): number | null | undefined {
	if (raw === '') {
		return null;
	}

	const parsed = Number(raw);

	return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseQuestionForm(
	data: FormData
): { ok: true; value: QuestionInput } | InvalidQuestion {
	const errors: Record<string, string> = {};

	const stem = text(data, 'stem');
	const explanation = text(data, 'explanation');
	const level = text(data, 'level');
	const section = text(data, 'section');
	const points = Number(text(data, 'points'));

	if (stem === '') {
		errors.stem = 'Enter the question text.';
	}

	if (!oneOf(level, JLPT_LEVELS)) {
		errors.level = `Choose a level: ${JLPT_LEVELS.join(', ')}.`;
	}

	if (!oneOf(section, SECTIONS)) {
		errors.section = `Choose a section: ${SECTIONS.join(', ')}.`;
	}

	if (!Number.isInteger(points) || points < 1) {
		errors.points = 'Points must be a whole number of 1 or more.';
	}

	// Option rows arrive as two parallel arrays in DOM order, so position is the row's
	// index rather than a number the form has to keep consistent with itself.
	const bodies = data.getAll('optionBody').map((value) => String(value));

	// Hidden inputs, so a bad value here means the form was tampered with rather than
	// mistyped. It still needs rejecting: `Number('x')` is NaN, which would otherwise
	// travel all the way into a bound query parameter.
	const ids = data.getAll('optionId').map((value) => optionalCount(String(value).trim()));

	if (ids.some((id) => id === undefined)) {
		errors.options = 'One of the options could not be identified. Reload the page and try again.';
	}

	if (bodies.length < 2) {
		errors.options = 'A multiple-choice question needs at least two options.';
	}

	bodies.forEach((body, index) => {
		if (body.trim() === '') {
			errors[`optionBody.${index}`] = 'Enter this option, or remove the row.';
		}
	});

	// A radio group means the browser cannot express two answer keys, and the partial
	// unique index means the database cannot store them. What is left is zero.
	const rawCorrect = text(data, 'correctOption');
	const correctIndex = rawCorrect === '' ? -1 : Number(rawCorrect);

	if (correctIndex < 0 || !Number.isInteger(correctIndex) || correctIndex >= bodies.length) {
		errors.correctOption = 'Mark exactly one option as the correct answer.';
	}

	const imageMediaId = optionalCount(text(data, 'imageMediaId'));
	const audioMediaId = optionalCount(text(data, 'audioMediaId'));

	if (imageMediaId === undefined) {
		errors.imageMediaId = 'That image could not be identified.';
	}

	if (audioMediaId === undefined) {
		errors.audioMediaId = 'That audio file could not be identified.';
	}

	if (Object.keys(errors).length > 0) {
		return {
			ok: false,
			errors,
			values: echoValues(data),
			submitted: {
				options: bodies.map((body, index) => ({
					id: ids[index] ?? null,
					body
				})),
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

export function parseQuizForm(data: FormData): ValidationResult<QuizInput> {
	const errors: Record<string, string> = {};

	const title = text(data, 'title');
	const description = text(data, 'description');
	const mode = text(data, 'mode');
	const level = text(data, 'level');
	const selectionMode = text(data, 'selectionMode');

	if (title === '') {
		errors.title = 'Enter a title.';
	}

	if (!oneOf(mode, QUIZ_MODES)) {
		errors.mode = `Choose a mode: ${QUIZ_MODES.join(', ')}.`;
	}

	if (!oneOf(level, JLPT_LEVELS)) {
		errors.level = `Choose a level: ${JLPT_LEVELS.join(', ')}.`;
	}

	if (!oneOf(selectionMode, SELECTION_MODES)) {
		errors.selectionMode = `Choose how questions are selected: ${SELECTION_MODES.join(', ')}.`;
	}

	// Administrators think in minutes; the schema stores seconds, because the server
	// computes `expires_at` from it.
	const minutes = optionalCount(text(data, 'timeLimitMinutes'));

	if (minutes === undefined) {
		errors.timeLimitMinutes = 'Enter a whole number of minutes, or leave it blank.';
	} else if (minutes === null && oneOf(mode, TIMED_MODES)) {
		errors.timeLimitMinutes = `A ${mode.replace('_', ' ').toLowerCase()} needs a time limit.`;
	}

	if (Object.keys(errors).length > 0) {
		return { ok: false, errors, values: echoValues(data) };
	}

	return {
		ok: true,
		value: {
			title,
			description: description === '' ? null : description,
			mode: mode as QuizMode,
			level: level as JlptLevel,
			selectionMode: selectionMode as SelectionMode,
			// `minutes` is a positive integer or null here; 0 was rejected above.
			timeLimitSeconds: minutes ? minutes * 60 : null
		}
	};
}

export function parseQuizSectionForm(
	data: FormData,
	selectionMode: SelectionMode
): ValidationResult<QuizSectionInput> {
	const errors: Record<string, string> = {};

	const section = text(data, 'section');
	const position = optionalCount(text(data, 'position'));

	if (!oneOf(section, SECTIONS)) {
		errors.section = `Choose a section: ${SECTIONS.join(', ')}.`;
	}

	if (position === undefined || position === null) {
		errors.position = 'Position must be a whole number of 1 or more.';
	}

	const minutes = optionalCount(text(data, 'timeLimitMinutes'));

	if (minutes === undefined) {
		errors.timeLimitMinutes = 'Enter a whole number of minutes, or leave it blank.';
	}

	const drawCount = optionalCount(text(data, 'drawCount'));

	if (drawCount === undefined) {
		errors.drawCount = 'Enter a whole number of questions to draw.';
	} else if (selectionMode === 'RANDOM' && drawCount === null) {
		errors.drawCount = 'A random quiz needs to know how many questions this section draws.';
	} else if (selectionMode === 'FIXED' && drawCount !== null) {
		// A FIXED quiz serves quiz_questions, so a draw count here would be dead data
		// that reads as if it were doing something.
		errors.drawCount = 'A fixed quiz takes its questions from its list, so leave this blank.';
	}

	if (Object.keys(errors).length > 0) {
		return { ok: false, errors, values: echoValues(data) };
	}

	return {
		ok: true,
		value: {
			section: section as Section,
			position: position as number,
			timeLimitSeconds: minutes ? minutes * 60 : null,
			drawCount: drawCount ?? null
		}
	};
}

/**
 * Reasons a question cannot be published yet.
 *
 * Accessibility is the gate: an image nobody can hear described and audio nobody can
 * read makes a question unanswerable for some learners, and it is far cheaper to catch
 * at publish time than after an exam. Alt text and transcripts live on `media_assets`
 * because they describe the asset, so a described asset clears every question using it.
 *
 * Returns every blocker at once — fixing them one round-trip at a time is miserable.
 */
export function publishBlockers(
	question: { stem: string },
	media: {
		image: { altText: string | null } | null;
		audio: { transcript: string | null } | null;
	}
): string[] {
	const blockers: string[] = [];

	if (question.stem.trim() === '') {
		blockers.push('The question has no text.');
	}

	if (media.image && (media.image.altText ?? '').trim() === '') {
		blockers.push('The attached image needs alt text before this question can be published.');
	}

	if (media.audio && (media.audio.transcript ?? '').trim() === '') {
		blockers.push('The attached audio needs a transcript before this question can be published.');
	}

	return blockers;
}
