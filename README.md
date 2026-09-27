# Known Good Media

Recruiting highlight and hype videos for high school athletes in every sport. **Get Known.**

This repo holds the business website and the brand files.

## What's here

| Path | What it is |
|---|---|
| `index.html` | The one-page website (packages, how it works, portfolio, booking) |
| `assets/css/styles.css` | Site styles and brand color tokens |
| `brand/` | Logo files, SVG (scalable) and PNG exports, plus the brand guide |
| `tools/make_logos.py` | Script that regenerates every logo file from the fonts |

## Hosting on GitHub Pages (free)

1. In this repo on GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, set Source to **Deploy from a branch**, pick `main` and `/ (root)`, then **Save**.
3. The site is live at **https://knowngoodmedia.com** (custom domain set under **Settings → Pages**, DNS at Porkbun).

## Still to fill in

Search the site for `[` to find every placeholder:

- `[PRICE]` and `[#]` in the packages
- `[YOUR EMAIL]` on the booking button
- `[REEL 1–3]`: swap in YouTube or Hudl embeds once you have portfolio reels
- Social links assume the handle `@knowngoodmedia`. Update them if you claim a different one.
