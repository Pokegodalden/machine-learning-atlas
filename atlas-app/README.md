# Machine Learning Atlas v2.2

An independent mathematical studio edition, based on v2.1. The original app, its build and its saved browser data are preserved. This edition has its own source, canonical content, build, preview port and downloadable archive.

## Run locally

Use Node 24 or newer from `atlas-app/`:

```powershell
npm run build
npm test
npm start
```

No dependency installation is needed for the application. Open http://127.0.0.1:8773/?v=2.2#/lesson/linear-regression. The preserved v2.1 preview remains on port 8772, and v2.0 on port 8771; the original app remains on port 8770. Stop your server with Ctrl+C. Serve over HTTP: JavaScript modules and workers require it. The supplied `dist/` directory can be hosted independently as a static site.

Keep `app-data/`, `datasets/` and `brand/` beside `atlas-app/` when rebuilding. The build verifies all seven frozen dataset checksums. No CDN, backend or account is required.

## Ambient contour background

A decorative canvas continuously redraws a slowly changing scalar-field contour map. Neighboring contour segments are joined and smoothed. Rendering targets thirty background frames per second in an OffscreenCanvas worker, with an optimized main-thread fallback, a 64 × 48 cell grid and about 2.4 million canvas pixels. Charts and the featured lesson retain opaque backgrounds for clear reading.

Three gold cursor points represent successive contraction steps toward the pointer in a rotated positive-definite quadratic well. They retain the native cursor, never capture input, hide during presses/drags and viewport exit, and fade when idle. Touch movement does not produce a mouse trail. The field may bend slightly beneath a moving cursor. This decorative effect does not read or change lesson data or model parameters.

Reduced motion displays static contours and hides cursor tracking. Hidden tabs and suspended pages stop animation; returning resumes it. Routes reuse the same two decorative layers. `ambient-contours-browser-validation.json` checks evolving pixels, converging iterates, input transparency, touch behavior, responsive sizing, pixel limits, preferences and page lifecycle behavior.

## Corrected illustrations and scroll motion

Regression illustrations use a least-squares line computed from the fixed illustrative observations. Every residual is a vertical segment from an actual observation to the current line. PCA uses the dominant covariance eigenvector through the sample mean; perpendicular projections are recomputed for every candidate direction. Intermediate fit-progress frames interpolate toward these computed endpoints. This small illustrative cloud is separate from the real lesson datasets and numerical fitting adapters.

The same geometry is used in the slideshow, journey cards, lesson index, catalog icons and relationship previews. All eighty algorithm icons animate when first entering view and replay on hover or keyboard focus. Family symbols draw their paths; regression/PCA interpolate their geometry. Offscreen or detached animations stop. Headings, subtitles and content blocks receive a short upward fade as they enter view, without moving chart/control ancestors or changing document layout. Focus exposes pending content immediately. Reduced-motion preferences show final geometry and static, visible content.

`art-motion-browser-validation.json` verifies rendered geometry at five progress values, all shared instances, animation support on eighty catalog entries, filtered replacements, scrolling, keyboard controls, narrow widths and reduced motion. Five independent algebraic checks in `tests/art-geometry.test.mjs` verify least-squares normal equations, principal covariance direction, vertical residuals and orthogonal projections.

## Small interactions in v2.2

- Three separately animated SVG contours follow the approved logo; the original PNG is also retained. Hover or keyboard focus separates the contours, with a still reduced-motion fallback.
- Numeric parameter values support horizontal scrubbing, Shift for fine adjustment, normal typing, existing keyboard controls and a range-position arc. Changes use the existing validation and settings history.
- Linear regression links equation terms to a slope triangle and intercept marker. A faint previous displayed line lingers briefly during coefficient edits, then clears.
- Linear regression’s “Make a guess” disclosure opens the candidate-line chapter when needed. Place a gold diamond by clicking the chart or using the numeric/range input, then reveal the current equation’s prediction. A settings or selected-observation change clears the guess. Only training/validation observations are used. Guesses are local teaching state, not evaluated model results.
- Related algorithm explanations include paired schematic previews on hover, keyboard focus, or the touch-friendly connection button; Escape dismisses them.
- “Save idea” stores a validated catalog ID in this origin’s local browser storage. Saved ideas and removable links appear alongside the experiment library. Bookmarks and successful experiment saves draw a quiet confirmation stroke; storage failures report an error.

## The v2.2 interface

The Explore slideshow crossfades through ten real lesson links every three seconds. Each diagram has a small schematic instrument: fit a line, grow a neighborhood, move a threshold/split/center, inspect a tree or hidden unit, adjust a margin, fit the PCA direction, or trace a route. Drag the diagram or use the native slider; autoplay suspends while manipulating it or while a lesson link has keyboard focus, and resumes after interaction. These previews never claim to be trained results. Combined arrows, indicators and the counter remain available. Reduced motion uses instant slide changes. The hero enters on each Explore visit; the brand motto and version-only footer are retained.

The learning-signal graph uses a wider 915px desktop canvas (about 1.5 times its former 610px width) and a responsive layout on narrow screens. Select a node to filter actual catalog entries; drag to arrange nodes, reset the arrangement, inspect tagged counts/examples, and open an explanation. Keyboard arrows move focus and Enter/Space apply the filter. Sidebar filtering and resizing keep the graph selection synchronized. Counts describe overlapping learning types.

- Explore opens with three learning journeys: How do models make predictions?, How do models represent data?, and How does a model learn?. Each includes seven existing lessons; membership overlaps intentionally. Choosing a journey filters the ten visual lessons while retaining the eighty-entry reference catalog and all its filters.
- Ten distinct SVG illustrations explain each algorithm's geometry. Artwork is labeled schematic and never claims to be a computed fit. Hover/focus motion is brief and disabled under reduced motion.
- The contour logo's curves inform the featured illustration. Dark ink, ivory serif type, cyan observations, gold quantities and green intercept cues retain the established identity.
- Every lesson presents a question and always-visible data origin. Four teaching steps and full explanation remain available. Data/View tools and secondary diagnostics retain native disclosures.
- Focus view is an explicit per-lesson choice. It reduces introductory chrome and pins a compact chart on narrow screens while editing the original controls; Exit focus restores teaching navigation. No automatic scrolling is added to fit completion.
- Equations retain their numerical control links. Focusing slope/intercept emphasizes their actual line geometry. Native sliders have meaningful ticks, including logarithmic scale explanations, aligned numeric fields and clearer labels.
- Result evidence distinguishes ready, running, earlier, current, canceled and failed work. Compatible completed fits can report an actual metric difference on the same dataset revision and protocol. These comparisons are transient in this page; unavailable results are never filled in. Logistic evidence uses the visible threshold without retraining; different thresholds have separate comparison contexts. Cluster inertia includes its interpretation limitation.
- Narrow comparison offers A, B or both stacked charts. A sticky summary retains both current metrics and their measured difference. Switching view preserves shared axes, fitted runs and linked observation. Desktop retains two panes.

The direction draws on TensorFlow Playground's grouped experiment controls, Distill's mathematical stage and Seeing Theory's visible lesson progression. It retains the approved contour-A logo, dark canvas, mathematical serif type and restrained cyan/gold/green marks. These are interface references; the app uses its own implementation.

## Included functionality

All ten existing lessons remain: linear regression, k-nearest neighbors, logistic regression, decision trees, random forests, SVM, K-means, PCA, a small neural network and Q-learning. Six classifiers support paired comparison; a separate K-means comparison links unlabeled observations. Five guided activities, training workers, actual metric calculations, stale-result safeguards, cancellation, measured timing studies, parameter history and named experiments are retained.

Data tools generate bounded task-compatible datasets or import UTF-8 CSV up to 256 KiB, with 80–400 records and 2–12 columns. Existing mapping, numeric/binary category and fitting-row-only preprocessing rules remain. Portable experiment JSON, results JSON, output CSV and standalone chart SVG exports remain available. Reserved final-check rows stay excluded from fitting, inspection and prediction exports.

Browser storage is scoped to the preview origin. Version 2.2 on port 8773 starts with its own Saved library; export Experiment JSON from version 2.1 and import it under Saved in version 2.2 to transfer configurations. Opening and running recomputes from matching data and adapters. Existing computed models and transient notes are not transferred automatically.

## Validation

The supplied build passes 298 numerical/state, illustration-geometry and experiment-sharing tests. Final browser counts and preservation evidence are recorded in `v22-validation.json`.

`unit-validation.txt` records the numerical/state suite. `browser-batch-validation.json` records the latest successful result per suite and the provenance of full and targeted runs. `explore-comments-browser-validation.json` checks the five requested Explore changes, including autoplay/pause/resume, reduced motion, keyboard interaction, graph dragging/filtering and responsive navigation. `v22-browser-validation.json` covers the new layout at 320, 390, 768 and 1440 pixels, real fits, equation-to-control focus, observation inspection and both comparison tasks. `fit-scroll-browser-validation.json` covers fit completion and viewport/focus preservation. `v22-validation.json` aggregates the final evidence, including preservation hashes for both prior builds.

The full browser suite requires Playwright and a local Edge installation. Set `MLA_PLAYWRIGHT_MODULE` and optionally `MLA_BROWSER_EXECUTABLE` for your machine, start this preview, then run:

```powershell
node scripts/verify-all.cjs
```

The runner uses one shared browser process with isolated contexts. It does not change Windows security policies.

This is a separate UI edition. These UI checks are not a full accessibility certification. A full screen-reader/accessibility audit, controlled performance acceptance, beginner pilot and public deployment remain pending. Mathematical fonts fall back to installed serif fonts; no third-party font is fetched.

## Contour performance update (2026-10-24)

The decorative field targets 30 fps in an OffscreenCanvas module worker. Reusable typed buffers and integer grid-edge joins replace per-cell arrays and string-keyed path maps; basin trigonometry is shared across vertices. Drawing follows accumulated deadlines aligned with animation frames, with a timer path where worker animation frames are unavailable. The three cursor points run independently at the display refresh rate while active, with faster attraction and coalesced pointer messages. The cursor loop stops when inactive.

Unsupported browsers and worker startup/runtime failures use the same optimized renderer on the main thread. Transferred canvases are replaced safely for recovery. Reduced motion renders a static field; hidden and parked pages suspend work. The 64 by 48 cell and 2.4 million backing-pixel caps remain. Background workers reduce contention but still consume CPU and power; a 30 fps cap limits that cost.

`contour-performance-validation.json` compares the previous renderer, worker, optimized fallback and disabled background in the same local headless Edge run at narrow, desktop and 4K viewports. These measurements include calculation and Canvas command submission, not isolated GPU raster/compositing or a cross-device performance certification. `ambient-contours-browser-validation.json` verifies worker use, fallback/recovery, cadence, input transparency, responsive bounds, reduced motion, lifecycle and disposal.

Same-run measurements while moving the pointer (milliseconds per redraw):

| Viewport | Previous renderer | Worker renderer | Cadence before / after |
| --- | ---: | ---: | ---: |
| 390 x 1000 | 1.68 ms | 0.76 ms | 10 / 30 fps |
| 1440 x 1000 | 3.23 ms | 1.56 ms | 10 / 30 fps |
| 3840 x 2160 | 4.84 ms | 2.80 ms | 10 / 30 fps |

Worker drawing intervals had a 95th percentile of 33.5-33.8 ms in these moving-pointer samples. No main-thread frames over 25 ms or long tasks were recorded in the worker samples. The optimized main-thread fallback also averaged 30 fps; it had one 33.3 ms main-thread frame in the 4K pointer sample. More frames can use more total power even when each redraw is cheaper. `contour-geometry-validation.json` compares six matching field phases and pointer deformations with the previous implementation; relative alpha differences stayed below 0.45%.

## Original workflow completion pass (2026-10-24)

The original workflow was reconciled with v2.2. Starter comparisons and save/share/export scope are complete. Copy experiment link preserves compatible built-in or generated configurations in a bounded URL fragment. Recipients review before explicit open/save and run separately. Clipboard denial provides selectable text. Imported CSV is shared through portable JSON files.

Thirty browser suites have current passing results (2272 checks), following a full run and a targeted library assertion update/rerun. The separate focused Edge/Chrome review has 76 cases; both browsers are Chromium. Controlled local responsiveness budgets also passed, including simulated 4x CPU throttling. These checks do not replace human screen-reader interpretation, beginner pilot observations or Firefox/Safari/physical-device testing. See the sibling release checklist and pilot packet.
