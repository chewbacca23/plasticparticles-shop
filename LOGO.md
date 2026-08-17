# Your logo on the site

Drop **your** logo into `public/` and the site picks it up automatically.

## Easiest

1. Save your logo as **`public/logo.svg`** or **`public/logo.png`**
2. If you use PNG, open `src/site.config.ts` and set:
   ```ts
   logo: '/logo.png',
   ```
3. Rebuild: `npm run build`

## Tips for a subtle background look

- **SVG or PNG with transparent background** works best.
- Square or circle marks look great as the faint watermark.
- Very busy logos: lower opacity in `src/site.config.ts`:
  ```ts
  logoWatermarkOpacity: 0.05,  // try 0.04 – 0.10
  ```

## Where it appears

| Place | How |
| --- | --- |
| Header | Small mark next to the site name |
| Every page | Large, soft watermark (easy on the eyes) |
| Hero | Slightly stronger glow behind the headline |

Replace `public/logo.svg` — no code changes needed if you keep that filename.
