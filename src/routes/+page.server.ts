import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * `/` is a signpost, not a page.
 *
 * It used to render a placeholder listing whose job — hero, level filters, quiz cards —
 * is now done by `/home`. Keeping it would have meant maintaining a fourth shell for a
 * route nobody should land on.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/login');
	}

	redirect(302, locals.user.role === 'ADMIN' ? '/admin' : '/home');
};
