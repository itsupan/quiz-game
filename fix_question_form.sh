sed -i 's/aria-label="Remove option"/aria-label="Remove option"/g' src/lib/features/questions/QuestionForm.svelte

# Remove the document.querySelector block from correctIndex initialization
sed -i '/if (typeof document !== '"'"'undefined'"'"') {/,/}/d' src/lib/features/questions/QuestionForm.svelte

# Add aria-label to the text inputs for options
sed -i 's/<input type="text"/<input type="text" aria-label="Option {index + 1}"/g' src/lib/features/questions/QuestionForm.svelte

# Add aria-label to the Image and Audio selects
sed -i 's/name="imageMediaId"/name="imageMediaId" aria-label="Image"/g' src/lib/features/questions/QuestionForm.svelte
sed -i 's/name="audioMediaId"/name="audioMediaId" aria-label="Audio"/g' src/lib/features/questions/QuestionForm.svelte

