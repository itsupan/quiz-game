import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

describe('login page', () => {
	it('renders the login form', async () => {
		const screen = render(Page);

		await expect.element(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Login');
		await expect.element(screen.getByLabelText('Email address')).toBeInTheDocument();
		await expect.element(screen.getByLabelText('Password')).toBeInTheDocument();
	});

	it('links visitors to account creation', async () => {
		const screen = render(Page);

		await expect
			.element(screen.getByRole('link', { name: 'Create an account' }))
			.toHaveAttribute('href', '/signup');
	});
});
