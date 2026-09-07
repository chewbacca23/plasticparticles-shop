# Your logo on the site

The header, hero, and watermark all load **`/logo.svg`**. That file embeds **`public/logo.png`** so the crest still shows when the SVG is used as an image.

Those names must stay lowercase. Linux and Cloudflare treat `Logo.svg` and `logo.svg` as two different files.

## What is in the file now

Henrik’s crest with the red **SOUL SEARCHERS** banner, white dog, and lightning colours. Cropped from the chat PNG so the shield fills the frame (about 84×132 upscaled to 504×792). A real Illustrator SVG will still look sharper.

## If you send a better export

1. Overwrite **`public/logo.png`** with a bigger PNG, or send an SVG from Illustrator
2. If Illustrator exports a full A4 page, crop to the crest
3. Keep the public filename **`logo.png`** / **`logo.svg`** (not `Logo.svg`)
4. Rebuild or retry the Cloudflare deploy

Do not keep a second file named `Logo.svg` in `public/`.
