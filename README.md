# Clock It

Clock It is a browser camera studio. You can try filters without an account. Sign in only when you save a photo, record a video, or open your gallery.

The live site is [https://clockit.kv404.dev](https://clockit.kv404.dev). The current release is **1.0.0**. See [CHANGELOG.md](CHANGELOG.md) for what each version includes, and [SECURITY.md](SECURITY.md) for supported versions and how to report a vulnerability.

## Run it locally

```bash
npm install
cp .env.example .env
npm run dev
```

Put your own Supabase project URL and publishable key in `.env`. Do not commit that file. The names are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

`npm run build` makes the production site in `dist`.

## What you need in Supabase

The SQL in `supabase/setup.sql` creates the `captures` table, row rules, and a private `captures` storage bucket. Saved files are served from this site at `/media/...`, not from a public storage link. The server needs `SUPABASE_SERVICE_ROLE_KEY` in the host environment. That key never belongs in the browser or in git.

Email sign-in works after you turn it on in the Supabase project. Google sign-in also needs a Google web client, with the redirect `https://<project-ref>.supabase.co/auth/v1/callback`.

## Controls

- Tap the filter name to open the list. Each tile is a live preview from the camera.
- Hands, Face, and Full change what the effect follows.
- In Face mode, blink both eyes to move to the next filter.
- Pinch still changes the filter in Hands mode.
- The **···** button holds theme, background, grid, timer, lock, and mic.

## License

MIT. See [LICENSE](LICENSE).
