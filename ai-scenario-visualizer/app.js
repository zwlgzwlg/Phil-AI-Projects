const capabilitySlider = document.getElementById("capability-slider");
const capabilityValue = document.getElementById("capability-value");
const trendHint = document.getElementById("trend-hint");
const selectionText = document.getElementById("selection-text");

const tickDownButton = document.getElementById("tick-down");
const tickUpButton = document.getElementById("tick-up");
const toggleAutoButton = document.getElementById("toggle-auto");
const resetCameraButton = document.getElementById("reset-camera");

const explorerStartNode = document.getElementById("explorer-start-node");
const explorerResetButton = document.getElementById("explorer-reset");
const explorerStatus = document.getElementById("explorer-status");
const explorerPending = document.getElementById("explorer-pending");
const explorerNextCapability = document.getElementById("explorer-next-capability");
const explorerNextDuration = document.getElementById("explorer-next-duration");
const explorerApplyYearButton = document.getElementById("explorer-apply-year");
const explorerHistory = document.getElementById("explorer-history");

const editorNodeSelect = document.getElementById("editor-node-select");
const editorNodeLabel = document.getElementById("editor-node-label");
const editorNodeNotes = document.getElementById("editor-node-notes");
const editorIntensityProfile = document.getElementById("editor-intensity-profile");
const editorAddNodeButton = document.getElementById("editor-add-node");
const editorDeleteNodeButton = document.getElementById("editor-delete-node");
const editorSaveNodeButton = document.getElementById("editor-save-node");

const editorEdgeSelect = document.getElementById("editor-edge-select");
const editorEdgeTarget = document.getElementById("editor-edge-target");
const editorEdgeProfile = document.getElementById("editor-edge-profile");
const editorNewEdgeButton = document.getElementById("editor-new-edge");
const editorDeleteEdgeButton = document.getElementById("editor-delete-edge");
const editorSaveEdgeButton = document.getElementById("editor-save-edge");
const editorStatus = document.getElementById("editor-status");

const MIN_EDGE_WEIGHT = 0.001;
const MAX_EDGE_WEIGHT = 0.99;
const MAX_EXPLICIT_OUTGOING = 0.99;
const MIN_SELF_WEIGHT = 1 - MAX_EXPLICIT_OUTGOING;
const LOW_BAND_MAX = 0.33;
const MEDIUM_BAND_MAX = 0.66;

const capabilityBands = [
  { key: "low", label: "Low", minPct: 0, maxPct: 1, representativeShare: 0.005 },
  { key: "medium", label: "Medium", minPct: 1, maxPct: 10, representativeShare: 0.05 },
  { key: "high", label: "High", minPct: 10, maxPct: 50, representativeShare: 0.3 },
  { key: "very_high", label: "Very high", minPct: 50, maxPct: 75, representativeShare: 0.625 },
  { key: "extremely_high", label: "Extremely high", minPct: 75, maxPct: 90, representativeShare: 0.825 },
  { key: "human_obselescence", label: "Human obselescence", minPct: 90, maxPct: 100, representativeShare: 0.95 },
  { key: "omnipotent", label: "Omnipotent", minPct: 100, maxPct: 100, representativeShare: 1.0 }
];

const durationScales = [
  { key: "month", label: "Month", plural: "months" },
  { key: "year", label: "Year", plural: "years" },
  { key: "decade", label: "Decade", plural: "decades" },
  { key: "century", label: "Century", plural: "centuries" }
];

let scenarioNodes = [
  {
    id: "competition",
    label: "Powerful AI Competition",
    intensity: "high",
    intensityByCapability: ["medium", "high", "high", "extreme", "extreme", "extreme", "extreme"],
    position: { x: 110, y: 150 },
    notes: "Placeholder rationale."
  },
  {
    id: "alliance",
    label: "Temporary Alliance",
    intensity: "medium",
    intensityByCapability: ["low", "medium", "medium", "high", "high", "medium", "low"],
    position: { x: 290, y: 60 },
    notes: "Placeholder rationale."
  },
  {
    id: "arms",
    label: "Capability Arms Race",
    intensity: "high",
    intensityByCapability: ["high", "high", "extreme", "extreme", "extreme", "high", "medium"],
    position: { x: 310, y: 250 },
    notes: "Placeholder rationale."
  },
  {
    id: "open",
    label: "Open Model Surge",
    intensity: "medium",
    intensityByCapability: ["medium", "medium", "high", "high", "high", "medium", "low"],
    position: { x: 100, y: 340 },
    notes: "Placeholder rationale."
  },
  {
    id: "monopoly",
    label: "AI Monopoly",
    intensity: "high",
    intensityByCapability: ["medium", "high", "high", "extreme", "extreme", "extreme", "extreme"],
    position: { x: 520, y: 100 },
    notes: "Placeholder rationale."
  },
  {
    id: "regulation",
    label: "Heavy Regulation",
    intensity: "low",
    intensityByCapability: ["medium", "medium", "high", "high", "medium", "low", "low"],
    position: { x: 530, y: 255 },
    notes: "Placeholder rationale."
  },
  {
    id: "incident",
    label: "Major AI Incident",
    intensity: "medium",
    intensityByCapability: ["low", "medium", "high", "high", "extreme", "extreme", "high"],
    position: { x: 420, y: 365 },
    notes: "Placeholder rationale."
  },
  {
    id: "coordination",
    label: "Global Coordination",
    intensity: "low",
    intensityByCapability: ["low", "medium", "medium", "medium", "high", "high", "high"],
    position: { x: 760, y: 70 },
    notes: "Placeholder rationale."
  },
  {
    id: "controlled",
    label: "Controlled Frontier AI",
    intensity: "extreme",
    intensityByCapability: ["low", "medium", "high", "high", "extreme", "extreme", "extreme"],
    position: { x: 780, y: 230 },
    notes: "Placeholder rationale."
  }
];

let scenarioEdges = [
  { id: "e01", source: "competition", target: "arms", base: 0.58, sensitivity: 0.25 },
  { id: "e02", source: "competition", target: "monopoly", base: 0.24, sensitivity: 0.30 },
  {
    id: "e03",
    source: "competition",
    target: "alliance",
    base: 0.22,
    sensitivity: -0.20,
    capabilityRange: { min: 0, max: 4 }
  },
  { id: "e04", source: "open", target: "competition", base: 0.42, sensitivity: 0.06 },
  { id: "e05", source: "open", target: "incident", base: 0.21, sensitivity: 0.12 },
  { id: "e06", source: "alliance", target: "coordination", base: 0.37, sensitivity: 0.08 },
  { id: "e07", source: "alliance", target: "competition", base: 0.29, sensitivity: 0.14 },
  { id: "e08", source: "arms", target: "incident", base: 0.33, sensitivity: 0.30 },
  { id: "e09", source: "incident", target: "regulation", base: 0.54, sensitivity: -0.15 },
  {
    id: "e10",
    source: "incident",
    target: "coordination",
    base: 0.28,
    sensitivity: -0.10,
    capabilityRange: { min: 0, max: 5 }
  },
  { id: "e11", source: "regulation", target: "controlled", base: 0.48, sensitivity: 0.12 },
  {
    id: "e12",
    source: "regulation",
    target: "open",
    base: 0.17,
    sensitivity: -0.24,
    capabilityRange: { min: 0, max: 3 }
  },
  { id: "e13", source: "controlled", target: "monopoly", base: 0.44, sensitivity: 0.34 },
  {
    id: "e14",
    source: "coordination",
    target: "controlled",
    base: 0.31,
    sensitivity: 0.10,
    capabilityRange: { min: 2, max: 6 }
  },
  { id: "e15", source: "coordination", target: "competition", base: 0.19, sensitivity: -0.18 },
  {
    id: "e16",
    source: "monopoly",
    target: "incident",
    base: 0.14,
    sensitivity: 0.16,
    capabilityRange: { min: 1, max: 5 }
  },
  { id: "e17", source: "monopoly", target: "regulation", base: 0.27, sensitivity: 0.05 }
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const readCapabilityBandIndex = () =>
  clamp(Number(capabilitySlider.value), 0, capabilityBands.length - 1);

const readCapabilityBand = () => capabilityBands[readCapabilityBandIndex()];

const readCapabilityShare = () => readCapabilityBand().representativeShare;

const computeWeight = (base, sensitivity, capabilityShare) =>
  clamp(base + sensitivity * capabilityShare, MIN_EDGE_WEIGHT, MAX_EDGE_WEIGHT);

const intensityLabel = {
  low: "Low",
  medium: "Medium",
  high: "High",
  extreme: "Extreme"
};

const intensityOptions = ["low", "medium", "high", "extreme"];
const edgeBandOptions = ["inactive", "low", "medium", "high"];
const representativeWeightByBand = {
  low: 0.2,
  medium: 0.5,
  high: 0.8
};

let scenarioNodeById = new Map();

const rebuildScenarioNodeIndex = () => {
  scenarioNodeById = new Map(scenarioNodes.map((node) => [node.id, node]));
};

rebuildScenarioNodeIndex();

const resolveNodeIntensity = (nodeConfig, capabilityBandIndex) => {
  if (!nodeConfig) {
    return "medium";
  }

  const fromProfile = nodeConfig.intensityByCapability?.[capabilityBandIndex];
  return fromProfile ?? nodeConfig.intensity ?? "medium";
};

const resolveEdgeProfileBand = (edgeData, capabilityBandIndex) => {
  if (!Array.isArray(edgeData.bandByCapability)) {
    return null;
  }

  const band = edgeData.bandByCapability[capabilityBandIndex];
  return edgeBandOptions.includes(band) ? band : null;
};

const isEdgeActiveAtCapability = (edgeData, capabilityBandIndex) => {
  const bandFromProfile = resolveEdgeProfileBand(edgeData, capabilityBandIndex);
  if (bandFromProfile === "inactive") {
    return false;
  }

  const range = edgeData.capabilityRange ?? {};
  const min = range.min ?? 0;
  const max = range.max ?? capabilityBands.length - 1;
  return capabilityBandIndex >= min && capabilityBandIndex <= max;
};

const formatCapabilityBand = (band) =>
  `${band.label} (${band.minPct}-${band.maxPct}% AI-attributable economy)`;

const formatLargestElapsedScale = (elapsedByScale) => {
  for (let index = durationScales.length - 1; index >= 0; index -= 1) {
    const scale = durationScales[index];
    const count = elapsedByScale[scale.key] ?? 0;
    if (count > 0) {
      return `${count} ${count === 1 ? scale.key : scale.plural}`;
    }
  }

  return "none yet";
};

const getNodeLabel = (nodeId) => {
  const nodeConfig = scenarioNodeById.get(nodeId);
  if (nodeConfig?.label) {
    return nodeConfig.label;
  }

  const node = cy?.getElementById(nodeId);
  return node && node.length > 0 ? node.data("label") : nodeId;
};

const probabilityBand = (value) => {
  if (value < LOW_BAND_MAX) {
    return "low";
  }

  if (value < MEDIUM_BAND_MAX) {
    return "medium";
  }

  return "high";
};

const formatTransitionBand = (value) => probabilityBand(value);

const transitionBandStyle = {
  low: { lineColor: "#3f88c5", lineWidth: 2.2 },
  medium: { lineColor: "#d08a2f", lineWidth: 4.2 },
  high: { lineColor: "#b44231", lineWidth: 6.2 }
};

const transitionBandColor = (band) =>
  transitionBandStyle[band]?.lineColor ?? transitionBandStyle.medium.lineColor;

const transitionBandWidth = (band) =>
  transitionBandStyle[band]?.lineWidth ?? transitionBandStyle.medium.lineWidth;

const edgeVisualByBand = (band, isActive) => {
  if (!isActive) {
    return {
      band: "inactive",
      label: "",
      lineColor: "#00000000",
      lineWidth: 0
    };
  }

  return {
    band,
    label: band,
    lineColor: transitionBandColor(band),
    lineWidth: transitionBandWidth(band)
  };
};

const initialCapabilityBandIndex = readCapabilityBandIndex();

const buildInitialNodeElements = (capabilityBandIndex) =>
  scenarioNodes.map((node) => ({
    data: {
      id: node.id,
      label: node.label,
      notes: node.notes ?? "",
      intensity: resolveNodeIntensity(node, capabilityBandIndex),
      outgoingTotal: 0,
      selfTransition: 1
    },
    position: node.position
  }));

const buildInitialEdgeElements = (capabilityBandIndex) =>
  scenarioEdges.map((edge) => {
    const isActive = isEdgeActiveAtCapability(edge, capabilityBandIndex);
    const profileBand = resolveEdgeProfileBand(edge, capabilityBandIndex);
    const rawWeight =
      profileBand && profileBand !== "inactive"
        ? representativeWeightByBand[profileBand]
        : computeWeight(edge.base ?? 0.3, edge.sensitivity ?? 0, readCapabilityShare());
    const computedBand = profileBand && profileBand !== "inactive" ? profileBand : formatTransitionBand(rawWeight);
    const visual = edgeVisualByBand(computedBand, isActive);

    return {
      data: {
        ...edge,
        rawWeight: isActive ? rawWeight : 0,
        weight: isActive ? rawWeight : 0,
        isActive: isActive ? 1 : 0,
        ...visual
      }
    };
  });

const cy = cytoscape({
  container: document.getElementById("cy"),
  elements: [
    ...buildInitialNodeElements(initialCapabilityBandIndex),
    ...buildInitialEdgeElements(initialCapabilityBandIndex)
  ],
  minZoom: 0.2,
  maxZoom: 2.5,
  layout: { name: "preset", fit: true, padding: 28 },
  style: [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "text-wrap": "wrap",
        "text-max-width": "120px",
        "text-valign": "center",
        "text-halign": "center",
        width: "label",
        height: "label",
        padding: "14px",
        "border-width": 2,
        "border-color": "#19495c",
        "background-color": "#f5fcff",
        color: "#0f2b37",
        "font-size": 12,
        "font-weight": 600
      }
    },
    {
      selector: 'node[intensity = "low"]',
      style: {
        "background-color": "#e6f6ef",
        "border-color": "#33785c"
      }
    },
    {
      selector: 'node[intensity = "medium"]',
      style: {
        "background-color": "#fff4df",
        "border-color": "#8d6f2f"
      }
    },
    {
      selector: 'node[intensity = "high"]',
      style: {
        "background-color": "#ffe6df",
        "border-color": "#9f4d33"
      }
    },
    {
      selector: 'node[intensity = "extreme"]',
      style: {
        "background-color": "#ffd3c8",
        "border-color": "#83251c"
      }
    },
    {
      selector: "edge",
      style: {
        width: "data(lineWidth)",
        "curve-style": "bezier",
        "line-color": "data(lineColor)",
        "target-arrow-color": "data(lineColor)",
        "target-arrow-shape": "triangle",
        "arrow-scale": 1.1,
        "label": "data(label)",
        "font-size": 10,
        "text-background-color": "#ffffff",
        "text-background-opacity": 0.85,
        "text-background-padding": 2,
        "text-rotation": "autorotate"
      }
    },
    {
      selector: 'edge[isActive = 0]',
      style: {
        display: "none"
      }
    },
    {
      selector: "edge:selected",
      style: {
        "line-style": "dashed",
        "overlay-opacity": 0.1
      }
    },
    {
      selector: "node:selected",
      style: {
        "border-color": "#c03c14",
        "border-width": 3
      }
    }
  ]
});

const explorerCy = cytoscape({
  container: document.getElementById("explorer-cy"),
  elements: [],
  minZoom: 0.2,
  maxZoom: 2.5,
  layout: { name: "preset", fit: true, padding: 24 },
  style: [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "text-wrap": "wrap",
        "text-max-width": "130px",
        "text-valign": "center",
        "text-halign": "center",
        width: "label",
        height: "label",
        padding: "13px",
        "border-width": 2,
        "border-color": "#1c5166",
        "background-color": "#f7fdff",
        color: "#0f2b37",
        "font-size": 12,
        "font-weight": 600
      }
    },
    {
      selector: 'node[intensity = "low"]',
      style: {
        "background-color": "#e6f6ef",
        "border-color": "#33785c"
      }
    },
    {
      selector: 'node[intensity = "medium"]',
      style: {
        "background-color": "#fff4df",
        "border-color": "#8d6f2f"
      }
    },
    {
      selector: 'node[intensity = "high"]',
      style: {
        "background-color": "#ffe6df",
        "border-color": "#9f4d33"
      }
    },
    {
      selector: 'node[intensity = "extreme"]',
      style: {
        "background-color": "#ffd3c8",
        "border-color": "#83251c"
      }
    },
    {
      selector: 'node[role = "current"]',
      style: {
        "border-width": 3.5,
        "border-color": "#10495f"
      }
    },
    {
      selector: "edge",
      style: {
        width: "data(lineWidth)",
        "curve-style": "bezier",
        "line-color": "data(lineColor)",
        "target-arrow-color": "data(lineColor)",
        "target-arrow-shape": "triangle",
        "arrow-scale": 1.15,
        "label": "data(label)",
        "font-size": 11,
        "font-weight": 700,
        "text-background-color": "#ffffff",
        "text-background-opacity": 0.88,
        "text-background-padding": 2,
        "text-rotation": "autorotate"
      }
    },
    {
      selector: 'edge[transitionType = "self"]',
      style: {
        "line-style": "dotted",
        "loop-direction": "40deg",
        "loop-sweep": "72deg"
      }
    },
    {
      selector: "edge:selected",
      style: {
        "line-style": "dashed",
        "overlay-opacity": 0.12
      }
    }
  ]
});

const updateTrendHint = (capabilityBand) => {
  trendHint.textContent = `Selected AI capability band: ${formatCapabilityBand(
    capabilityBand
  )}.`;
};

const selection = {
  type: "none",
  id: null
};

const explorerState = {
  isReady: false,
  step: 0,
  currentNodeId: scenarioNodes[0].id,
  pendingTransition: null,
  history: [],
  elapsedByScale: {
    month: 0,
    year: 0,
    decade: 0,
    century: 0
  }
};

const setExplorerApplyEnabled = () => {
  const hasPending = Boolean(explorerState.pendingTransition);
  const hasTargetCapability = explorerNextCapability.value !== "";
  const hasDuration = explorerNextDuration.value !== "";
  explorerApplyYearButton.disabled = !(hasPending && hasTargetCapability && hasDuration);
};

const clearExplorerCapabilityPrompt = () => {
  explorerNextCapability.textContent = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select capability stage";
  explorerNextCapability.append(placeholder);
  explorerNextCapability.value = "";
  explorerNextCapability.disabled = true;
  setExplorerApplyEnabled();
};

const clearExplorerDurationPrompt = () => {
  explorerNextDuration.textContent = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select duration";
  explorerNextDuration.append(placeholder);
  explorerNextDuration.value = "";
  explorerNextDuration.disabled = true;
  setExplorerApplyEnabled();
};

const populateExplorerCapabilityPrompt = () => {
  const currentBandIndex = Number(capabilitySlider.value);
  explorerNextCapability.textContent = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select capability stage";
  explorerNextCapability.append(placeholder);

  capabilityBands.forEach((band, index) => {
    if (index === currentBandIndex) {
      return;
    }

    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = formatCapabilityBand(band);
    explorerNextCapability.append(option);
  });

  explorerNextCapability.value = "";
  explorerNextCapability.disabled = false;
  setExplorerApplyEnabled();
};

const populateExplorerDurationPrompt = () => {
  explorerNextDuration.textContent = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select duration";
  explorerNextDuration.append(placeholder);

  durationScales.forEach((scale) => {
    const option = document.createElement("option");
    option.value = scale.key;
    option.textContent = scale.label;
    explorerNextDuration.append(option);
  });

  explorerNextDuration.value = "";
  explorerNextDuration.disabled = false;
  setExplorerApplyEnabled();
};

const renderExplorerHistory = () => {
  explorerHistory.textContent = "";

  if (explorerState.history.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No transitions simulated yet.";
    explorerHistory.append(item);
    return;
  }

  explorerState.history.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = `Step ${entry.step}: ${entry.fromLabel} -> ${entry.toLabel} (${entry.transitionBand}). AI capability ${entry.capabilityFrom} -> ${entry.capabilityTo} (${entry.direction}). Largest elapsed scale: ${entry.largestElapsed}.`;
    explorerHistory.append(item);
  });
};

const renderExplorerStatus = () => {
  explorerStatus.textContent = `Step ${explorerState.step}. Current node: ${getNodeLabel(
    explorerState.currentNodeId
  )}. AI capability: ${formatCapabilityBand(
    readCapabilityBand()
  )}. Largest elapsed scale: ${formatLargestElapsedScale(explorerState.elapsedByScale)}.`;
};

const renderExplorerPending = () => {
  if (!explorerState.pendingTransition) {
    explorerPending.textContent =
      "No transition selected yet. Click an explorer arrow, then select capability stage and duration.";
    clearExplorerCapabilityPrompt();
    clearExplorerDurationPrompt();
    return;
  }

  const { transitionType, targetId, weightBand } = explorerState.pendingTransition;
  const sourceLabel = getNodeLabel(explorerState.currentNodeId);
  const targetLabel = getNodeLabel(targetId);
  const transitionLabel =
    transitionType === "self" ? `Stay in ${sourceLabel}` : `${sourceLabel} -> ${targetLabel}`;

  explorerPending.textContent = `Selected transition: ${transitionLabel} (${weightBand}). Select capability stage and duration, then apply the transition.`;
  populateExplorerCapabilityPrompt();
  populateExplorerDurationPrompt();
};

const collectExplorerTransitions = (sourceNodeId) => {
  const transitions = [];

  cy.edges(`[source = "${sourceNodeId}"][isActive = 1]`).forEach((edge) => {
    const band = edge.data("band") ?? formatTransitionBand(edge.data("weight"));
    transitions.push({
      targetId: edge.target().id(),
      weight: edge.data("weight"),
      weightBand: band,
      lineColor: transitionBandColor(band),
      lineWidth: transitionBandWidth(band),
      transitionType: "edge"
    });
  });

  const sourceNode = cy.getElementById(sourceNodeId);
  const selfWeight = sourceNode.data("selfTransition") ?? 1;
  const selfBand = formatTransitionBand(selfWeight);
  transitions.push({
    targetId: sourceNodeId,
    weight: selfWeight,
    weightBand: selfBand,
    lineColor: transitionBandColor(selfBand),
    lineWidth: transitionBandWidth(selfBand),
    transitionType: "self"
  });

  return transitions;
};

const buildExplorerElements = () => {
  const sourceNodeId = explorerState.currentNodeId;
  const transitions = collectExplorerTransitions(sourceNodeId);
  const targetNodeIds = [];

  transitions.forEach((transition) => {
    if (!targetNodeIds.includes(transition.targetId) && transition.targetId !== sourceNodeId) {
      targetNodeIds.push(transition.targetId);
    }
  });

  const center = { x: 360, y: 220 };
  const radius = 180;
  const positionById = new Map();
  positionById.set(sourceNodeId, center);

  targetNodeIds.forEach((nodeId, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(targetNodeIds.length, 1);
    positionById.set(nodeId, {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle)
    });
  });

  const allNodeIds = [sourceNodeId, ...targetNodeIds];
  const nodeElements = allNodeIds.map((nodeId) => {
    const node = cy.getElementById(nodeId);
    return {
      data: {
        id: nodeId,
        label: node.data("label"),
        intensity: node.data("intensity"),
        role: nodeId === sourceNodeId ? "current" : "reachable"
      },
      position: positionById.get(nodeId)
    };
  });

  const edgeElementsForExplorer = transitions.map((transition, index) => ({
    data: {
      id: `explorer-${sourceNodeId}-${transition.targetId}-${transition.transitionType}-${index}`,
      source: sourceNodeId,
      target: transition.targetId,
      label: transition.weightBand,
      weight: transition.weight,
      lineColor: transition.lineColor,
      lineWidth: transition.lineWidth,
      weightBand: transition.weightBand,
      transitionType: transition.transitionType,
      targetId: transition.targetId
    }
  }));

  return [...nodeElements, ...edgeElementsForExplorer];
};

const refreshExplorerGraph = () => {
  explorerCy.elements().remove();
  explorerCy.add(buildExplorerElements());
  explorerCy.layout({ name: "preset", fit: true, padding: 30 }).run();

  if (explorerState.pendingTransition) {
    let matchingEdge = null;
    explorerCy.edges().forEach((edge) => {
      if (
        !matchingEdge &&
        edge.data("targetId") === explorerState.pendingTransition.targetId &&
        edge.data("transitionType") === explorerState.pendingTransition.transitionType
      ) {
        matchingEdge = edge;
      }
    });

    if (matchingEdge) {
      matchingEdge.select();
    } else {
      explorerState.pendingTransition = null;
    }
  }
};

const refreshExplorerView = () => {
  if (!explorerState.isReady) {
    return;
  }

  refreshExplorerGraph();
  renderExplorerStatus();
  renderExplorerPending();
  renderExplorerHistory();
};

const setExplorerPendingTransition = (edge) => {
  explorerState.pendingTransition = {
    targetId: edge.data("targetId"),
    transitionType: edge.data("transitionType"),
    weightBand: edge.data("weightBand")
  };
  renderExplorerPending();
};

const applyExplorerTransition = () => {
  if (!explorerState.pendingTransition) {
    explorerPending.textContent =
      "Select an explorer transition first.";
    return;
  }

  if (explorerNextCapability.value === "") {
    explorerPending.textContent =
      "Select the post-transition capability stage before applying the transition.";
    setExplorerApplyEnabled();
    return;
  }

  if (explorerNextDuration.value === "") {
    explorerPending.textContent =
      "Select a duration before applying the transition.";
    setExplorerApplyEnabled();
    return;
  }

  const nextBandIndex = Number(explorerNextCapability.value);
  if (
    !Number.isFinite(nextBandIndex) ||
    nextBandIndex < 0 ||
    nextBandIndex >= capabilityBands.length
  ) {
    explorerPending.textContent =
      "The selected capability stage is invalid. Please choose it again.";
    clearExplorerCapabilityPrompt();
    return;
  }

  const fromNodeId = explorerState.currentNodeId;
  const toNodeId = explorerState.pendingTransition.targetId;
  const previousBandIndex = Number(capabilitySlider.value);
  if (nextBandIndex === previousBandIndex) {
    explorerPending.textContent =
      "Choose a different capability stage so the transition reflects either advancement or regression.";
    setExplorerApplyEnabled();
    return;
  }

  const durationKey = explorerNextDuration.value;
  if (!durationScales.some((scale) => scale.key === durationKey)) {
    explorerPending.textContent =
      "The selected duration is invalid. Please choose it again.";
    clearExplorerDurationPrompt();
    return;
  }

  const direction = nextBandIndex > previousBandIndex ? "advance" : "regress";
  const pendingTransition = explorerState.pendingTransition;

  explorerState.step += 1;
  explorerState.elapsedByScale[durationKey] += 1;
  const largestElapsed = formatLargestElapsedScale(explorerState.elapsedByScale);
  explorerState.currentNodeId = toNodeId;
  explorerState.history.unshift({
    step: explorerState.step,
    fromLabel: getNodeLabel(fromNodeId),
    toLabel: getNodeLabel(toNodeId),
    transitionBand: pendingTransition.weightBand,
    capabilityFrom: capabilityBands[previousBandIndex].label,
    capabilityTo: capabilityBands[nextBandIndex].label,
    direction,
    largestElapsed
  });

  explorerState.pendingTransition = null;
  setCapabilityBandIndex(nextBandIndex);
};

const refreshExplorerStartNodeOptions = () => {
  const previousValue = explorerStartNode.value;
  explorerStartNode.textContent = "";

  scenarioNodes.forEach((node) => {
    const option = document.createElement("option");
    option.value = node.id;
    option.textContent = node.label;
    explorerStartNode.append(option);
  });

  if (scenarioNodeById.has(previousValue)) {
    explorerStartNode.value = previousValue;
    return;
  }

  explorerStartNode.value = scenarioNodes[0]?.id ?? "";
};

const initializeExplorer = () => {
  refreshExplorerStartNodeOptions();
  explorerState.currentNodeId = explorerStartNode.value;
  explorerState.isReady = true;

  explorerResetButton.addEventListener("click", () => {
    explorerState.step = 0;
    explorerState.currentNodeId = explorerStartNode.value || scenarioNodes[0]?.id || "";
    explorerState.pendingTransition = null;
    explorerState.history = [];
    explorerState.elapsedByScale = {
      month: 0,
      year: 0,
      decade: 0,
      century: 0
    };
    refreshExplorerView();
  });

  explorerNextCapability.addEventListener("change", setExplorerApplyEnabled);
  explorerNextDuration.addEventListener("change", setExplorerApplyEnabled);

  explorerApplyYearButton.addEventListener("click", () => {
    applyExplorerTransition();
  });

  explorerCy.on("tap", "edge", (event) => {
    explorerCy.elements().unselect();
    const edge = event.target;
    edge.select();
    setExplorerPendingTransition(edge);
  });

  explorerCy.on("tap", (event) => {
    if (event.target === explorerCy) {
      explorerCy.elements().unselect();
      explorerState.pendingTransition = null;
      renderExplorerPending();
    }
  });
};

const editorState = {
  selectedNodeId: "",
  selectedEdgeId: "__new__"
};

const buildDefaultIntensityProfile = () => capabilityBands.map(() => "medium");

const buildDefaultEdgeProfile = () =>
  capabilityBands.map((_, index) => (index === readCapabilityBandIndex() ? "medium" : "inactive"));

const setEditorStatus = (message) => {
  editorStatus.textContent = message;
};

const renderCapabilityProfileInputs = (container, inputPrefix, values, options) => {
  container.textContent = "";

  capabilityBands.forEach((band, index) => {
    const row = document.createElement("div");
    row.className = "profile-row";

    const label = document.createElement("label");
    label.htmlFor = `${inputPrefix}-${index}`;
    label.textContent = band.label;

    const select = document.createElement("select");
    select.id = `${inputPrefix}-${index}`;
    select.dataset.capabilityIndex = String(index);

    options.forEach((optionValue) => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue;
      select.append(option);
    });

    select.value = values[index] ?? options[0];
    row.append(label, select);
    container.append(row);
  });
};

const readCapabilityProfileInputs = (inputPrefix, allowedOptions, fallbackValue) =>
  capabilityBands.map((_, index) => {
    const input = document.getElementById(`${inputPrefix}-${index}`);
    const value = input?.value;
    return allowedOptions.includes(value) ? value : fallbackValue;
  });

const getEdgeById = (edgeId) => scenarioEdges.find((edge) => edge.id === edgeId);

const deriveEdgeProfileFromModel = (edge) =>
  capabilityBands.map((band, index) => {
    const profileBand = resolveEdgeProfileBand(edge, index);
    if (profileBand) {
      return profileBand;
    }

    if (!isEdgeActiveAtCapability(edge, index)) {
      return "inactive";
    }

    const raw = computeWeight(edge.base ?? 0.3, edge.sensitivity ?? 0, band.representativeShare);
    return formatTransitionBand(raw);
  });

const refreshEditorTargetOptions = (sourceNodeId) => {
  const previousTarget = editorEdgeTarget.value;
  editorEdgeTarget.textContent = "";

  scenarioNodes
    .filter((node) => node.id !== sourceNodeId)
    .forEach((node) => {
      const option = document.createElement("option");
      option.value = node.id;
      option.textContent = node.label;
      editorEdgeTarget.append(option);
    });

  if (editorEdgeTarget.options.length === 0) {
    editorEdgeTarget.disabled = true;
    return;
  }

  editorEdgeTarget.disabled = false;
  if ([...editorEdgeTarget.options].some((option) => option.value === previousTarget)) {
    editorEdgeTarget.value = previousTarget;
  }
};

const refreshEditorEdgeOptions = (sourceNodeId) => {
  const previousEdgeId = editorState.selectedEdgeId;
  editorEdgeSelect.textContent = "";

  const newOption = document.createElement("option");
  newOption.value = "__new__";
  newOption.textContent = "New Arrow";
  editorEdgeSelect.append(newOption);

  scenarioEdges
    .filter((edge) => edge.source === sourceNodeId)
    .forEach((edge) => {
      const option = document.createElement("option");
      option.value = edge.id;
      option.textContent = `${getNodeLabel(edge.source)} -> ${getNodeLabel(edge.target)}`;
      editorEdgeSelect.append(option);
    });

  editorEdgeSelect.value = [...editorEdgeSelect.options].some((option) => option.value === previousEdgeId)
    ? previousEdgeId
    : "__new__";
  editorState.selectedEdgeId = editorEdgeSelect.value;
};

const refreshEditorNodeOptions = () => {
  const previousNode = editorState.selectedNodeId || editorNodeSelect.value;
  editorNodeSelect.textContent = "";

  scenarioNodes.forEach((node) => {
    const option = document.createElement("option");
    option.value = node.id;
    option.textContent = node.label;
    editorNodeSelect.append(option);
  });

  if (scenarioNodes.length === 0) {
    editorNodeSelect.value = "";
    editorState.selectedNodeId = "";
    return;
  }

  editorNodeSelect.value = scenarioNodeById.has(previousNode) ? previousNode : scenarioNodes[0].id;
  editorState.selectedNodeId = editorNodeSelect.value;
};

const populateEditorEdgeForm = () => {
  const sourceNodeId = editorNodeSelect.value;
  const edgeId = editorEdgeSelect.value;
  editorState.selectedEdgeId = edgeId;

  const edge = getEdgeById(edgeId);
  if (edge && edge.source === sourceNodeId) {
    editorEdgeTarget.value = edge.target;
    renderCapabilityProfileInputs(
      editorEdgeProfile,
      "editor-edge-profile",
      deriveEdgeProfileFromModel(edge),
      edgeBandOptions
    );
    return;
  }

  renderCapabilityProfileInputs(
    editorEdgeProfile,
    "editor-edge-profile",
    buildDefaultEdgeProfile(),
    edgeBandOptions
  );
};

const populateEditorNodeForm = (nodeId) => {
  const node = scenarioNodeById.get(nodeId);
  if (!node) {
    return;
  }

  editorState.selectedNodeId = nodeId;
  editorNodeSelect.value = nodeId;
  editorNodeLabel.value = node.label;
  editorNodeNotes.value = node.notes ?? "";

  const profile = Array.isArray(node.intensityByCapability)
    ? node.intensityByCapability
    : buildDefaultIntensityProfile();
  renderCapabilityProfileInputs(
    editorIntensityProfile,
    "editor-intensity-profile",
    profile,
    intensityOptions
  );

  refreshEditorTargetOptions(nodeId);
  refreshEditorEdgeOptions(nodeId);
  populateEditorEdgeForm();
};

const generateNodeId = () => {
  let attempt = scenarioNodes.length + 1;
  while (scenarioNodeById.has(`node_${attempt}`)) {
    attempt += 1;
  }
  return `node_${attempt}`;
};

const generateEdgeId = () => {
  let attempt = scenarioEdges.length + 1;
  while (getEdgeById(`e${String(attempt).padStart(2, "0")}`)) {
    attempt += 1;
  }
  return `e${String(attempt).padStart(2, "0")}`;
};

const rebuildMainGraphFromModel = () => {
  rebuildScenarioNodeIndex();

  if (scenarioNodes.length === 0) {
    return;
  }

  if (!scenarioNodeById.has(explorerState.currentNodeId)) {
    explorerState.currentNodeId = scenarioNodes[0].id;
    explorerState.pendingTransition = null;
  }

  cy.elements().remove();
  const capabilityBandIndex = readCapabilityBandIndex();
  cy.add([
    ...buildInitialNodeElements(capabilityBandIndex),
    ...buildInitialEdgeElements(capabilityBandIndex)
  ]);

  refreshExplorerStartNodeOptions();
  refreshEditorNodeOptions();
  populateEditorNodeForm(editorNodeSelect.value);
  refreshTransitionProbabilities();
};

const initializeEditor = () => {
  refreshEditorNodeOptions();
  if (!editorNodeSelect.value) {
    return;
  }

  populateEditorNodeForm(editorNodeSelect.value);

  editorNodeSelect.addEventListener("change", () => {
    populateEditorNodeForm(editorNodeSelect.value);
  });

  editorEdgeSelect.addEventListener("change", () => {
    populateEditorEdgeForm();
  });

  editorNewEdgeButton.addEventListener("click", () => {
    editorEdgeSelect.value = "__new__";
    populateEditorEdgeForm();
    setEditorStatus("New arrow draft ready.");
  });

  editorAddNodeButton.addEventListener("click", () => {
    const nodeId = generateNodeId();
    const nextNode = {
      id: nodeId,
      label: `New Scenario ${scenarioNodes.length + 1}`,
      intensity: "medium",
      intensityByCapability: buildDefaultIntensityProfile(),
      position: { x: 180 + Math.random() * 600, y: 120 + Math.random() * 300 },
      notes: "Add rationale."
    };
    scenarioNodes.push(nextNode);
    rebuildMainGraphFromModel();
    populateEditorNodeForm(nodeId);
    setEditorStatus(`Added node ${nextNode.label}.`);
  });

  editorDeleteNodeButton.addEventListener("click", () => {
    const nodeId = editorNodeSelect.value;
    if (!nodeId || scenarioNodes.length <= 1) {
      setEditorStatus("Cannot delete the last remaining node.");
      return;
    }

    const removedNode = scenarioNodeById.get(nodeId);
    scenarioNodes = scenarioNodes.filter((node) => node.id !== nodeId);
    scenarioEdges = scenarioEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
    rebuildMainGraphFromModel();
    setEditorStatus(`Deleted node ${removedNode?.label ?? nodeId} and connected arrows.`);
  });

  editorSaveNodeButton.addEventListener("click", () => {
    const nodeId = editorNodeSelect.value;
    const node = scenarioNodeById.get(nodeId);
    if (!node) {
      return;
    }

    const nextLabel = editorNodeLabel.value.trim() || node.label;
    const nextNotes = editorNodeNotes.value;
    const intensityByCapability = readCapabilityProfileInputs(
      "editor-intensity-profile",
      intensityOptions,
      "medium"
    );

    scenarioNodes = scenarioNodes.map((candidate) =>
      candidate.id === nodeId
        ? {
            ...candidate,
            label: nextLabel,
            notes: nextNotes,
            intensityByCapability,
            intensity: intensityByCapability[readCapabilityBandIndex()] ?? "medium"
          }
        : candidate
    );

    rebuildMainGraphFromModel();
    populateEditorNodeForm(nodeId);
    setEditorStatus(`Saved node ${nextLabel}.`);
  });

  editorSaveEdgeButton.addEventListener("click", () => {
    const sourceId = editorNodeSelect.value;
    const targetId = editorEdgeTarget.value;
    if (!sourceId || !targetId) {
      setEditorStatus("Select a target node before saving the arrow.");
      return;
    }

    const bandByCapability = readCapabilityProfileInputs(
      "editor-edge-profile",
      edgeBandOptions,
      "inactive"
    );
    const existingEdgeId = editorEdgeSelect.value;

    if (existingEdgeId === "__new__") {
      scenarioEdges.push({
        id: generateEdgeId(),
        source: sourceId,
        target: targetId,
        base: 0.3,
        sensitivity: 0,
        bandByCapability
      });
      rebuildMainGraphFromModel();
      populateEditorNodeForm(sourceId);
      setEditorStatus(`Added arrow ${getNodeLabel(sourceId)} -> ${getNodeLabel(targetId)}.`);
      return;
    }

    scenarioEdges = scenarioEdges.map((edge) =>
      edge.id === existingEdgeId
        ? {
            id: edge.id,
            source: sourceId,
            target: targetId,
            base: edge.base ?? 0.3,
            sensitivity: edge.sensitivity ?? 0,
            bandByCapability
          }
        : edge
    );

    rebuildMainGraphFromModel();
    editorEdgeSelect.value = existingEdgeId;
    populateEditorEdgeForm();
    setEditorStatus(`Saved arrow ${existingEdgeId}.`);
  });

  editorDeleteEdgeButton.addEventListener("click", () => {
    const edgeId = editorEdgeSelect.value;
    if (!edgeId || edgeId === "__new__") {
      setEditorStatus("Select an existing arrow to delete.");
      return;
    }

    scenarioEdges = scenarioEdges.filter((edge) => edge.id !== edgeId);
    rebuildMainGraphFromModel();
    populateEditorNodeForm(editorNodeSelect.value);
    setEditorStatus(`Deleted arrow ${edgeId}.`);
  });
};

const showDefaultSelection = () => {
  selectionText.textContent = "Click a node or edge to inspect transitions. Self-transitions are implicit.";
};

const showNodeSelection = (node) => {
  const intensity = intensityLabel[node.data("intensity")] ?? "Unknown";
  const outgoingTotal = node.data("outgoingTotal") ?? 0;
  const selfTransition = node.data("selfTransition") ?? 1;

  selectionText.textContent = `Node: ${node.data(
    "label"
  )}. Development intensity: ${intensity}. Explicit outgoing: ${formatTransitionBand(
    outgoingTotal
  )}. Implicit self-transition: ${formatTransitionBand(selfTransition)}.`;
};

const showEdgeSelection = (edge) => {
  const sourceLabel = edge.source().data("label");
  const targetLabel = edge.target().data("label");
  const isActive = edge.data("isActive") === 1;
  const base = edge.data("base");
  const sensitivity = edge.data("sensitivity");
  const weight = edge.data("weight");

  if (!isActive) {
    selectionText.textContent = `${sourceLabel} -> ${targetLabel}. Transition is unavailable at ${readCapabilityBand().label} capability.`;
    return;
  }

  const sensitivityText =
    sensitivity > 0
      ? "increases with AI capability"
      : sensitivity < 0
      ? "decreases with AI capability"
      : "is unchanged by AI capability";

  selectionText.textContent = `${sourceLabel} -> ${targetLabel}. Transition category: ${formatTransitionBand(
    weight
  )}. Baseline category: ${formatTransitionBand(base)}. Sensitivity: ${sensitivityText}.`;
};

const refreshSelectionText = () => {
  if (selection.type === "edge" && selection.id) {
    const edge = cy.getElementById(selection.id);
    if (edge && edge.length > 0) {
      showEdgeSelection(edge);
      return;
    }
  }

  if (selection.type === "node" && selection.id) {
    const node = cy.getElementById(selection.id);
    if (node && node.length > 0) {
      showNodeSelection(node);
      return;
    }
  }

  showDefaultSelection();
};

const refreshTransitionProbabilities = () => {
  const capabilityBandIndex = readCapabilityBandIndex();
  const capabilityBand = readCapabilityBand();
  const capabilityShare = capabilityBand.representativeShare;
  capabilityValue.textContent = formatCapabilityBand(capabilityBand);

  const outgoingBySource = new Map();

  cy.nodes().forEach((node) => {
    const nodeConfig = scenarioNodeById.get(node.id());
    node.data("label", nodeConfig?.label ?? node.data("label"));
    node.data("notes", nodeConfig?.notes ?? "");
    node.data("intensity", resolveNodeIntensity(nodeConfig, capabilityBandIndex));
  });

  cy.edges().forEach((edge) => {
    const edgeData = edge.data();
    const isActive = isEdgeActiveAtCapability(edgeData, capabilityBandIndex);
    edge.data("isActive", isActive ? 1 : 0);

    if (!isActive) {
      const visual = edgeVisualByBand("inactive", false);
      edge.data("rawWeight", 0);
      edge.data("weight", 0);
      edge.data("band", visual.band);
      edge.data("label", visual.label);
      edge.data("lineColor", visual.lineColor);
      edge.data("lineWidth", visual.lineWidth);
      return;
    }

    const profileBand = resolveEdgeProfileBand(edgeData, capabilityBandIndex);
    const rawWeight =
      profileBand && profileBand !== "inactive"
        ? representativeWeightByBand[profileBand]
        : computeWeight(edgeData.base ?? 0.3, edgeData.sensitivity ?? 0, capabilityShare);
    const sourceId = edge.source().id();
    edge.data("rawWeight", rawWeight);
    edge.data("profileBand", profileBand ?? "");

    if (!outgoingBySource.has(sourceId)) {
      outgoingBySource.set(sourceId, []);
    }

    outgoingBySource.get(sourceId).push(edge);
  });

  cy.nodes().forEach((node) => {
    const outgoing = outgoingBySource.get(node.id()) ?? [];
    const rawOutgoingTotal = outgoing.reduce((sum, edge) => sum + edge.data("rawWeight"), 0);
    const sourceScale = rawOutgoingTotal > MAX_EXPLICIT_OUTGOING ? MAX_EXPLICIT_OUTGOING / rawOutgoingTotal : 1;

    let outgoingTotal = 0;

    outgoing.forEach((edge) => {
      const weight = edge.data("rawWeight") * sourceScale;
      outgoingTotal += weight;
      const profileBand = edge.data("profileBand");
      const band = profileBand && profileBand !== "inactive" ? profileBand : formatTransitionBand(weight);
      const visual = edgeVisualByBand(band, true);

      edge.data("weight", weight);
      edge.data("band", visual.band);
      edge.data("label", visual.label);
      edge.data("lineColor", visual.lineColor);
      edge.data("lineWidth", visual.lineWidth);
    });

    const selfTransition = clamp(1 - outgoingTotal, MIN_SELF_WEIGHT, 1);
    node.data("outgoingTotal", outgoingTotal);
    node.data("selfTransition", selfTransition);
  });

  updateTrendHint(capabilityBand);
  refreshSelectionText();
  refreshExplorerView();
};

const setCapabilityBandIndex = (nextIndex) => {
  capabilitySlider.value = String(
    clamp(Math.round(nextIndex), 0, capabilityBands.length - 1)
  );
  refreshTransitionProbabilities();
};

let autoTickTimer = null;

const stopAutoTick = () => {
  if (autoTickTimer) {
    window.clearInterval(autoTickTimer);
    autoTickTimer = null;
  }
  toggleAutoButton.textContent = "Start Auto Tick";
};

const autoTickStep = () => {
  const current = Number(capabilitySlider.value);
  const move = Math.random() < 0.3 ? 0 : Math.random() < 0.5 ? -1 : 1;
  setCapabilityBandIndex(current + move);
};

const startAutoTick = () => {
  if (autoTickTimer) {
    return;
  }

  autoTickTimer = window.setInterval(autoTickStep, 950);
  toggleAutoButton.textContent = "Stop Auto Tick";
};

const resetMainCamera = () => {
  const nodes = cy.nodes(":visible");
  cy.fit(nodes.length > 0 ? nodes : cy.nodes(), 36);
};

capabilitySlider.addEventListener("input", refreshTransitionProbabilities);

tickDownButton.addEventListener("click", () => {
  setCapabilityBandIndex(Number(capabilitySlider.value) - 1);
});

tickUpButton.addEventListener("click", () => {
  setCapabilityBandIndex(Number(capabilitySlider.value) + 1);
});

toggleAutoButton.addEventListener("click", () => {
  if (autoTickTimer) {
    stopAutoTick();
    return;
  }
  startAutoTick();
});

resetCameraButton.addEventListener("click", () => {
  resetMainCamera();
});

cy.on("tap", "node", (event) => {
  const node = event.target;
  selection.type = "node";
  selection.id = node.id();
  showNodeSelection(node);
  if (scenarioNodeById.has(node.id())) {
    populateEditorNodeForm(node.id());
    setEditorStatus(`Editing node ${node.data("label")}.`);
  }
});

cy.on("tap", "edge", (event) => {
  const edge = event.target;
  selection.type = "edge";
  selection.id = edge.id();
  showEdgeSelection(edge);
});

cy.on("tap", (event) => {
  if (event.target === cy) {
    selection.type = "none";
    selection.id = null;
    showDefaultSelection();
  }
});

initializeExplorer();
initializeEditor();
refreshTransitionProbabilities();
