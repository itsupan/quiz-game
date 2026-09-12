<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Field from '$lib/components/Field.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import { toastEnhance } from '$lib/components/toast-enhance';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const submit = toastEnhance({ success: (resultData) => resultData?.message as string });

	const fieldError = (field: string) =>
		form?.field === field && !form.ok ? (form.message as string) : undefined;
</script>

<svelte:head>
	<title>Account Settings | QuizGame</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<span class="h-8 w-1.5 bg-brand-red" aria-hidden="true"></span>
		<h1 class="text-2xl font-black tracking-tight text-ink uppercase">Account Settings</h1>
	</div>

	<Card raised class="p-6">
		<h2 class="mb-4 text-sm font-bold tracking-widest uppercase">Profile Photo</h2>
		<div class="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
			<div
				class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border-2 border-ink bg-stone-100"
			>
				{#if data.avatarUrl}
					<img src={data.avatarUrl} alt="" class="h-full w-full object-cover" />
				{:else}
					<span class="text-2xl font-black text-stone-400"
						>{data.name.slice(0, 1).toUpperCase()}</span
					>
				{/if}
			</div>

			<form
				method="POST"
				action="?/uploadAvatar"
				enctype="multipart/form-data"
				use:enhance={submit}
				class="flex flex-col gap-2"
			>
				<Field
					id="avatar"
					label="New photo"
					hint="PNG, JPEG or WebP, up to 10 MB."
					error={fieldError('avatar')}
				>
					{#snippet control(props)}
						<input
							{...props}
							type="file"
							name="avatar"
							accept="image/png,image/jpeg,image/webp"
							required
						/>
					{/snippet}
				</Field>
				<Button type="submit" size="sm">Upload photo</Button>
			</form>
		</div>
	</Card>

	<Card raised class="p-6">
		<h2 class="mb-4 text-sm font-bold tracking-widest uppercase">Personal Information</h2>
		<form method="POST" action="?/updateName" use:enhance={submit}>
			<Field id="displayName" label="Display name" error={fieldError('name')} required>
				{#snippet control(props)}
					<input {...props} type="text" name="displayName" value={data.name} required />
				{/snippet}
			</Field>

			<Field id="email" label="Email address" hint="Contact an administrator to change this.">
				{#snippet control(props)}
					<input {...props} type="email" value={data.email} disabled />
				{/snippet}
			</Field>

			<Button type="submit">Save name</Button>
		</form>
	</Card>

	<Card raised class="p-6">
		<h2 class="mb-4 text-sm font-bold tracking-widest uppercase">Security</h2>
		{#if data.hasPassword}
			<form method="POST" action="?/changePassword" use:enhance={submit} class="flex flex-col">
				<Field
					id="currentPassword"
					label="Current password"
					error={fieldError('password')}
					required
				>
					{#snippet control(props)}
						<input
							{...props}
							type="password"
							name="currentPassword"
							autocomplete="current-password"
							required
						/>
					{/snippet}
				</Field>

				<Field id="newPassword" label="New password" required>
					{#snippet control(props)}
						<input
							{...props}
							type="password"
							name="newPassword"
							autocomplete="new-password"
							required
						/>
					{/snippet}
				</Field>

				<Field id="confirmPassword" label="Confirm new password" required>
					{#snippet control(props)}
						<input
							{...props}
							type="password"
							name="confirmPassword"
							autocomplete="new-password"
							required
						/>
					{/snippet}
				</Field>

				<Button type="submit">Change password</Button>
			</form>
		{:else}
			<Notice tone="info">
				This account signs in with Google, so there is no password to change.
			</Notice>
		{/if}
	</Card>

	<Button href={resolve('/profile')} variant="ghost">Back to Profile</Button>
</div>
