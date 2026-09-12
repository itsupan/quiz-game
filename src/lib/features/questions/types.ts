import type { MediaKind } from '$lib/domain/enums';

export type MediaChoice = {
	id: number;
	label: string;
	kind: MediaKind;
};
