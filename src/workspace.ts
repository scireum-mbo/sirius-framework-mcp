import { XMLParser } from "fast-xml-parser";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * Represents the Sirius framework layers, ordered from lowest to highest.
 */
export enum SiriusLayer {
  KERNEL = "KERNEL",
  WEB = "WEB",
  DB = "DB",
  BIZ = "BIZ",
  APP = "APP",
}

/**
 * Information about the detected workspace and which framework layers it exposes.
 */
export interface WorkspaceInfo {
  /** The detected framework layer for this workspace. */
  layer: SiriusLayer;
  /** The set of layers whose resources/tools should be exposed. */
  exposedLayers: SiriusLayer[];
  /** The artifactId from the POM, if available. */
  artifactId: string | undefined;
  /** Whether this is a multi-module parent POM. */
  isMultiModule: boolean;
}

/**
 * Maps a known Sirius artifact ID to its framework layer.
 */
const ARTIFACT_TO_LAYER: Record<string, SiriusLayer> = {
  "sirius-kernel": SiriusLayer.KERNEL,
  "sirius-web": SiriusLayer.WEB,
  "sirius-db": SiriusLayer.DB,
  "sirius-biz": SiriusLayer.BIZ,
};

/**
 * Defines which layers are exposed for each workspace layer.
 * Lower layers include only themselves (plus prerequisites),
 * while APP exposes everything.
 */
const LAYER_EXPOSURES: Record<SiriusLayer, SiriusLayer[]> = {
  [SiriusLayer.KERNEL]: [SiriusLayer.KERNEL],
  [SiriusLayer.WEB]: [SiriusLayer.KERNEL, SiriusLayer.WEB],
  [SiriusLayer.DB]: [SiriusLayer.KERNEL, SiriusLayer.DB],
  [SiriusLayer.BIZ]: [
    SiriusLayer.KERNEL,
    SiriusLayer.WEB,
    SiriusLayer.DB,
    SiriusLayer.BIZ,
  ],
  [SiriusLayer.APP]: [
    SiriusLayer.KERNEL,
    SiriusLayer.WEB,
    SiriusLayer.DB,
    SiriusLayer.BIZ,
    SiriusLayer.APP,
  ],
};

/**
 * Detects workspace information by parsing the given POM XML content.
 *
 * Detection logic:
 * 1. If the POM's own artifactId matches a known Sirius module, use that layer.
 * 2. Otherwise, scan dependencies for Sirius artifacts and pick the highest layer.
 * 3. If nothing matches, default to APP (expose all layers).
 * 4. Detect multi-module POMs by the presence of a <modules> section.
 */
export function detectWorkspace(pomXml: string): WorkspaceInfo {
  if (!pomXml || pomXml.trim().length === 0) {
    return {
      layer: SiriusLayer.APP,
      exposedLayers: LAYER_EXPOSURES[SiriusLayer.APP],
      artifactId: undefined,
      isMultiModule: false,
    };
  }

  const parser = new XMLParser();
  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(pomXml) as Record<string, unknown>;
  } catch {
    return {
      layer: SiriusLayer.APP,
      exposedLayers: LAYER_EXPOSURES[SiriusLayer.APP],
      artifactId: undefined,
      isMultiModule: false,
    };
  }

  const project = parsed.project as Record<string, unknown> | undefined;
  if (!project) {
    return {
      layer: SiriusLayer.APP,
      exposedLayers: LAYER_EXPOSURES[SiriusLayer.APP],
      artifactId: undefined,
      isMultiModule: false,
    };
  }

  const artifactId = project.artifactId as string | undefined;
  const isMultiModule = hasModulesSection(project);

  // Step 1: Check if the artifact itself is a known Sirius module
  if (artifactId && artifactId in ARTIFACT_TO_LAYER) {
    const layer = ARTIFACT_TO_LAYER[artifactId];
    return {
      layer,
      exposedLayers: LAYER_EXPOSURES[layer],
      artifactId,
      isMultiModule,
    };
  }

  // Step 2: Scan dependencies for Sirius artifacts
  const detectedLayer = detectLayerFromDependencies(project);
  const layer = detectedLayer ?? SiriusLayer.APP;

  return {
    layer,
    exposedLayers: LAYER_EXPOSURES[layer],
    artifactId,
    isMultiModule,
  };
}

/**
 * Detects workspace information by reading a pom.xml file from the given directory path.
 */
export async function detectWorkspaceFromPath(
  path: string,
): Promise<WorkspaceInfo> {
  const pomPath = join(path, "pom.xml");
  try {
    const content = await readFile(pomPath, "utf-8");
    return detectWorkspace(content);
  } catch {
    // File doesn't exist or can't be read - default to APP
    return {
      layer: SiriusLayer.APP,
      exposedLayers: LAYER_EXPOSURES[SiriusLayer.APP],
      artifactId: undefined,
      isMultiModule: false,
    };
  }
}

/**
 * Checks whether the project has a <modules> section, indicating a multi-module POM.
 */
function hasModulesSection(project: Record<string, unknown>): boolean {
  return project.modules !== undefined && project.modules !== null;
}

/**
 * Scans the <dependencies> section for Sirius artifacts and returns the highest
 * detected layer, or undefined if no Sirius dependencies are found.
 *
 * The "highest" layer is determined by priority: BIZ > WEB/DB > KERNEL.
 * If sirius-biz is found, the result is APP (since this is a consuming application).
 */
function detectLayerFromDependencies(
  project: Record<string, unknown>,
): SiriusLayer | undefined {
  const deps = project.dependencies as Record<string, unknown> | undefined;
  if (!deps) return undefined;

  const depList = normalizeDependencies(deps.dependency);
  if (depList.length === 0) return undefined;

  // Collect all Sirius layers found in dependencies
  const foundLayers = new Set<SiriusLayer>();
  for (const dep of depList) {
    const depArtifactId = dep.artifactId as string | undefined;
    if (depArtifactId && depArtifactId in ARTIFACT_TO_LAYER) {
      foundLayers.add(ARTIFACT_TO_LAYER[depArtifactId]);
    }
  }

  if (foundLayers.size === 0) return undefined;

  // If sirius-biz is a dependency, this is an APP-level project
  if (foundLayers.has(SiriusLayer.BIZ)) return SiriusLayer.APP;

  // Otherwise determine the highest layer present
  // Priority order for dependency-based detection
  const layerPriority: SiriusLayer[] = [
    SiriusLayer.WEB,
    SiriusLayer.DB,
    SiriusLayer.KERNEL,
  ];

  for (const layer of layerPriority) {
    if (foundLayers.has(layer)) return SiriusLayer.APP;
  }

  return SiriusLayer.APP;
}

/**
 * Normalizes the dependency value from fast-xml-parser into an array.
 * Single dependencies come as objects, multiple as arrays.
 */
function normalizeDependencies(
  dep: unknown,
): Array<Record<string, unknown>> {
  if (!dep) return [];
  if (Array.isArray(dep)) return dep as Array<Record<string, unknown>>;
  return [dep as Record<string, unknown>];
}
