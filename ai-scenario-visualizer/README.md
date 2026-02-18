# AI Scenario Visualiser (Cytoscape)

Small placeholder demo of directed AI-future scenarios.

## What it includes

- Directed graph where nodes are scenario states.
- Directed edges interpreted as "possibly results in" transitions.
- Probabilistic edge weights coarse-grained to `low`, `medium`, `high`.
- Global `AI capability` control with coarse-grained bands that dynamically reweights edges.
- Reflexive (self) transitions are implicit per node.
- Node attribute: `development intensity` (`low`, `medium`, `high`, `extreme`).
- Development intensity can vary by capability band via node-level intensity profiles.
- Edge visibility and transition intensity can vary by capability band via edge profiles.
- `Scenario Editor`:
  - Add/delete nodes.
  - Relabel nodes.
  - Edit node development-intensity profile by capability.
  - Edit node rationale notes.
  - Add/delete outgoing arrows from selected node.
  - Edit arrow target and per-capability transition profile (`inactive`, `low`, `medium`, `high`).
  - Click a node in the main graph to load it in the editor.
- `Model Explorer` view for step-by-step path simulation:
  - Start at a node.
  - See currently accessible transitions, including reflexive/self transition.
  - Click an arrow to choose the transition.
  - Required per step: choose post-transition AI capability stage and duration (`month`, `year`, `decade`, `century`).
  - History displays elapsed time using only the largest-order scale (for example once centuries appear, months are ignored).
- Manual ticks (`+` / `-`) and optional auto tick.

## Run

Open `ai-scenario-visualizer/index.html` in a browser.

If your browser blocks local script loading, run a static server from this folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Edit placeholders

- Nodes are in `ai-scenario-visualizer/app.js` under `scenarioNodes`.
- Edges are in `ai-scenario-visualizer/app.js` under `scenarioEdges`.

Node fields:

- `label`: display name
- `notes`: rationale text editable in Scenario Editor
- `intensityByCapability`: development intensity by capability band

Edge fields:

- `base`: baseline probability (0 to 1)
- `sensitivity`: how much AI capability shifts that probability
- `bandByCapability` (optional): transition profile array by capability band (`inactive`, `low`, `medium`, `high`)
- `capabilityRange` (optional fallback): `{ min, max }` capability-band indices where edge is active

Live rule:

`raw_weight = clamp(base + sensitivity * capability, 0.001, 0.99)`

When `bandByCapability` is present for a capability band, that profile is used directly and can hide an edge with `inactive`.

Capability bands:

- `Low`: 0-1% of economic activity attributable to AI
- `Medium`: 1-10%
- `High`: 10-50%
- `Very high`: 50-75%
- `Extremely high`: 75-90%
- `Human obsolescence`: 90-100%
- `Omnipotent`: 100%

Outgoing transitions are source-normalised when needed so explicit outgoing total stays below `1.0`.

`implicit_self_transition = 1 - explicit_outgoing_total`

Displayed category:

`low` if `< 0.33`, `medium` if `< 0.66`, otherwise `high`
