# UX writing

Purposeful → concise → conversational → clear. Edit in that order. Use the product's existing voice and terms; ask for a voice chart if none exists and the job is large.

## Patterns

| Element | Pattern | Example |
|---|---|---|
| Button / CTA | verb + object, 2-4 words | "Save draft", "Start free trial" — not "Submit", "OK", "Learn more" ×5 |
| Title | what this is / what you can do, 3-6 words | "Choose a plan" |
| Inline validation | `[Field] [requirement]`, on blur | "Email needs an @" |
| System error | `[What failed]. [Likely cause]. [What to do].` | "Couldn't save. You're offline. Changes will sync when you reconnect." |
| Blocking error | `[What's blocked]. [Why]. [Action].` | "Update required. This version stopped working. Update to continue." |
| Permission ask | `[Benefit]. [Permission].`, at first use | "Get notified when it ships. Turn on notifications." |
| Success | confirm + next step, short | "Invoice sent. View it in History." |
| Empty state | why empty + one action | "No projects yet. Create your first project." |
| Destructive confirm | name the object + consequence; button repeats the verb | "Delete 'Q3 report'? This can't be undone." → [Delete report] [Cancel] |
| Notification | 10-15 words title+body, actionable | |

## Never

Error codes without meaning ("Error 403"), blame ("invalid input", "illegal"), robot voice ("An error has occurred"), dead ends, vague cause ("Something went wrong") without a next step, humor in errors, placeholder text as the only label, "click here".

## Benchmarks

- Sentences ≤ 14 words in UI (≈90% comprehension), ≤ 25 hard limit; instructions ≤ 20 words.
- Buttons ≤ 25 chars; titles ≤ 40-50 chars; line length 40-75 chars.
- Reading level: general public ~grade 7-8; pro tools 9-10.
- Sentence case for UI text unless the product style says otherwise. Numbers as digits. Present tense, active voice, "you".

## Accessibility in copy

Link text makes sense out of context. Don't rely on direction/shape ("click the green button on the right"). Expand abbreviations on first use. Error text explains the fix, not only the color/icon. Alt text = purpose of the image, not "image of".

## Localization

Leave ~30-40% expansion room (German, Polish run long). No concatenated strings; ICU plurals (Polish has one/few/many). Dates/numbers via `Intl`.
