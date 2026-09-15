# Team page production data

The public team page keeps factual data in `team.ts`. Do not infer titles, personal quotes, profile
URLs or portrait consent from repository history.

Before release, each member must approve:

- display name and exact role title;
- discipline, ownership sentence and contributions;
- armor motif and working principle;
- every external profile URL;
- the AI-stylized likeness and its public use.

`portraitApproval` remains `pending` until consent is recorded outside the repository. Empty `links`
arrays are intentional; the directory renders links only after verified URLs are supplied. The page
contains no Japanese copy requiring linguistic approval.

## Artwork layers

- `*-samurai.webp` — preserved member cutout used as the body layer;
- `dojo-stage-background.webp` — shared paper-and-ink background generated without people or text;
- `dojo-foreground-ink.webp` — shared transparent foreground ink layer.

Portraits use a single body image over the two shared artwork layers. Lightweight native motion keeps
the page responsive without waiting for a separate animation library before content can appear.

## Audio

Sound files live in `src/lib/assets/sound/` (bundled by Vite with hashed URLs) and are supplied separately — confirm the licence for each
before release:

- `dojo-theme.mp3` — Our Team background loop; starts on the visitor's first interaction;
- `katana-swish.mp3` — quiz attempt, an answer is picked;
- `katana-strike.mp3` — quiz attempt, submitted (manually or on timer expiry);
- `war-drum.mp3` — quiz attempt, the countdown drops under a minute.

One mute preference (`src/lib/features/sound/sound.svelte.ts`) covers music and effects and is
remembered in `localStorage`. A missing file simply stays silent.
