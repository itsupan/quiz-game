/**
 * The schema's enums now live in `$lib/domain/enums`, because the admin forms need the
 * same value lists to build their <select> options and SvelteKit refuses — correctly —
 * to bundle anything under `$lib/server/**` into browser code.
 *
 * Re-exported here so schema modules keep importing from alongside themselves.
 */
export * from '$lib/domain/enums';
