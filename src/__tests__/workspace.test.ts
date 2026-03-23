import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  detectWorkspace,
  detectWorkspaceFromPath,
  SiriusLayer,
} from "../workspace.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf-8");
}

describe("detectWorkspace", () => {
  it("should detect sirius-kernel by artifact ID", () => {
    const pomXml = readFixture("pom-kernel.xml");
    const info = detectWorkspace(pomXml);

    expect(info.layer).toBe(SiriusLayer.KERNEL);
    expect(info.artifactId).toBe("sirius-kernel");
    expect(info.exposedLayers).toEqual([SiriusLayer.KERNEL]);
    expect(info.isMultiModule).toBe(false);
  });

  it("should detect sirius-biz by artifact ID with kernel, web, db, biz layers", () => {
    const pomXml = readFixture("pom-biz.xml");
    const info = detectWorkspace(pomXml);

    expect(info.layer).toBe(SiriusLayer.BIZ);
    expect(info.artifactId).toBe("sirius-biz");
    expect(info.exposedLayers).toEqual([
      SiriusLayer.KERNEL,
      SiriusLayer.WEB,
      SiriusLayer.DB,
      SiriusLayer.BIZ,
    ]);
    expect(info.isMultiModule).toBe(false);
  });

  it("should detect APP layer when sirius-biz is a dependency", () => {
    const pomXml = readFixture("pom-app.xml");
    const info = detectWorkspace(pomXml);

    expect(info.layer).toBe(SiriusLayer.APP);
    expect(info.artifactId).toBe("my-app");
    expect(info.exposedLayers).toEqual([
      SiriusLayer.KERNEL,
      SiriusLayer.WEB,
      SiriusLayer.DB,
      SiriusLayer.BIZ,
      SiriusLayer.APP,
    ]);
    expect(info.isMultiModule).toBe(false);
  });

  it("should detect multi-module parent POM", () => {
    const pomXml = readFixture("pom-parent.xml");
    const info = detectWorkspace(pomXml);

    expect(info.isMultiModule).toBe(true);
    expect(info.artifactId).toBe("my-parent");
    // Parent POM with no Sirius dependencies defaults to APP
    expect(info.layer).toBe(SiriusLayer.APP);
  });

  it("should default to APP with all layers for empty input", () => {
    const info = detectWorkspace("");

    expect(info.layer).toBe(SiriusLayer.APP);
    expect(info.artifactId).toBeUndefined();
    expect(info.exposedLayers).toEqual([
      SiriusLayer.KERNEL,
      SiriusLayer.WEB,
      SiriusLayer.DB,
      SiriusLayer.BIZ,
      SiriusLayer.APP,
    ]);
    expect(info.isMultiModule).toBe(false);
  });
});

describe("detectWorkspaceFromPath", () => {
  it("should read pom.xml from a directory path", async () => {
    const info = await detectWorkspaceFromPath(fixturesDir);
    // No pom.xml in fixtures dir, should default to APP
    expect(info.layer).toBe(SiriusLayer.APP);
  });
});
