import { describe, it, expect } from "vitest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  listEntities,
  listFrameworkFlags,
  listRoutes,
  listComposites,
  listJobs,
  listControllers,
} from "../tools/introspection.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(__dirname, "fixtures");

describe("listEntities", () => {
  it("should find SampleEntity with superClass SQLTenantAware", async () => {
    const entities = await listEntities(fixtureDir);

    expect(entities.length).toBeGreaterThanOrEqual(1);

    const sample = entities.find((e) => e.name === "SampleEntity");
    expect(sample).toBeDefined();
    expect(sample!.superClass).toBe("SQLTenantAware");
    expect(sample!.type).toBe("sql");
    expect(sample!.packageName).toBe("sirius.biz.test");
    expect(sample!.mappings).toContain("NAME");
    expect(sample!.mappings).toContain("DESCRIPTION");
  });
});

describe("listFrameworkFlags", () => {
  it("should find biz.tenants in sirius-biz conf", async () => {
    const flags = await listFrameworkFlags(
      "/Users/mbo/dev/sirius-biz/src/main/resources",
    );

    expect(flags.length).toBeGreaterThan(0);

    const tenants = flags.find((f) => f.name === "biz.tenants");
    expect(tenants).toBeDefined();
    expect(tenants!.defaultValue).toBe(false);
    expect(tenants!.description).not.toBe("");
  });
});

describe("listRoutes", () => {
  it("should find /things route in fixtures", async () => {
    const routes = await listRoutes(fixtureDir);

    expect(routes.length).toBeGreaterThanOrEqual(1);

    const thingsRoute = routes.find((r) => r.path === "/things");
    expect(thingsRoute).toBeDefined();
    expect(thingsRoute!.loginRequired).toBe(true);
    expect(thingsRoute!.permissions).toContain("permission-manage-things");
    expect(thingsRoute!.controller).toBe("SampleController");
  });

  it("should filter routes by prefix", async () => {
    const routes = await listRoutes(fixtureDir, "/thing");

    // Should include both /things and /thing/:1
    expect(routes.length).toBe(2);

    const noMatch = await listRoutes(fixtureDir, "/nonexistent");
    expect(noMatch.length).toBe(0);
  });
});

describe("listComposites", () => {
  it("should find PersonData and AddressData in sirius-biz model", async () => {
    const composites = await listComposites(
      "/Users/mbo/dev/sirius-biz/src/main/java/sirius/biz/model",
    );

    const names = composites.map((c) => c.className);
    expect(names).toContain("PersonData");
    expect(names).toContain("AddressData");
  });
});

describe("listJobs", () => {
  it("should find SampleJob in fixtures", async () => {
    const jobs = await listJobs(fixtureDir);

    expect(jobs.length).toBeGreaterThanOrEqual(1);

    const sample = jobs.find((j) => j.className === "SampleJob");
    expect(sample).toBeDefined();
    expect(sample!.superClass).toBe("BasicJobFactory");
  });
});

describe("listControllers", () => {
  it("should find SampleController in fixtures", async () => {
    const controllers = await listControllers(fixtureDir);

    expect(controllers.length).toBeGreaterThanOrEqual(1);

    const sample = controllers.find((c) => c.name === "SampleController");
    expect(sample).toBeDefined();
    expect(sample!.superClass).toBe("BizController");
    expect(sample!.routes.length).toBe(2);

    const paths = sample!.routes.map((r) => r.path);
    expect(paths).toContain("/things");
    expect(paths).toContain("/thing/:1");
  });
});
