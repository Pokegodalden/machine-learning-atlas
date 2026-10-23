# Machine Learning Atlas

An interactive mathematical studio with 80 algorithm explanations, ten runnable lessons, model comparisons and reproducible experiments. It runs in your browser with local model workers and bundled example data.

[Open the public preview](https://pokegodalden.github.io/machine-learning-atlas/).

This is the v2.2 public preview. Numerical and browser verification is documented; actual beginner testing and human screen-reader interpretation remain pending. See [release scope and limitations](RELEASE-CHECKLIST.txt) and the [beginner pilot packet](BEGINNER-PILOT.txt).

## Run locally

Use Node.js 24 or newer. The application needs no dependency installation.

```sh
cd atlas-app
node scripts/build.mjs
node scripts/serve.mjs
```

Open `http://127.0.0.1:8773/`. Keep `app-data`, `datasets` and `brand` beside `atlas-app`; the build verifies the seven frozen dataset checksums.

## Check correctness

```sh
cd atlas-app
node --test tests/*.test.mjs
```

The browser suites additionally require Playwright and an installed browser. See [the application README](atlas-app/README.md) for configuration and evidence. Automated DOM/contrast checks do not constitute accessibility certification.

## Save and share

Save named experiment settings through **Save & export**, then reopen them through **Saved**. **Copy experiment link** preserves compatible built-in or generated data revisions, parameters, seeds and evaluation settings. The recipient reviews and opens settings before explicitly running the model. Links include the experiment name and settings; imported CSV stays in portable Experiment JSON files.

Storage belongs to each browser origin. Export/import settings to move from localhost to the published site. Imported settings never become trusted fitted results; results are recomputed locally. Reserved final-check rows stay excluded from fitting and inspection.

## GitHub Pages

The Pages workflow validates numerical/state contracts, rebuilds the app and publishes `atlas-app/dist`. The initial source archive is a one-time transfer mechanism: the workflow expands the validated project, commits its source files and removes the archive from the current tree. Subsequent commits build the source normally.

The repository owner must select **GitHub Actions** as the Pages publishing source. Deployment status and its URL appear in the repository Actions and Pages settings.
