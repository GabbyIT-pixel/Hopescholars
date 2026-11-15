# Git workflow (feature branches and pull requests)

The course rubric rewards a public repo whose history shows steady work: regular, descriptive commits, feature branches, and pull requests merged into `main`. Use this routine for every change. Never rewrite or fake history.

## One change, one branch, one pull request

```bash
git checkout main
git pull                                   # start from the latest main
git checkout -b feature/short-name         # e.g. feature/signed-in-video-tour
# ...make the change, run the tests...
npm test
git add -A
git commit -m "Describe what changed and why"
git push -u origin feature/short-name
```

Then on GitHub: **Compare & pull request**, write a clear description (what, why, how it was tested), press **Create pull request**, then **Merge pull request** and **Delete branch**. Back in the terminal:

```bash
git checkout main
git pull
```

## Good commit messages
- Say what changed: `Show the video tour only to signed-in users`.
- Not: `update`, `fix`, `changes`.
- Small commits, made as you work, are better than one big commit at the end.

## Pull request description template
```
## What
One or two sentences.

## Why
Which SRS requirement or rubric item it supports.

## How I tested it
npm test (all pass) and what I clicked.
```

## Branch names used in this project
- `feature/signed-in-video-tour`: video tour visible only after sign-in.
- `docs/submission-checklist`: updated submission checklist and this workflow guide.
- `docs/live-deployment`: live URL and deployment notes, after deploying on Render.
