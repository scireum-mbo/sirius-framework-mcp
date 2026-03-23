import { cpSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function copyMdFiles(src, dest) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });

  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyMdFiles(srcPath, destPath);
    } else if (entry.endsWith(".md")) {
      cpSync(srcPath, destPath);
    } else if (entry.endsWith(".wasm")) {
      cpSync(srcPath, destPath);
    }
  }
}

// Copy resource markdown files
copyMdFiles(join(root, "src/resources"), join(root, "dist/resources"));

// Copy WASM grammars
copyMdFiles(join(root, "src/grammars"), join(root, "dist/grammars"));

console.log("Resources and grammars copied to dist/");
