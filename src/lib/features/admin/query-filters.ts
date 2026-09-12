export function enumFilter<T extends string>(
	url: URL,
	key: string,
	allowed: readonly T[]
): T | undefined {
	const value = url.searchParams.get(key);

	return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}
