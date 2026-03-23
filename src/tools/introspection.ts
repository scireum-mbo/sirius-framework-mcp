import fg from "fast-glob";
import { readFile } from "fs/promises";
import { join } from "path";
import { parseJavaFile, JavaClassInfo, RouteInfo } from "../java-parser.js";

// ---------- Types ----------

export interface EntityInfo {
  name: string;
  packageName: string;
  superClass: string;
  type: "sql" | "mongo" | "elastic" | "unknown";
  annotations: JavaClassInfo["annotations"];
  mappings: string[];
  filePath: string;
}

export interface FrameworkFlag {
  name: string;
  defaultValue: boolean;
  description: string;
  filePath: string;
}

export interface FullRouteInfo extends RouteInfo {
  controller: string;
  filePath: string;
}

export interface ControllerInfo {
  name: string;
  packageName: string;
  superClass: string;
  routes: RouteInfo[];
  filePath: string;
}

// ---------- Constants ----------

const ENTITY_SUPERCLASSES = new Set([
  "SQLEntity",
  "MongoEntity",
  "ElasticEntity",
  "BizEntity",
  "MongoBizEntity",
  "SQLTenantAware",
  "MongoTenantAware",
  "PrefixSearchableEntity",
]);

const JOB_SUPERCLASSES = new Set([
  "BasicJobFactory",
  "InteractiveJobFactory",
  "ReportJobFactory",
  "BatchProcessJobFactory",
  "SimpleBatchProcessJobFactory",
  "ImportBatchProcessFactory",
  "ExportBatchProcessFactory",
]);

const CONTROLLER_SUPERCLASSES = new Set(["BasicController", "BizController"]);

// ---------- Helpers ----------

function inferEntityType(
  superClass: string,
): "sql" | "mongo" | "elastic" | "unknown" {
  if (
    superClass.startsWith("SQL") ||
    superClass === "BizEntity" ||
    superClass === "PrefixSearchableEntity"
  ) {
    return "sql";
  }
  if (superClass.startsWith("Mongo") || superClass === "MongoBizEntity") {
    return "mongo";
  }
  if (superClass.startsWith("Elastic")) {
    return "elastic";
  }
  return "unknown";
}

async function scanJavaFiles(
  basePath: string,
): Promise<{ info: JavaClassInfo; filePath: string }[]> {
  const files = await fg("**/*.java", {
    cwd: basePath,
    absolute: true,
    followSymbolicLinks: false,
  });

  const results: { info: JavaClassInfo; filePath: string }[] = [];

  for (const filePath of files) {
    try {
      const source = await readFile(filePath, "utf-8");
      const info = await parseJavaFile(source);
      results.push({ info, filePath });
    } catch {
      // Skip files that can't be parsed
    }
  }

  return results;
}

// ---------- Public API ----------

/**
 * Scan for entity classes whose superClass matches known entity superclasses.
 */
export async function listEntities(basePath: string): Promise<EntityInfo[]> {
  const parsed = await scanJavaFiles(basePath);
  const entities: EntityInfo[] = [];

  for (const { info, filePath } of parsed) {
    if (info.superClass && ENTITY_SUPERCLASSES.has(info.superClass)) {
      entities.push({
        name: info.className,
        packageName: info.packageName,
        superClass: info.superClass,
        type: inferEntityType(info.superClass),
        annotations: info.annotations,
        mappings: info.mappings,
        filePath,
      });
    }
  }

  return entities;
}

/**
 * Parse HOCON component-*.conf files and extract sirius.frameworks flags.
 */
export async function listFrameworkFlags(
  basePath: string,
): Promise<FrameworkFlag[]> {
  const files = await fg("**/component-*.conf", {
    cwd: basePath,
    absolute: true,
    followSymbolicLinks: false,
  });

  const flags: FrameworkFlag[] = [];

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, "utf-8");
      const parsed = parseFrameworksSection(content, filePath);
      flags.push(...parsed);
    } catch {
      // Skip files that can't be read
    }
  }

  return flags;
}

/**
 * Hand-rolled parser for the sirius.frameworks { ... } block in HOCON conf files.
 * Tracks brace depth and extracts key = value lines with preceding # comments.
 */
function parseFrameworksSection(
  content: string,
  filePath: string,
): FrameworkFlag[] {
  const lines = content.split("\n");
  const flags: FrameworkFlag[] = [];

  let inFrameworks = false;
  let braceDepth = 0;
  let commentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inFrameworks) {
      // Look for the start of sirius.frameworks {
      if (trimmed.startsWith("sirius.frameworks")) {
        inFrameworks = true;
        // Count opening braces on this line
        braceDepth = countBraces(trimmed);
        commentLines = [];
        continue;
      }
      continue;
    }

    // We are inside the sirius.frameworks block
    // Update brace depth
    braceDepth += countBraces(trimmed);

    if (braceDepth <= 0) {
      // We've exited the block
      break;
    }

    // Collect comments
    if (trimmed.startsWith("#")) {
      commentLines.push(trimmed.replace(/^#\s*/, ""));
      continue;
    }

    // Parse key = value lines
    const match = trimmed.match(/^([\w."-]+)\s*=\s*(true|false)\s*$/);
    if (match) {
      const name = match[1];
      const defaultValue = match[2] === "true";
      const description = commentLines.join(" ").trim();

      flags.push({ name, defaultValue, description, filePath });
      commentLines = [];
      continue;
    }

    // Empty lines reset comment accumulation
    if (trimmed === "") {
      commentLines = [];
    }
  }

  return flags;
}

/**
 * Count net brace changes on a line (opening minus closing).
 */
function countBraces(line: string): number {
  let count = 0;
  for (const ch of line) {
    if (ch === "{") count++;
    if (ch === "}") count--;
  }
  return count;
}

/**
 * Extract routes from all Java files. Optionally filter by URI prefix.
 */
export async function listRoutes(
  basePath: string,
  prefix?: string,
): Promise<FullRouteInfo[]> {
  const parsed = await scanJavaFiles(basePath);
  const routes: FullRouteInfo[] = [];

  for (const { info, filePath } of parsed) {
    for (const route of info.routes) {
      if (prefix && !route.path.startsWith(prefix)) {
        continue;
      }
      routes.push({
        ...route,
        controller: info.className,
        filePath,
      });
    }
  }

  return routes;
}

/**
 * Find JobFactory implementations by matching known job superclasses.
 */
export async function listJobs(
  basePath: string,
): Promise<(JavaClassInfo & { filePath: string })[]> {
  const parsed = await scanJavaFiles(basePath);
  const jobs: (JavaClassInfo & { filePath: string })[] = [];

  for (const { info, filePath } of parsed) {
    if (info.superClass && JOB_SUPERCLASSES.has(info.superClass)) {
      jobs.push({ ...info, filePath });
    }
  }

  return jobs;
}

/**
 * Find Composite classes (superClass === "Composite").
 */
export async function listComposites(
  basePath: string,
): Promise<(JavaClassInfo & { filePath: string })[]> {
  const parsed = await scanJavaFiles(basePath);
  const composites: (JavaClassInfo & { filePath: string })[] = [];

  for (const { info, filePath } of parsed) {
    if (info.superClass === "Composite") {
      composites.push({ ...info, filePath });
    }
  }

  return composites;
}

/**
 * Find controller classes by matching known controller superclasses.
 */
export async function listControllers(
  basePath: string,
): Promise<ControllerInfo[]> {
  const parsed = await scanJavaFiles(basePath);
  const controllers: ControllerInfo[] = [];

  for (const { info, filePath } of parsed) {
    if (info.superClass && CONTROLLER_SUPERCLASSES.has(info.superClass)) {
      controllers.push({
        name: info.className,
        packageName: info.packageName,
        superClass: info.superClass,
        routes: info.routes,
        filePath,
      });
    }
  }

  return controllers;
}
