import { EXAM_RESULTS, type ExamResult } from './analytics';
import { apiProblem, parsePublicId } from '$lib/features/quiz/api/http.server';

export type ExamAttemptCursor = {
	completedAt: Date;
	attemptId: string;
};

export function parseTimezone(value: string | null): string {
	const timezone = value?.trim() || 'UTC';

	if (timezone.length > 100) {
		apiProblem(
			400,
			'invalid_query_parameter',
			'Invalid query parameter',
			'timezone must be a valid IANA timezone.'
		);
	}

	try {
		new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
	} catch {
		apiProblem(
			400,
			'invalid_query_parameter',
			'Invalid query parameter',
			'timezone must be a valid IANA timezone.'
		);
	}

	return timezone;
}

export function parsePeriod(value: string | null): 'week' {
	if (value === null || value === 'week') return 'week';

	apiProblem(
		400,
		'invalid_query_parameter',
		'Invalid query parameter',
		'period currently supports only week.'
	);
}

export function parseExamResult(value: string | null): ExamResult | undefined {
	if (value === null) return undefined;
	if (!EXAM_RESULTS.includes(value as ExamResult)) {
		apiProblem(
			400,
			'invalid_query_parameter',
			'Invalid query parameter',
			'result has an unsupported value.'
		);
	}

	return value as ExamResult;
}

export function encodeExamAttemptCursor(cursor: ExamAttemptCursor): string {
	return `${cursor.completedAt.getTime()}.${cursor.attemptId}`;
}

export function parseExamAttemptCursor(value: string | null): ExamAttemptCursor | undefined {
	if (value === null) return undefined;

	const match = /^(\d{1,16})\.([0-9A-HJKMNP-TV-Z]{26})$/.exec(value);
	if (!match) {
		apiProblem(400, 'invalid_query_parameter', 'Invalid query parameter', 'cursor is invalid.');
	}

	const milliseconds = Number(match[1]);
	const completedAt = new Date(milliseconds);
	if (!Number.isSafeInteger(milliseconds) || Number.isNaN(completedAt.getTime())) {
		apiProblem(400, 'invalid_query_parameter', 'Invalid query parameter', 'cursor is invalid.');
	}

	return {
		completedAt,
		attemptId: parsePublicId(match[2], 'cursor')
	};
}
