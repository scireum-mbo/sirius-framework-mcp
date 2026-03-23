import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseJavaFile } from "../java-parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readFixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf-8");
}

describe("parseJavaFile", () => {
  it("should extract class name and superclass from entity", async () => {
    const source = readFixture("SampleEntity.java");
    const result = await parseJavaFile(source);

    expect(result.className).toBe("SampleEntity");
    expect(result.superClass).toContain("SQLTenantAware");
  });

  it("should extract annotations from entity", async () => {
    const source = readFixture("SampleEntity.java");
    const result = await parseJavaFile(source);

    const annotationNames = result.annotations.map((a) => a.name);
    expect(annotationNames).toContain("Framework");
  });

  it("should extract Mapping constants", async () => {
    const source = readFixture("SampleEntity.java");
    const result = await parseJavaFile(source);

    expect(result.mappings).toContain("NAME");
    expect(result.mappings).toContain("DESCRIPTION");
  });

  it("should extract routes from controller", async () => {
    const source = readFixture("SampleController.java");
    const result = await parseJavaFile(source);

    const paths = result.routes.map((r) => r.path);
    expect(paths).toContain("/things");
    expect(paths).toContain("/thing/:1");

    const thingsRoute = result.routes.find((r) => r.path === "/things");
    expect(thingsRoute).toBeDefined();
    expect(thingsRoute!.loginRequired).toBe(true);
    expect(thingsRoute!.permissions).toContain("permission-manage-things");

    const thingRoute = result.routes.find((r) => r.path === "/thing/:1");
    expect(thingRoute).toBeDefined();
    expect(thingRoute!.loginRequired).toBe(true);
    expect(thingRoute!.permissions).toHaveLength(0);
  });

  it("should extract @Register framework arg from job", async () => {
    const source = readFixture("SampleJob.java");
    const result = await parseJavaFile(source);

    const registerAnnotation = result.annotations.find(
      (a) => a.name === "Register",
    );
    expect(registerAnnotation).toBeDefined();
    expect(registerAnnotation!.args["framework"]).toBe("test.jobs");
  });

  it("should extract package name", async () => {
    const source = readFixture("SampleEntity.java");
    const result = await parseJavaFile(source);

    expect(result.packageName).toBe("sirius.biz.test");
  });
});
