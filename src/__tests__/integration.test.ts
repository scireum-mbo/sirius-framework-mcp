import { describe, it, expect } from "vitest";
import { detectWorkspaceFromPath, SiriusLayer } from "../workspace.js";
import {
  listEntities,
  listFrameworkFlags,
  listRoutes,
  listJobs,
  listComposites,
  listControllers,
} from "../tools/index.js";

const SIRIUS_BIZ_ROOT = "/Users/mbo/dev/sirius-biz";
const SIRIUS_BIZ_JAVA = `${SIRIUS_BIZ_ROOT}/src/main/java`;
const SIRIUS_BIZ_RESOURCES = `${SIRIUS_BIZ_ROOT}/src/main/resources`;

describe("sirius-biz integration tests", { timeout: 60_000 }, () => {
  describe("workspace detection", () => {
    it("should detect sirius-biz as layer BIZ with correct artifactId", async () => {
      const info = await detectWorkspaceFromPath(SIRIUS_BIZ_ROOT);

      expect(info.layer).toBe(SiriusLayer.BIZ);
      expect(info.artifactId).toBe("sirius-biz");
    });
  });

  describe("listEntities", () => {
    it("should find SQLTenant and MongoTenant among 50+ entities", async () => {
      const entities = await listEntities(SIRIUS_BIZ_JAVA);

      const names = entities.map((e) => e.name);
      expect(names).toContain("SQLTenant");
      expect(names).toContain("MongoTenant");
      expect(entities.length).toBeGreaterThan(30);
    });
  });

  describe("listFrameworkFlags", () => {
    it("should find biz.tenants, biz.processes, and biz.jobs flags", async () => {
      const flags = await listFrameworkFlags(SIRIUS_BIZ_RESOURCES);

      const flagNames = flags.map((f) => f.name);
      expect(flagNames).toContain("biz.tenants");
      expect(flagNames).toContain("biz.processes");
      expect(flagNames).toContain("biz.jobs");
    });
  });

  describe("listRoutes", () => {
    it("should find more than 10 routes including one with tenant", async () => {
      const routes = await listRoutes(SIRIUS_BIZ_JAVA);

      expect(routes.length).toBeGreaterThan(10);

      const hasTenantRoute = routes.some((r) =>
        r.path.toLowerCase().includes("tenant"),
      );
      expect(hasTenantRoute).toBe(true);
    });
  });

  describe("listJobs", () => {
    it("should find more than 5 jobs", async () => {
      const jobs = await listJobs(SIRIUS_BIZ_JAVA);

      expect(jobs.length).toBeGreaterThan(5);
    });
  });

  describe("listComposites", () => {
    it("should find PersonData and AddressData", async () => {
      const composites = await listComposites(SIRIUS_BIZ_JAVA);

      const names = composites.map((c) => c.className);
      expect(names).toContain("PersonData");
      expect(names).toContain("AddressData");
    });
  });

  describe("listControllers", () => {
    it("should find more than 5 controllers", async () => {
      const controllers = await listControllers(SIRIUS_BIZ_JAVA);

      expect(controllers.length).toBeGreaterThan(5);
    });
  });
});
