export type Invalid = {
	ok: false;
	errors: Record<string, string>;
	values: Record<string, string>;
};

export type ValidationResult<T> = { ok: true; value: T } | Invalid;

export const formText = (data: FormData, field: string) => String(data.get(field) ?? '').trim();

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

export function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
	return (allowed as readonly string[]).includes(value);
}

/** Parses a positive whole number. Returns null for blank, undefined for malformed. */
export function optionalPositiveInteger(raw: string): number | null | undefined {
	if (raw === '') {
		return null;
	}

	const parsed = Number(raw);

	return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
