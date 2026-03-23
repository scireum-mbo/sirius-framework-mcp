#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { detectWorkspaceFromPath, WorkspaceInfo } from "./workspace.js";
import { ResourceRegistry } from "./resources/index.js";
import {
  listEntities,
  listFrameworkFlags,
  listRoutes,
  listJobs,
  listComposites,
  listControllers,
  scaffoldEntity,
  scaffoldJob,
  scaffoldTest,
  scaffoldComposite,
  scaffoldController,
} from "./tools/index.js";
import type { ScaffoldResult } from "./tools/index.js";
import { allPrompts } from "./prompts/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a ScaffoldResult into a single text block with file separators. */
function formatScaffoldResult(result: ScaffoldResult): string {
  return result.files
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join("\n");
}

/** Wrap a value in an MCP text content response. */
function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const workspacePath =
    process.env.SIRIUS_WORKSPACE ?? process.cwd();

  let workspace: WorkspaceInfo;
  try {
    workspace = await detectWorkspaceFromPath(workspacePath);
  } catch (err) {
    console.error("Failed to detect workspace:", err);
    process.exit(1);
  }

  console.error(
    `[sirius-framework-mcp] Layer detected: ${workspace.layer}`,
  );
  console.error(
    `[sirius-framework-mcp] Exposed layers: ${workspace.exposedLayers.join(", ")}`,
  );

  // Create the MCP server
  const server = new McpServer({
    name: "sirius-framework-mcp",
    version: "0.1.0",
  });

  // -----------------------------------------------------------------------
  // Resources
  // -----------------------------------------------------------------------

  try {
    const registry = new ResourceRegistry();
    const exposedLayerNames = workspace.exposedLayers.map((l) =>
      l.toLowerCase(),
    );
    const resources = registry.getResourcesForLayers(exposedLayerNames);

    for (const res of resources) {
      try {
        server.resource(res.name, res.uri, async () => ({
          contents: [
            {
              uri: res.uri,
              mimeType: res.mimeType,
              text: res.content,
            },
          ],
        }));
      } catch (err) {
        console.error(
          `[sirius-framework-mcp] Failed to register resource ${res.uri}:`,
          err,
        );
      }
    }

    console.error(
      `[sirius-framework-mcp] Registered ${resources.length} resources`,
    );
  } catch (err) {
    console.error("[sirius-framework-mcp] Failed to load resources:", err);
  }

  // -----------------------------------------------------------------------
  // Introspection tools
  // -----------------------------------------------------------------------

  const defaultJavaPath = `${workspacePath}/src/main/java`;
  const defaultResourcesPath = `${workspacePath}/src/main/resources`;

  server.tool(
    "list-entities",
    "Scan the workspace for Sirius entity classes (SQL, Mongo, Elastic)",
    { path: z.string().optional() },
    async ({ path }) => {
      const result = await listEntities(path ?? defaultJavaPath);
      return textResult(JSON.stringify(result, null, 2));
    },
  );

  server.tool(
    "list-framework-flags",
    "Parse component-*.conf files for sirius.frameworks flags",
    { path: z.string().optional() },
    async ({ path }) => {
      const result = await listFrameworkFlags(
        path ?? defaultResourcesPath,
      );
      return textResult(JSON.stringify(result, null, 2));
    },
  );

  server.tool(
    "list-routes",
    "Extract @Routed endpoints from controller classes",
    {
      path: z.string().optional(),
      prefix: z.string().optional(),
    },
    async ({ path, prefix }) => {
      const result = await listRoutes(
        path ?? defaultJavaPath,
        prefix ?? undefined,
      );
      return textResult(JSON.stringify(result, null, 2));
    },
  );

  server.tool(
    "list-jobs",
    "Find JobFactory implementations in the workspace",
    { path: z.string().optional() },
    async ({ path }) => {
      const result = await listJobs(path ?? defaultJavaPath);
      return textResult(JSON.stringify(result, null, 2));
    },
  );

  server.tool(
    "list-composites",
    "Find Composite classes in the workspace",
    { path: z.string().optional() },
    async ({ path }) => {
      const result = await listComposites(path ?? defaultJavaPath);
      return textResult(JSON.stringify(result, null, 2));
    },
  );

  server.tool(
    "list-controllers",
    "Find controller classes (BizController, BasicController) in the workspace",
    { path: z.string().optional() },
    async ({ path }) => {
      const result = await listControllers(path ?? defaultJavaPath);
      return textResult(JSON.stringify(result, null, 2));
    },
  );

  // -----------------------------------------------------------------------
  // Scaffold tools
  // -----------------------------------------------------------------------

  server.tool(
    "scaffold-entity",
    "Generate boilerplate code for a Sirius entity (interface + implementations)",
    {
      name: z.string(),
      package: z.string(),
      targets: z
        .array(z.enum(["jdbc", "mongo", "elastic"]))
        .default(["jdbc", "mongo"]),
      tenantAware: z.boolean().default(true),
      fields: z
        .array(
          z.object({
            name: z.string(),
            type: z.string(),
            length: z.number().optional(),
            annotations: z.array(z.string()).optional(),
          }),
        )
        .optional(),
      mixins: z.array(z.string()).optional(),
    },
    async (args) => {
      const result = scaffoldEntity({
        name: args.name,
        package: args.package,
        targets: args.targets,
        tenantAware: args.tenantAware,
        fields: args.fields,
        mixins: args.mixins,
      });
      return textResult(formatScaffoldResult(result));
    },
  );

  server.tool(
    "scaffold-job",
    "Generate boilerplate code for a Sirius background job",
    {
      name: z.string(),
      package: z.string(),
      type: z
        .enum([
          "SimpleBatchProcessJobFactory",
          "BatchProcessJobFactory",
          "ImportBatchProcessFactory",
          "ExportBatchProcessFactory",
          "ReportJobFactory",
          "InteractiveJobFactory",
        ])
        .default("SimpleBatchProcessJobFactory"),
      framework: z.string().optional(),
      parameters: z.array(z.string()).optional(),
    },
    async (args) => {
      const result = scaffoldJob({
        name: args.name,
        package: args.package,
        type: args.type,
        framework: args.framework,
        parameters: args.parameters,
      });
      return textResult(formatScaffoldResult(result));
    },
  );

  server.tool(
    "scaffold-composite",
    "Generate boilerplate code for a Sirius Composite data class",
    {
      name: z.string(),
      package: z.string(),
      fields: z
        .array(
          z.object({
            name: z.string(),
            type: z.string(),
            length: z.number().optional(),
            annotations: z.array(z.string()).optional(),
          }),
        )
        .optional(),
    },
    async (args) => {
      const result = scaffoldComposite({
        name: args.name,
        package: args.package,
        fields: args.fields,
      });
      return textResult(formatScaffoldResult(result));
    },
  );

  server.tool(
    "scaffold-test",
    "Generate boilerplate code for a Sirius Kotlin test class",
    {
      name: z.string(),
      package: z.string(),
      setupParts: z.array(z.string()).optional(),
    },
    async (args) => {
      const result = scaffoldTest({
        name: args.name,
        package: args.package,
        setupParts: args.setupParts,
      });
      return textResult(formatScaffoldResult(result));
    },
  );

  server.tool(
    "scaffold-controller",
    "Generate boilerplate code for a Sirius BizController",
    {
      name: z.string(),
      package: z.string(),
      entity: z.string().optional(),
      permissions: z.array(z.string()).optional(),
    },
    async (args) => {
      const result = scaffoldController({
        name: args.name,
        package: args.package,
        entity: args.entity,
        permissions: args.permissions,
      });
      return textResult(formatScaffoldResult(result));
    },
  );

  // -----------------------------------------------------------------------
  // Prompts
  // -----------------------------------------------------------------------

  for (const prompt of allPrompts) {
    try {
      // Build a zod schema from the prompt's arguments array.
      // Each argument maps to an optional or required z.string() field.
      const schemaShape: Record<string, z.ZodType> = {};
      for (const arg of prompt.arguments) {
        if (arg.required) {
          schemaShape[arg.name] = z.string();
        } else {
          schemaShape[arg.name] = z.string().optional();
        }
      }

      if (prompt.arguments.length > 0) {
        server.prompt(
          prompt.name,
          prompt.description,
          schemaShape,
          async (args) => {
            const messages = prompt.generateMessages(
              args as Record<string, string>,
            );
            return { messages };
          },
        );
      } else {
        server.prompt(
          prompt.name,
          prompt.description,
          async () => {
            const messages = prompt.generateMessages({});
            return { messages };
          },
        );
      }
    } catch (err) {
      console.error(
        `[sirius-framework-mcp] Failed to register prompt ${prompt.name}:`,
        err,
      );
    }
  }

  console.error(
    `[sirius-framework-mcp] Registered ${allPrompts.length} prompts`,
  );

  // -----------------------------------------------------------------------
  // Connect
  // -----------------------------------------------------------------------

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[sirius-framework-mcp] Server started on stdio transport");
}

main().catch((err) => {
  console.error("[sirius-framework-mcp] Fatal error:", err);
  process.exit(1);
});
