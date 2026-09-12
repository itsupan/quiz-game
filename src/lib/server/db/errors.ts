/** D1 reports a RESTRICT violation as a plain message, so the text is what there is. */
export function isForeignKeyFailure(cause: unknown): boolean {
	return cause instanceof Error && /FOREIGN KEY constraint failed/i.test(cause.message);
}
