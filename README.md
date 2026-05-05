# GIF Ranker

This folder now contains two iPhone-friendly versions:

- a static web app
- a no-hosting Scriptable app

## What it does

- Lets you choose your GIF files directly in the browser
- Builds an exact ranked top-`N` shortlist instead of fully sorting the GIFs you are going to cut
- Uses fewer comparisons for the `30 choose 20` use case
- Auto-saves the browser session on the same device so you can refresh and resume
- Exports the top GIFs themselves as a ZIP with numbered filenames so the order stays intact
- Copies the keep list and cut list filenames as a backup

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
5. If Safari gets sluggish, refresh and use `Resume saved session`.

## Lowest-friction hosting options

- Netlify Drop: drag the folder into [Netlify Drop](https://app.netlify.com/drop)
- GitHub Pages: push the folder to a GitHub repo and enable Pages
- Cloudflare Pages: upload the folder as a static site

## Notes

- The GIF files stay local in the browser.
- The web app now targets your exact top list first, which is usually a better fit than fully ranking all 30 GIFs.
- The top GIF export uses numbered filenames like `01-name.gif`, `02-name.gif`, so the order is preserved when you save or unzip it.
- Saved-session restore depends on browser storage support on that device.
- The Scriptable version avoids hosting entirely and works best if your GIFs are already in the Files app.
