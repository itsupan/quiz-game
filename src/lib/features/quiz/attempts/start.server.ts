import { and, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import type { GroupFormat, QuestionFormat, ScoringBand, Section } from '$lib/domain/enums';
import type { WriteResult } from '$lib/domain/write-result';
import type { Database } from '$lib/server/db';
import { isForeignKeyFailure } from '$lib/server/db/errors';
import { newPublicId } from '$lib/server/db/ids';
import {
	attemptQuestionOptions,
	attemptQuestionGroups,
	attemptQuestions,
	attempts,
	attemptScoringBands,
	attemptSections,
	mediaAssets,
	questionGroups,
	questionOptions,
	questions,
	quizQuestions,
	quizScoringBands,
	quizzes,
	quizSections
} from '$lib/server/db/schema';
import type { Quiz, QuizScoringBand, QuizSection } from '$lib/server/db/schema';
import { attemptDeadline } from '../timing';

const imageAsset = alias(mediaAssets, 'start_image_asset');
const audioAsset = alias(mediaAssets, 'start_audio_asset');
const groupImageAsset = alias(mediaAssets, 'start_group_image_asset');
const groupAudioAsset = alias(mediaAssets, 'start_group_audio_asset');

/**
 * D1 accepts at most 100 bound variables in one SQL statement. Snapshot rows are wide,
 * and the attempt-id subquery contributes one binding per row, so keep every generated
 * multi-row insert comfortably below that ceiling while retaining one atomic batch.
 */
function chunkRows<T>(rows: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let index = 0; index < rows.length; index += size) {
		chunks.push(rows.slice(index, index + size));
	}
	return chunks;
}

/**
 * A question this attempt is about to freeze, with everything `attempt_questions` and
 * `attempt_question_options` need to stop pointing at live content once it is served.
 */
type ServedQuestion = {
	questionId: number;
	section: Section;
	points: number;
	format: QuestionFormat;
	stem: string;
	explanation: string | null;
	promptTranslation: string | null;
	focusText: string | null;
	focusReading: string | null;
	contextText: string | null;
	contextTransliteration: string | null;
	imagePublicId: string | null;
	imageAltText: string | null;
	imageMimeType: string | null;
	imageWidth: number | null;
	imageHeight: number | null;
	audioPublicId: string | null;
	audioTranscript: string | null;
	audioMimeType: string | null;
	audioDurationMs: number | null;
	groupId: number | null;
	groupPublicId: string | null;
	groupFormat: GroupFormat | null;
	groupTitle: string | null;
	groupInstruction: string | null;
	groupPassageText: string | null;
	groupBodyTranslation: string | null;
	groupExampleText: string | null;
	groupExampleTransliteration: string | null;
	groupExampleTranslation: string | null;
	groupImagePublicId: string | null;
	groupImageAltText: string | null;
	groupImageMimeType: string | null;
	groupImageWidth: number | null;
	groupImageHeight: number | null;
	groupAudioPublicId: string | null;
	groupAudioTranscript: string | null;
	groupAudioMimeType: string | null;
	groupAudioDurationMs: number | null;
};

const servedQuestionColumns = {
	format: questions.format,
	stem: questions.stem,
	explanation: questions.explanation,
	promptTranslation: questions.promptTranslation,
	focusText: questions.focusText,
	focusReading: questions.focusReading,
	contextText: questions.contextText,
	contextTransliteration: questions.contextTransliteration,
	imagePublicId: imageAsset.publicId,
	imageAltText: imageAsset.altText,
	imageMimeType: imageAsset.mimeType,
	imageWidth: imageAsset.width,
	imageHeight: imageAsset.height,
	audioPublicId: audioAsset.publicId,
	audioTranscript: audioAsset.transcript,
	audioMimeType: audioAsset.mimeType,
	audioDurationMs: audioAsset.durationMs,
	groupId: questionGroups.id,
	groupPublicId: questionGroups.publicId,
	groupFormat: questionGroups.format,
	groupTitle: questionGroups.title,
	groupInstruction: questionGroups.instruction,
	groupPassageText: questionGroups.passageText,
	groupBodyTranslation: questionGroups.bodyTranslation,
	groupExampleText: questionGroups.exampleText,
	groupExampleTransliteration: questionGroups.exampleTransliteration,
	groupExampleTranslation: questionGroups.exampleTranslation,
	groupImagePublicId: groupImageAsset.publicId,
	groupImageAltText: groupImageAsset.altText,
	groupImageMimeType: groupImageAsset.mimeType,
	groupImageWidth: groupImageAsset.width,
	groupImageHeight: groupImageAsset.height,
	groupAudioPublicId: groupAudioAsset.publicId,
	groupAudioTranscript: groupAudioAsset.transcript,
	groupAudioMimeType: groupAudioAsset.mimeType,
	groupAudioDurationMs: groupAudioAsset.durationMs
} as const;

async function fixedServing(db: Database, quizId: number): Promise<ServedQuestion[]> {
	return db
		.select({
			questionId: quizQuestions.questionId,
			section: quizSections.section,
			points: sql<number>`coalesce(${quizQuestions.pointsOverride}, ${questions.points})`.mapWith(
				Number
			),
			...servedQuestionColumns
		})
		.from(quizQuestions)
		.innerJoin(questions, eq(questions.id, quizQuestions.questionId))
		.innerJoin(quizSections, eq(quizSections.id, quizQuestions.quizSectionId))
		.leftJoin(imageAsset, eq(imageAsset.id, questions.imageMediaId))
		.leftJoin(audioAsset, eq(audioAsset.id, questions.audioMediaId))
		.leftJoin(questionGroups, eq(questionGroups.id, questions.groupId))
		.leftJoin(groupImageAsset, eq(groupImageAsset.id, questionGroups.imageMediaId))
		.leftJoin(groupAudioAsset, eq(groupAudioAsset.id, questionGroups.audioMediaId))
		.where(eq(quizQuestions.quizId, quizId))
		.orderBy(quizSections.position, quizQuestions.position);
}

async function randomServing(
	db: Database,
	quiz: Pick<Quiz, 'level'>,
	sections: Pick<QuizSection, 'section' | 'position' | 'drawCount'>[]
): Promise<WriteResult<ServedQuestion[]>> {
	const served: ServedQuestion[] = [];

	for (const section of [...sections].sort((a, b) => a.position - b.position)) {
		const drawCount = section.drawCount ?? 0;
		if (drawCount === 0) continue;

		const drawn = await db
			.select({
				questionId: questions.id,
				points: questions.points,
				...servedQuestionColumns
			})
			.from(questions)
			.leftJoin(imageAsset, eq(imageAsset.id, questions.imageMediaId))
			.leftJoin(audioAsset, eq(audioAsset.id, questions.audioMediaId))
			.leftJoin(questionGroups, eq(questionGroups.id, questions.groupId))
			.leftJoin(groupImageAsset, eq(groupImageAsset.id, questionGroups.imageMediaId))
			.leftJoin(groupAudioAsset, eq(groupAudioAsset.id, questionGroups.audioMediaId))
			.where(
				and(
					eq(questions.level, quiz.level),
					eq(questions.section, section.section),
					eq(questions.status, 'PUBLISHED')
				)
			)
			.orderBy(sql`random()`)
			.limit(drawCount);

		if (drawn.length < drawCount) {
			return {
				ok: false,
				message: `This quiz has no published questions left for its ${section.section} section.`
			};
		}

		served.push(...drawn.map((row) => ({ ...row, section: section.section })));
	}

	return { ok: true, value: served };
}

type AnswerKeyOption = { body: string; position: number; isCorrect: boolean };

/**
 * The full answer key for a set of questions, including `isCorrect` — unlike
 * `loadPublicOptions`, which exists specifically so a learner-facing payload can never
 * carry it. This is the one call site allowed to read `isCorrect` outside scoring itself:
 * it freezes the key into `attempt_question_options` before anything is served, which is
 * what lets scoring read the frozen copy instead of the live table.
 */
async function loadAnswerKey(
	db: Database,
	questionIds: number[]
): Promise<Map<number, AnswerKeyOption[]>> {
	const byQuestion = new Map<number, AnswerKeyOption[]>();

	if (questionIds.length === 0) return byQuestion;

	const rows = await db
		.select({
			questionId: questionOptions.questionId,
			body: questionOptions.body,
			position: questionOptions.position,
			isCorrect: questionOptions.isCorrect
		})
		.from(questionOptions)
		.where(inArray(questionOptions.questionId, [...new Set(questionIds)]))
		.orderBy(questionOptions.position);

	for (const { questionId, ...option } of rows) {
		const options = byQuestion.get(questionId) ?? [];
		options.push(option);
		byQuestion.set(questionId, options);
	}

	return byQuestion;
}

/** Which scoring band each section fed, at the moment the attempt is started. */
function bandCodeBySection(
	sections: Pick<QuizSection, 'section' | 'scoringBandId'>[],
	bands: Pick<QuizScoringBand, 'id' | 'code'>[]
): Map<Section, ScoringBand> {
	const codeById = new Map(bands.map((band) => [band.id, band.code]));
	const bySection = new Map<Section, ScoringBand>();

	for (const section of sections) {
		const code = section.scoringBandId === null ? undefined : codeById.get(section.scoringBandId);
		if (code) bySection.set(section.section, code);
	}

	return bySection;
}

type StartableQuiz = Pick<
	Quiz,
	'id' | 'level' | 'selectionMode' | 'timeLimitSeconds' | 'scaledTotalMax' | 'passMarkTotal'
> &
	Partial<Pick<Quiz, 'showStudyAidsDuringAttempt' | 'xpReward'>>;

export async function startAttempt(
	db: Database,
	quiz: StartableQuiz,
	sections: Pick<
		QuizSection,
		'section' | 'position' | 'drawCount' | 'timeLimitSeconds' | 'scoringBandId'
	>[],
	userId: number,
	now: Date,
	idempotencyKey: string | null = null,
	bands: Pick<QuizScoringBand, 'id' | 'code' | 'label' | 'scaledMax' | 'passMark'>[] = []
): Promise<WriteResult<string>> {
	const servedResult =
		quiz.selectionMode === 'FIXED'
			? { ok: true as const, value: await fixedServing(db, quiz.id) }
			: await randomServing(db, quiz, sections);

	if (!servedResult.ok) return servedResult;
	if (servedResult.value.length === 0) {
		return { ok: false, message: 'This quiz has no questions to serve yet.' };
	}

	const answerKey = await loadAnswerKey(
		db,
		servedResult.value.map((served) => served.questionId)
	);
	const bandBySection = bandCodeBySection(sections, bands);
	const attemptPublicId = newPublicId();
	const attemptId = sql<number>`(
		select ${attempts.id}
		from ${attempts}
		where ${attempts.publicId} = ${attemptPublicId}
	)`;

	const optionRows = servedResult.value.flatMap((served, index) =>
		(answerKey.get(served.questionId) ?? []).map((option) => ({
			attemptId,
			questionPosition: index + 1,
			position: option.position,
			body: option.body,
			isCorrect: option.isCorrect
		}))
	);
	const groupRows = [
		...new Map(
			servedResult.value
				.filter(
					(
						served
					): served is ServedQuestion & {
						groupId: number;
						groupPublicId: string;
						groupFormat: GroupFormat;
					} =>
						served.groupId !== null && served.groupPublicId !== null && served.groupFormat !== null
				)
				.map((served) => [served.groupPublicId, served])
		).values()
	].map((served) => ({
		attemptId,
		sourceGroupId: served.groupId,
		publicId: served.groupPublicId,
		format: served.groupFormat,
		title: served.groupTitle,
		instruction: served.groupInstruction,
		passageText: served.groupPassageText,
		bodyTranslation: served.groupBodyTranslation,
		exampleText: served.groupExampleText,
		exampleTransliteration: served.groupExampleTransliteration,
		exampleTranslation: served.groupExampleTranslation,
		imagePublicId: served.groupImagePublicId,
		imageMimeType: served.groupImageMimeType,
		imageWidth: served.groupImageWidth,
		imageHeight: served.groupImageHeight,
		imageAltText: served.groupImageAltText,
		audioPublicId: served.groupAudioPublicId,
		audioMimeType: served.groupAudioMimeType,
		audioDurationMs: served.groupAudioDurationMs,
		audioTranscript: served.groupAudioTranscript
	}));
	const questionRows = servedResult.value.map((served, index) => ({
		attemptId,
		questionId: served.questionId,
		section: served.section,
		groupPublicId: served.groupPublicId,
		position: index + 1,
		points: served.points,
		bandCode: bandBySection.get(served.section) ?? null,
		stem: served.stem,
		explanation: served.explanation,
		format: served.format,
		promptTranslation: served.promptTranslation,
		focusText: served.focusText,
		focusReading: served.focusReading,
		contextText: served.contextText,
		contextTransliteration: served.contextTransliteration,
		imagePublicId: served.imagePublicId,
		imageAltText: served.imageAltText,
		imageMimeType: served.imageMimeType,
		imageWidth: served.imageWidth,
		imageHeight: served.imageHeight,
		audioPublicId: served.audioPublicId,
		audioMimeType: served.audioMimeType,
		audioDurationMs: served.audioDurationMs,
		audioTranscript: served.audioTranscript
	}));

	const statements = [
		db.insert(attempts).values({
			publicId: attemptPublicId,
			quizId: quiz.id,
			userId,
			idempotencyKey,
			status: 'IN_PROGRESS',
			startedAt: now,
			expiresAt: attemptDeadline(now, quiz.timeLimitSeconds),
			scaledTotalMax: quiz.scaledTotalMax,
			passMarkTotal: quiz.passMarkTotal,
			showStudyAidsDuringAttempt: quiz.showStudyAidsDuringAttempt ?? false,
			xpReward: quiz.xpReward ?? 0
		}),
		...(sections.length === 0
			? []
			: [
					db.insert(attemptSections).values(
						sections.map((section) => ({
							attemptId,
							section: section.section,
							position: section.position,
							timeLimitSeconds: section.timeLimitSeconds
						}))
					)
				]),
		...(bands.length === 0
			? []
			: [
					db.insert(attemptScoringBands).values(
						bands.map((band) => ({
							attemptId,
							bandCode: band.code,
							label: band.label,
							scaledMax: band.scaledMax,
							passMark: band.passMark
						}))
					)
				]),
		...chunkRows(groupRows, 4).map((rows) => db.insert(attemptQuestionGroups).values(rows)),
		...chunkRows(questionRows, 3).map((rows) => db.insert(attemptQuestions).values(rows)),
		...chunkRows(optionRows, 15).map((rows) => db.insert(attemptQuestionOptions).values(rows))
	];

	try {
		await db.batch(statements as [(typeof statements)[number], ...typeof statements]);
	} catch (cause) {
		if (isForeignKeyFailure(cause)) {
			return { ok: false, message: 'One of this quiz’s questions no longer exists.' };
		}

		throw cause;
	}

	return { ok: true, value: attemptPublicId };
}

export async function startPublishedAttempt(
	db: Database,
	publicId: string,
	userId: number,
	now: Date,
	idempotencyKey: string | null = null
): Promise<WriteResult<string> | null> {
	const [quiz] = await db.select().from(quizzes).where(eq(quizzes.publicId, publicId));
	if (!quiz || quiz.status !== 'PUBLISHED') return null;

	const sections = await db
		.select({
			section: quizSections.section,
			position: quizSections.position,
			drawCount: quizSections.drawCount,
			timeLimitSeconds: quizSections.timeLimitSeconds,
			scoringBandId: quizSections.scoringBandId
		})
		.from(quizSections)
		.where(eq(quizSections.quizId, quiz.id));

	const bands = await db
		.select({
			id: quizScoringBands.id,
			code: quizScoringBands.code,
			label: quizScoringBands.label,
			scaledMax: quizScoringBands.scaledMax,
			passMark: quizScoringBands.passMark
		})
		.from(quizScoringBands)
		.where(eq(quizScoringBands.quizId, quiz.id));

	return startAttempt(db, quiz, sections, userId, now, idempotencyKey, bands);
}
