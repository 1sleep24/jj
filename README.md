# GIF Ranker

This folder now contains two iPhone-friendly versions:

- a static web app
- a no-hosting Scriptable app

## What it does

- Lets you choose your GIF files directly in the browser
- Builds a full best-to-worst ranking with fewer comparisons than an all-vs-all tournament
- Highlights your top `N` picks, with `20` as the default
- Copies the ranked filenames so you can keep the order for posting

## Files

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `scriptable/GIF Ranker.js`

## Fastest iPhone option now

Use the Scriptable version in `scriptable/GIF Ranker.js`.

1. Install Scriptable on your iPhone.
2. Create a new script and paste in `GIF Ranker.js`.
3. Put your GIFs into one Files folder.
4. Run the script and choose `Pick a folder`.

See `scriptable/README.md` for the full flow.

## Hosted web app option

If you still want the browser version:

1. Upload the `gif-ranker` folder to a static host such as Netlify Drop or GitHub Pages.
2. Open the hosted URL on your iPhone in Safari.
3. Use Share -> Add to Home Screen if you want it to feel app-like.
4. Pick your GIFs from Files or Photos and start ranking.

## Lowest-friction hosting options

- Netlify Drop: drag the folder into [Netlify Drop](https://app.netlify.com/drop)
- GitHub Pages: push the folder to a GitHub repo and enable Pages
- Cloudflare Pages: upload the folder as a static site

## Notes

- The GIF files stay local in the browser session.
- Reloading the page clears the current ranking session.
- The Scriptable version avoids hosting entirely and works best if your GIFs are already in the Files app.
