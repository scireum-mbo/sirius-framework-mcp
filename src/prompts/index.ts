/**
 * MCP prompts module -- pre-built conversation starters for common Sirius
 * development workflows.
 */

export type { McpPrompt } from "./workflows.js";

import {
  addEntityPrompt,
  addJobPrompt,
  addFeaturePrompt,
  addImportHandlerPrompt,
  debugFrameworkFlagsPrompt,
} from "./workflows.js";

export {
  addEntityPrompt,
  addJobPrompt,
  addFeaturePrompt,
  addImportHandlerPrompt,
  debugFrameworkFlagsPrompt,
};

/** All available MCP prompts. */
export const allPrompts = [
  addEntityPrompt,
  addJobPrompt,
  addFeaturePrompt,
  addImportHandlerPrompt,
  debugFrameworkFlagsPrompt,
];
