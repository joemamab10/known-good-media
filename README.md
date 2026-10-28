# Known Good Media

Recruiting highlight and hype videos for high school athletes in every sport. **Get Known.**

This repo is the public website at **https://knowngoodmedia.com** (GitHub Pages, DNS at Porkbun) plus the parent portal and brand files. It has to stay **public**, because free GitHub accounts can only publish Pages from public repos. Never commit client film, photos, coach lists, receipts or keys here. The reel tools live in the private `known-good-studio` repo.

## What's here

| Path | What it is |
|---|---|
| `index.html` | The one-page site: reels, our why, packages, outreach add-on, youth line, how it works, FAQ |
| `privacy.html` | Privacy policy (**draft**: fill the highlighted blanks, then remove the `noindex` line and link it in the footers) |
| `404.html` | "This page is unknown" error page |
| `assets/css/styles.css` | Site styles and brand color tokens |
| `assets/video/hero-loop.mp4`, `assets/img/hero-poster.jpg` | Homepage hero loop, built by `reelbuilder.heroloop` in the studio repo |
| `assets/docs/reel-guide.pdf` | Filming guide for parents |
| `assets/fonts/` | Anton, Barlow, Barlow Condensed (SIL Open Font License) |
| `portal/` | Parent portal: ordering, uploads, Stripe payment, order tracking. Setup in [`portal/SETUP.md`](portal/SETUP.md) |
| `portal/config.js` | Packages, prices, Stripe Payment Links, outreach add-ons, contact email |
| `portal/supabase/` | Database schema and migrations, email templates, Stripe webhook function |
| `brand/` | Logos (SVG and PNG), watermark, avatar, banner, sticker. Rules in [`brand/README.md`](brand/README.md) |
| `tools/make_logos.py` | Regenerates every logo file from the fonts in `tools/fonts/` |

## Making changes

- **CSS changes:** bump `styles.css?v=` in `index.html`, `privacy.html` and `404.html` together so browsers load the new file.
- **Portal changes:** bump the `?v=` on the changed file in `portal/index.html`.
- **New reel on the site:** add a `work-card` in the `#work` section of `index.html` (copy an existing one and change the YouTube ID and caption). Reels show as a thumbnail and load the YouTube player only when tapped. Only add athletes whose family has OK'd it.
- **Prices:** change them in both `index.html` and `portal/config.js` (plus the Stripe product).
- **Database changes:** new `.sql` files in `portal/supabase/` are run by hand in the Supabase SQL editor.

Push to `main` and the site updates in about a minute.
