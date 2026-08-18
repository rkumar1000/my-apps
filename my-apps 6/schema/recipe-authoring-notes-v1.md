# Recipe JSON — Authoring Notes (v1, development)

These are conversion rules for turning a real-world recipe into the schema — judgement calls that live in *how you author* each recipe file, not in the schema itself. Keeping them here (rather than as extra schema fields) is what keeps the schema small and stable.

## Core principle
Fixed structure only for what every recipe shares (title, ingredients, steps). Flexible labelled arrays (`times`, `notes`) for everything that varies in shape. Optional fields simply get omitted when they don't apply — never populated with `null`, `""`, or `"n/a"`.

## Conversion rules

**Missing/inapplicable fields** — leave the key out entirely. A drink recipe with no prep/cook time just has no `times` array, rather than an empty one.

**Storage/keeping info found inside a method step** — pull it out into a `notes` entry labelled `"Storage"`, rather than leaving it buried in step text.

**Ad-hoc or vague yield units** (e.g. "1 pitcher") — capture literally in `yield.unit` as free text; if it'd help the reader, add a `notes` entry with a practical guess ("makes roughly 1.5–2L, serves 6–8 over ice").

**Ratio-only drink recipes** ("2 parts gin, 1 part vermouth") — reverse-engineer to real measurements at a stated glass/batch size when authoring. The schema always expects real quantities; there's no ratio mode.

**Vague quantities** ("a pinch", "a splash", "a knob") — treat as countable units, same as garlic cloves. They scale fine with the batch multiplier (2 pinches at 2× is sensible). Only omit `amount`/`unit` for genuinely free-text "to taste" items with no real quantity at all.

**Ingredient substitutions/alternatives** ("fish sauce, or vegetarian alternative") — stays as descriptive text in the ingredient `name`. Doesn't need its own field.

**Timer naming** — always name the *thing*, not the action: "Roast Jersey Royals", "Reduce sauce" — never "Oven" or "Stovetop". Essential once a recipe has more than one timer running.

**Equipment** — only becomes its own array when 2+ distinct tools are genuinely worth flagging up front (shaker, jigger). A single passing mention stays in the step text.

**Fermentation tracker** — only for genuine ferments (kimchi, sauerkraut, pickles). Everything else — including things that improve overnight or spoil fast, like a curry — gets a plain `notes` entry instead. The tracker earns its visual weight specifically because fermentation timing is genuinely non-obvious; using it elsewhere would be information overload.

**Recipe variations** — use the `variations` array for named alternative versions a source explicitly offers. Also fine to add one during conversion if an obvious swap is worth surfacing, even if the source didn't call it out as a formal "variation" section.

**Steps stay a single flat, ordered array** in the sequence the source naturally describes — even for interleaved multi-component recipes (sauce + potatoes + tomatoes). Use the optional `component` tag purely for display grouping. Only use `after` for a genuine hard dependency — not as a general sequencing mechanism.

**Attribution** — `author` is the original source; `adaptedBy` is you, when you've changed it meaningfully. Either can appear alone.

**Category badge** — `category` is a single short display word ("Ferment", "Dish", "Drink"), not the full multi-dimensional classification (cuisine/dietary/difficulty) discussed separately — that's a bigger, still-undecided future addition. Don't overload this field with more than one value.

**Fermentation stage wording** — keep `label` to 2-3 words (it renders inside a coloured chip, so long sentences will look cramped); put the fuller explanation in the optional `description` field instead, which appears in the status line above the gauge.

**Component badges are now genuinely visible**, not just internal bookkeeping — a step's `component` renders as a small coloured tag above it. Worth adding to any recipe with real interleaved components (sauce/potatoes/tomatoes running in parallel); skip it for simple single-track recipes where every step is already sequential.

## Deliberately deferred (not in v1)
- **Images** — still deferred as of this pass. A live thumbnail test was planned, but this environment doesn't currently have an image-generation tool available, so nothing was added to the schema speculatively. Revisit once either a real image source or generation tool is actually in hand.
- **PWA / offline caching / update detection** — hold until the shell and JSON schema are locked and a handful of real recipes are in place. Adding caching while the shell is still actively changing just fights the workflow.
