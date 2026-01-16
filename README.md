# Serper Search Console

An internal tool for running many high-quality Google searches against the Serper API, curating results, and preparing final link lists for enrollment marketing questionnaires. The project includes a polished client-side workflow for parsing “Q-coded” questions, batching Serper calls, fine-tuning individual answers, and packaging everything for deployment on AWS Lambda.

## Table of Contents

1. [Key Features](#key-features)
2. [Tech Stack](#tech-stack)
3. [Getting Started](#getting-started)
4. [Configuration](#configuration)
5. [Running Locally](#running-locally)
6. [Using the App](#using-the-app)
7. [Deploying to AWS Lambda](#deploying-to-aws-lambda)
8. [Project Structure](#project-structure)
9. [Troubleshooting](#troubleshooting)

---

## Key Features

- **Q-Code Parsing** – paste raw questionnaire text and automatically extract question blocks (ignoring a configurable set of codes such as `Q1–Q4` & `Q10`).
- **Audience-aware search selections** – pick specific answers and audiences, or open advanced controls to set per-answer audiences.
- **Batched Serper API calls** – selections are chunked (`MAX_SELECTIONS_PER_REQUEST`) to maintain result quality when many searches run in parallel.
- **Rerun modal** – re-run an individual answer with a custom query override that bypasses the university domain filter.
- **Final results workspace** – grouped by question, each answer has:
  - Preview dropdown of all URLs returned by Serper.
  - One-click manual link button that opens a modal to override the URL.
  - Inline rerun button.
  - Copy-ready summary list for bulk transfer into docs or CRM notes.
- **AWS Lambda bundle** – `build-lambda.sh` assembles a production zip under `dist-lambda/serper-search-console.zip` with only runtime dependencies.

## Tech Stack

- **Backend**: Node.js + Express, EJS templating, Axios, serverless-http (for Lambda wrapper)
- **Frontend**: Vanilla JS + HTML + custom CSS (no framework)
- **Search API**: [Serper](https://serper.dev/) (Google Search JSON API)
- **Deployment Target**: AWS Lambda + API Gateway (zip bundle)

## Getting Started

### Prerequisites

- Node.js 18+ (the Lambda runtime target)  
- npm 9+  
- Serper API key (create one at [serper.dev](https://serper.dev))

### Install Dependencies

```bash
git clone https://github.com/dawsonl1/halda-serper.git
cd halda-serper
npm install
```

## Configuration

Create a `.env` file in the project root (copy the provided sample if needed):

```bash
cp .env .env.local   # optional backup
```

Required variables:

```env
SERPER_API_KEY=replace-with-your-key
PORT=3000            # optional, defaults to 3000
```

> **Security tip:** keep your real key out of source control. The committed `.env` file is a placeholder; use environment-specific secrets for staging/production.

## Running Locally

```bash
npm run dev
# or npm start for a non-reloading server
```

Then open `http://localhost:3000`.

## Using the App

1. **Paste raw Q-coded text** and a school name (and optional university site) into the form, then click **Parse Questions**.
2. **Select answers** you want to research. Optionally assign specific audiences per question or per answer.
3. Click **Run Serper**:
   - Requests are split into batches of `MAX_SELECTIONS_PER_REQUEST` (currently `4`) so the Serper API returns fresh results across all selections.
4. **Review grouped results**:
   - Use dropdowns to pick the correct URL per answer.
   - Click **Manual link** → enter a URL → the row updates instantly with your override and highlights as “new”.
   - Click **⟳** to rerun a single answer. Supplying a custom query removes the domain filter for that rerun only.
5. Use **Copy final results** to copy labels + selected URLs (one per line) for downstream workflows.

## Deploying to AWS Lambda

The project includes a build script that creates a production-ready zip with only runtime artifacts and dependencies.

```bash
npm run build:lambda
```

This executes `build-lambda.sh`, which:

1. Rebuilds the `dist-lambda/` directory.
2. Copies controllers, public assets, routes, views, `index.js`, package manifests, and `.env`.
3. Runs `npm install --only=production` inside `dist-lambda/`.
4. Copies the `lambda/` folder (serverless handler boilerplate).
5. Produces `dist-lambda/serper-search-console.zip`.

You can then upload the zip to Lambda (or S3 + Lambda) and point API Gateway to `lambda/handler.js`, which wraps the Express app using `serverless-http`.

## Project Structure

```
halda-serper/
├── controllers/
│   └── searchController.js      # parsing + Serper integration logic
├── public/
│   ├── app.js                   # all client-side logic & UI behaviors
│   ├── styles.css               # custom styling
│   └── assets/                  # logos & icons
├── routes/
│   └── searchRoutes.js          # Express router exposing parse/search endpoints
├── views/
│   └── index.ejs                # single-page UI shell
├── lambda/
│   └── handler.js               # AWS Lambda entrypoint (serverless-http)
├── build-lambda.sh              # packaging script
├── index.js                     # Express bootstrap
├── package.json / package-lock.json
└── README.md (this file)
```

## Troubleshooting

| Issue | Fix |
| --- | --- |
| `SERPER_API_KEY environment variable is not set.` | Ensure `.env` exists and `SERPER_API_KEY` is defined. Restart `npm run dev` after updating. |
| “Missing or invalid rawText” error when parsing | Ensure the textarea contains Q-coded lines like `Q5: Question text` followed by `Q5A: Option text`. |
| Lambda deploy fails due to bundled dev dependencies | Always run `npm run build:lambda`; it runs `npm install --only=production` within the bundle. |
| Lambda request times out when many searches run | Increase the AWS Lambda **timeout** (e.g., 120–140 seconds) so batches of Serper API calls can complete; the UI blocks until all batches finish. |

## Contributing

Internal use only. Open pull requests on `main` with:

1. Clear summary (small PRs preferred).
2. Screenshots or screen recordings for UI changes.
3. `npm run build:lambda` output (ensures Lambda bundle stays in sync).

## License

ISC © Dawson Pitcher
