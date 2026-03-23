import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  layer: string;
  mimeType: string;
  content: string;
}

export function loadResource(
  layer: string,
  name: string,
  description: string,
): ResourceDefinition {
  const filePath = join(__dirname, layer, `${name}.md`);
  const content = readFileSync(filePath, "utf-8");
  return {
    uri: `sirius://${layer}/${name}`,
    name: `${layer}/${name}`,
    description,
    layer,
    mimeType: "text/markdown",
    content,
  };
}
