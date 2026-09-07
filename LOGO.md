# Your logo on the site

- **Header / favicon:** `/logo.svg` (embeds `public/logo.png`)
- **Big faint backdrop:** `/logo-watermark.png` (soft, pre-blurred so the crest does not look pixelated when huge)

Those names must stay lowercase. Linux and Cloudflare treat `Logo.svg` and `logo.svg` as two different files.

## What is in the file now

Henrik’s crest with the red **SOUL SEARCHERS** banner, white dog, and lightning colours. Cropped from the chat PNG so the shield fills the frame (about 84×132 upscaled to 504×792). A real Illustrator SVG will still look sharper in the header.

The watermark is a separate soft PNG (upscaled + blurred) so the background mark reads as atmosphere instead of blocky pixels.

## If you send a better export

1. Overwrite **`public/logo.png`** with a bigger PNG, or send an SVG from Illustrator
2. If Illustrator exports a full A4 page, crop to the crest
3. Keep the public filename **`logo.png`** / **`logo.svg`** (not `Logo.svg`)
4. Re-generate **`public/logo-watermark.png`** from the new crest (or ask the agent to) so the backdrop stays soft
5. Rebuild or retry the Cloudflare deploy

Do not keep a second file named `Logo.svg` in `public/`.
