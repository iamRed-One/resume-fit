# Evaluations

Two separate things are measured, because they fail in different ways.

| | What it checks | Needs an API key | Cost |
| --- | --- | --- | --- |
| **Extraction eval** (`npm run eval:extract`) | Does the keyword extractor find the requirements a human would? | No | Free |
| **Live eval** (`npm run eval:live`) | Does the real model stay honest (no invented facts) on resume x posting pairs? | Yes | Roughly $0.10-0.20 per pair on the default model (an estimate, not measured) |

## Data

| Path | What | In git? |
| --- | --- | --- |
| `data/postings/` | 25 public job postings, 17 software and 8 other | No (employers' text; regenerate with `node evals/fetch-postings.mjs`) |
| `data/blind/` | 45 more postings, 31 software and 14 other | No (regenerate with `node evals/fetch-postings.mjs --blind`) |
| `data/labels.json`, `data/labels-blind/` | Hand-written key requirements per posting | Yes |
| `data/resumes/` | 6 **fictional** resumes (5 software, 1 sales) | Yes |
| `data/pairs.json` | 13 resume x posting pairs tagged `good`, `partial` or `poor` fit | Yes |

Postings come from Greenhouse's public board API, which companies publish for this purpose, across
about 18 employers. Software roles are weighted heavily on purpose. The postings are a snapshot; they
will differ if you refetch, and refetching shifts which postings are chosen.

No real person's resume is used anywhere.

## Extraction eval: results

`recall` = share of the hand-labelled key terms the extractor found in its top 30.
`precision@15` = share of its top 15 that map to a labelled term. Precision is understated, because
labels are incomplete: a legitimate term nobody labelled counts as a miss.

| Split | Postings | Recall | Precision@15 | How to read it |
| --- | --- | --- | --- | --- |
| Tune | 25 | 93% | 72% | The extractor was developed against these. Optimistic. |
| Dev | 23 | 94% | 73% | Labelled before the extractor saw them, then used to find mistakes. Optimistic. |
| "Sealed" | 22 | 87% | 62% | See below. |

Software only: 96% / 77% (tune), 96% / 75% (dev), 87% / 61% (sealed). Other fields on sealed: 87% / 65%.

### Why none of these numbers is a clean test

- **One labeller.** I wrote all labels, and the dictionary. Labels reflect my judgment of what matters.
- **Contamination.** The first blind result was 68% recall overall, 41% for non-software. I then
  expanded the dictionary using what I had read while labelling. That raised "sealed" to 87%, but I had
  read those postings too, so it is not a held-out measurement. **The honest figure is somewhere
  between 68% and 87%**, and likely nearer the lower end for fields the dictionary covers thinly.
- **The fix is fresh data.** Run `node evals/fetch-postings.mjs --blind`, label the new postings
  *before* running the extractor on them, and score once. Better still, paste your own real postings
  into the app and see whether the "missing" list looks right.

## Live eval

```bash
# bash / zsh
LIVE=1 npm run eval:live
# PowerShell
$env:LIVE="1"; npm run eval:live
```

It does nothing unless `LIVE=1` is set. Options: `LIVE_LIMIT=4` (default 4 of 13 pairs) and
`LIVE_TAG=run1`. The default four include two poor-fit pairs, as negative controls, because a tool that
quietly invents experience looks fine on good fits and only fails when there is a real gap.

It writes `out/live-<tag>.txt` and `.json` with, per pair: score before and after, edits kept /
reverted / needing review, **numbers or tools in the final resume that are not in the original**,
whether a poor-fit pair's score jumped suspiciously, and token spend with a cost estimate.

What good looks like: zero invented numbers or terms on every pair, no suspicious lift on poor fits,
and a clear score gain on good and partial fits. The measuring code itself is tested offline with a
fake model (`tests/live-core.test.ts`), including a model that invents a figure.

This cannot tell you whether the tailored writing is *good*, only whether it is honest. Read a few
outputs yourself.

## About public resume datasets

You asked whether a library of real submitted resumes exists to tune against. Three candidates, checked
on 2026-10-23. **None is downloaded or used here.**

| Dataset | Facts | Concern |
| --- | --- | --- |
| `cnamuangtoun/resume-job-description-fit` (Hugging Face) | Resume + posting pairs with fit labels, CSV, about 80 MB, about 21,500 downloads | No license declared, no dataset card, and a community thread asks where the data came from. Unknown whether the labels are human or generated |
| `datasetmaster/resumes` (Hugging Face) | MIT license, "real and synthetic" resumes, JSONL, about 100 MB | The card does not say where the real resumes came from or whether the people consented |
| Kaggle `snehaanbhawal/resume-dataset` | About 2,400 resumes in 24 categories, scraped from livecareer.com | Scraped; license unclear. The related CareerCorpus paper describes the same source |

Why that matters: resumes carry names, phone numbers and employer history. A dataset with unclear
provenance may contain real people's data shared without their agreement. If you use one, keep it
local, never commit or redistribute it, and treat it as personal data.

What it would be good for: checking whether this tool's match score *correlates* with a fit label
(the first dataset), or giving the parser more resume layouts to handle. What it would not do: this
project does not train or fine-tune a model. Claude is used as-is through the API, so there is nothing
to fine-tune. The things that are tuned are the prompt (`src/lib/tailor.ts`) and the extractor
(`src/lib/keywords.ts`, `skills.ts`), and the useful data for that is pairs like the ones here.
