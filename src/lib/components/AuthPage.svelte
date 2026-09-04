<script lang="ts">
	import { resolve } from '$app/paths';
	import AuthField from './AuthField.svelte';
	import Button from './Button.svelte';

	type Props = { mode: 'login' | 'signup' };
	let { mode }: Props = $props();
	const isLogin = $derived(mode === 'login');
</script>

<svelte:head>
	<title>{isLogin ? 'Login' : 'Create account'} · QuizGame</title>
	<meta
		name="description"
		content={isLogin ? 'Sign in to continue learning.' : 'Create your QuizGame account.'}
	/>
</svelte:head>

<main
	class="relative grid min-h-svh grid-cols-1 overflow-x-hidden bg-[var(--paper)] min-[851px]:grid-cols-[minmax(30rem,0.9fr)_minmax(38rem,1.6fr)] min-[851px]:overflow-hidden"
>
	<section
		class="relative flex items-center border-x border-[var(--line)] px-8 pt-22 pb-12 before:absolute before:top-[31%] before:left-0 before:hidden before:h-[38%] before:border-l-2 before:border-[var(--red)] before:content-[''] min-[851px]:px-[clamp(2rem,5vw,7.5rem)] min-[851px]:py-20 min-[851px]:before:block"
		aria-labelledby="auth-title"
	>
		<a class="absolute top-9 left-8 min-[851px]:left-[clamp(2rem,5vw,7.5rem)]" href={resolve('/')}>
			<img class="h-auto w-40 sm:w-48" src="/brand/quiz_game_logo.png" alt="QuizGame home" />
		</a>
		<div class="mx-auto max-w-[35rem] min-[851px]:mx-0 min-[851px]:max-w-[34rem]">
			<div class="flex items-center gap-3 sm:gap-4">
				<span
					class="grid h-[3.8rem] min-w-20 place-items-center bg-[var(--red)] text-[2.5rem] leading-none font-extrabold text-white sm:h-19 sm:min-w-[6.4rem] sm:text-[3.25rem]"
				>
					{isLogin ? '01' : '02'}
				</span>
				<span class="text-5xl leading-none font-bold text-[var(--red)] sm:text-[4rem]">/</span>
				<h1
					id="auth-title"
					class="m-0 text-lg leading-[1.08] font-bold text-[var(--ink)] uppercase"
				>
					<span
						lang="ja"
						class="mb-1 block text-base tracking-[0.08em] text-[var(--red)] normal-case"
					>
						{isLogin ? 'ログイン' : '新規登録'}
					</span>
					{isLogin ? 'Login' : 'Sign up'}
				</h1>
			</div>

			<p class="mt-9 text-[clamp(1.05rem,1.35vw,1.35rem)] leading-[1.45] text-[var(--muted)]">
				{isLogin
					? 'Access your personalized dashboard, track your progress, and continue mastering the language.'
					: 'Create your profile, save your progress, and begin mastering the language.'}
			</p>
		</div>
		<span
			class="absolute -bottom-7 -left-1 hidden text-[clamp(5rem,9vw,10rem)] leading-none font-black whitespace-nowrap text-[#ececec] min-[851px]:block"
			aria-hidden="true">学ぶ</span
		>
	</section>

	<section
		class="relative flex items-center justify-center border-l border-[var(--line)] px-8 pt-12 pb-20 after:absolute after:top-0 after:left-1/2 after:hidden after:h-19 after:border-l after:border-[var(--line)] after:content-[''] min-[851px]:px-[clamp(3rem,8vw,10rem)] min-[851px]:py-16 min-[851px]:after:block"
		aria-label={isLogin ? 'Login form' : 'Sign up form'}
	>
		<span
			class="absolute top-[5.6%] right-[3.8%] h-10 w-10 border-t-2 border-r-2 border-[var(--red)] sm:h-16 sm:w-16"
			aria-hidden="true"
		></span>

		<form class="w-full max-w-[40rem]" onsubmit={(event) => event.preventDefault()}>
			{#if !isLogin}
				<div class="mb-10">
					<AuthField id="name" label="Full name" autocomplete="name" required />
				</div>
			{/if}

			<div class="mb-10">
				<AuthField id="email" label="Email address" type="email" autocomplete="email" required />
			</div>

			<div class="relative mb-16">
				{#if isLogin}
					<a
						class="absolute top-0 right-0 text-xs font-bold text-[var(--muted)] no-underline hover:underline"
						href={resolve('/login?forgot=true')}>Forgot?</a
					>
				{/if}
				<AuthField
					id="password"
					label="Password"
					type="password"
					autocomplete={isLogin ? 'current-password' : 'new-password'}
					required
				/>
			</div>

			<Button type="submit">
				{isLogin ? 'Authenticate' : 'Create account'}
				<i class="fi fi-rs-arrow-right flex text-xl" aria-hidden="true"></i>
			</Button>

			<div
				class="my-10 flex items-center gap-5 text-xs font-extrabold text-[#777] uppercase before:h-px before:flex-1 before:bg-[var(--line-strong)] before:content-[''] after:h-px after:flex-1 after:bg-[var(--line-strong)] after:content-['']"
			>
				<span>or</span>
			</div>

			<Button variant="secondary" type="button">
				<i class="fi fi-rs-globe flex text-2xl" aria-hidden="true"></i>
				Continue with Google
			</Button>

			<p class="mt-12 text-base text-[var(--muted)]">
				{isLogin ? 'New to QuizGame?' : 'Already have an account?'}
				<a
					class="ml-1 font-extrabold text-[var(--red)] no-underline hover:underline"
					href={resolve(isLogin ? '/signup' : '/login')}
				>
					{isLogin ? 'Create an account' : 'Log in'}
				</a>
			</p>
		</form>

		<a
			class="absolute right-8 bottom-5 text-[0.65rem] text-[var(--muted)] underline-offset-2 hover:underline"
			href="https://www.flaticon.com/uicons"
			target="_blank"
			rel="noreferrer">UIcons by Flaticon</a
		>
	</section>

	<div class="absolute bottom-0 left-0 z-30 h-2.5 w-full bg-[var(--red)]" aria-hidden="true"></div>
</main>
