# Fermentation & Recipe Widget — Design Principles (v1, development)

A high-level summary of the decisions made so far, grouped into three levels. Not exhaustive — see `recipe-authoring-notes-v1.md` for the detailed conversion rules this sits above.

---

## 1. App requirements — what this is for

- **A recipe should feel like a companion through cooking, not just a reference.** Batch scaling, timers, and the fermentation tracker are what make this genuinely better than a PDF — not the recipe text itself.
- **One shell serves every recipe.** A ferment, a multi-component dish, and a simple drink should all run through the same page design — no bespoke layout per recipe.
- **Not every feature applies to every recipe, and that's fine.** The fermentation tracker is only shown for genuine ferments. A simple recipe just gets a plain storage note. Adding a feature everywhere "for consistency" would create noise, not polish.
- **Mobile-first, but not mobile-only.** Primary use is a phone in the kitchen; the layout should still hold up cleanly on a laptop.
- **No accounts, no backend, no centralised data — deliberately.** This is a personal/small-group tool. Everything that changes while cooking (progress, timers, batch state) lives only on the device being used. That's a feature, not a limitation, for what this is.

## 2. Development & coding principles — how we build it

- **One shell, never a page per recipe.** If a new recipe needs a new page design, something has gone wrong — it should just need a new JSON file.
- **Recipe content lives in JSON; presentation lives in the shell.** These are never mixed. The shell doesn't hardcode recipe facts; the JSON never carries styling or layout instructions.
- **Fixed schema fields only for what's common to (nearly) every recipe** — title, ingredients, steps. **Flexible, labelled lists for everything that varies in shape** — times, notes — rather than adding a new named field every time a new recipe shape shows up.
- **Omit, don't leave blank.** A field that doesn't apply to a recipe is left out entirely — never `null`, `""`, or `"n/a"`.
- **Judgement calls belong in authoring conventions, not in the schema.** How to convert a messy real-world recipe into clean data is a documented rule of thumb, not a new field. This keeps the schema small and stable while still handling real-world variety.
- **Restraint over completeness.** Add emphasis, structure, or a new feature only where it genuinely helps successful cooking — not everywhere it's technically possible. (Example: bolding key measures in method text; not bolding every number.)

## 3. Architecture & technical principles — how it's actually built

- **Static files only.** HTML, CSS, JS, and JSON — no server, no build step, no framework. Hosted as plain files on GitHub Pages.
- **One generic shell page reads any recipe's data and renders it.** Recipes are data files, not code — adding a recipe means adding a JSON file, never editing the shell.
- **All in-session state is local to the device and browser.** Batch tracking, timer progress, ticked-off steps, ingredient shopping status (have/check/buy) — all saved via the browser's own local storage, scoped per recipe so different recipes never collide with each other's saved state.
- **Offline/installable behaviour (PWA) is deliberately deferred** until the shell and schema are stable. Adding offline caching while the shell is still changing would only get in the way of testing.
- **Formatting decisions (bolding measures, lightening substitution text) live entirely in the renderer.** They never require a new data field — the same JSON looks right whether or not a given formatting rule exists yet.
