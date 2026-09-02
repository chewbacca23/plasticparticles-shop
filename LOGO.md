# Your logo on the site

The header, hero, and watermark all load **`/logo.svg`** (lowercase).

That filename must stay **exactly** `public/logo.svg`. Linux and Cloudflare treat `Logo.svg` and `logo.svg` as **two different files**. If both exist, the site keeps the placeholder.

## What is in the file now

`public/logo.svg` is the shield crest, cropped from the Illustrator A4 export (`viewBox="244 50 96 122"`). The original artboard was a full page with the mark in the corner — without that crop the logo looks like a tiny stamp on empty paper.

## If you re-export from Illustrator

1. Overwrite **`public/logo.svg`** (not `Logo.svg`)
2. If the export is a full A4 page again, crop the viewBox to the crest, or export only the artwork
3. Rebuild (`npm run build`) or retry the Cloudflare deploy

Do not keep a second file named `Logo.svg` in `public/`.
