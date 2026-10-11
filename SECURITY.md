# Security policy

Clock It is the camera studio at [https://clockit.kv404.dev](https://clockit.kv404.dev). The source lives on `main` in [Kv-404/Clock-It](https://github.com/Kv-404/Clock-It).

## Supported versions

Only the current public release line gets security fixes. The live site tracks `main`.

| Version | Supported |
| --- | --- |
| 1.0.x | Yes |
| Older than 1.0.0 | No |

`1.0.x` is the version in `package.json` on `main`, published as the live site. There is no separate long-term support branch. Fixes land on `main` and ship with the next deploy of [clockit.kv404.dev](https://clockit.kv404.dev).

## Reporting a vulnerability

Report security issues privately. Please do not open a public GitHub issue, pull request, or discussion for a suspected vulnerability.

Use GitHub private vulnerability reporting:

[https://github.com/Kv-404/Clock-It/security/advisories/new](https://github.com/Kv-404/Clock-It/security/advisories/new)

If that form is unavailable, email [kv404@protonmail.com](mailto:kv404@protonmail.com) with the subject `Clock It security`.

Include:

- What is affected (the live site, a commit, or a version).
- What an attacker can do, and who is affected.
- Steps or a proof of concept that shows the issue.
- Whether you have already seen it used against someone else.

You should get a reply within 7 days. If the report is accepted, the next update will say what will change and when a fix is expected on the live site. If it is declined, the reply will say why.

Once a fix is deployed, you can publish your own write-up. Please wait for that deploy, or for an explicit go-ahead, before you post details publicly.

There is no bug bounty.

## In scope

- The Clock It site, including sign-in, the gallery, and saved photos and videos.
- The `/api/media` function that serves private captures.
- Secrets handling in this repository and in the production build. The service role key and `.env` must never be exposed to the browser or committed.

Test only with accounts and captures you own. Do not access, modify, or delete another person's data. Do not try to interrupt the site for other people.

## Out of scope

- Supabase, Vercel, Google, browser, or dependency bugs that are not a flaw in this app's use of them.
- Missing hardening with no demonstrated impact.
- Social engineering, physical attacks, and volumetric denial of service.
- Reports that need a stolen service role key, a leaked `.env`, or access to the hosting dashboard.

## Safe harbor

Good-faith research that follows this policy will not be pursued legally. Stay inside the rules above, stop if you reach another person's data, and report what you found instead of continuing.
