import { loadResource, ResourceDefinition } from "./loader.js";

type LayerFilter = string;

/**
 * Registry of all Sirius framework resource documents.
 *
 * Resources are markdown files organized by layer (kernel, web, db, biz).
 * The registry loads all resources at construction time and provides
 * methods for querying by layer or URI.
 */
export class ResourceRegistry {
  private resources: ResourceDefinition[];
  private byUri: Map<string, ResourceDefinition>;

  constructor() {
    this.resources = [
      // Kernel (5)
      loadResource("kernel", "di", "Dependency injection patterns: @Part, @Parts, @Register, @ConfigValue"),
      loadResource("kernel", "lifecycle", "Lifecycle interfaces: Startable, Stoppable, Killable"),
      loadResource("kernel", "async", "Async primitives: Tasks, CallContext, Promise, DelayLine"),
      loadResource("kernel", "config", "Configuration system: HOCON, file precedence, framework flags"),
      loadResource("kernel", "commons", "Common utilities: NLS, Strings, Value, Amount, Explain"),

      // Web (3)
      loadResource("web", "controllers", "Web controllers: routing, request handling, response rendering"),
      loadResource("web", "services", "Web services: JSON APIs, ServiceCall, structured endpoints"),
      loadResource("web", "templates", "Pasta/Tagliatelle template engine: syntax, tags, extensions"),

      // DB (5)
      loadResource("db", "entities", "Entity definitions: SQLEntity, MongoEntity, ElasticEntity"),
      loadResource("db", "composites", "Composite pattern: reusable embedded data structures"),
      loadResource("db", "refs", "References and foreign keys: EntityRef, BaseEntityRef"),
      loadResource("db", "queries", "Query API: SmartQuery, filters, pagination, aggregation"),
      loadResource("db", "mixing", "Mixing ORM: Mixins, annotations, schema management"),

      // Biz (11)
      loadResource("biz", "entity-triple", "Entity triple pattern: interface + SQL + Mongo implementations"),
      loadResource("biz", "biz-controller", "BizController base class: tenant-aware controllers"),
      loadResource("biz", "jobs", "Jobs framework: background job definitions, factories, parameters"),
      loadResource("biz", "processes", "Process monitoring: logs, counters, state tracking"),
      loadResource("biz", "importer", "Data import framework: ImportHandler, EntityImportHandler"),
      loadResource("biz", "tenants", "Multi-tenant management: Tenant, UserAccount, permissions"),
      loadResource("biz", "storage", "Object storage: Layer1 (physical), Layer2 (metadata), Layer3 (VFS)"),
      loadResource("biz", "analytics", "Analytics: metrics, events, Clickhouse integration"),
      loadResource("biz", "codelists", "Code lists: lookup tables, managed enumerations"),
      loadResource("biz", "isenguard", "Isenguard: rate limiting, firewall, IP blocking"),
      loadResource("biz", "testing", "Testing patterns: SiriusExtension, test entities, scenarios"),
    ];

    this.byUri = new Map();
    for (const resource of this.resources) {
      this.byUri.set(resource.uri, resource);
    }
  }

  /**
   * Returns all resources whose layer is included in the given list.
   */
  getResourcesForLayers(layers: LayerFilter[]): ResourceDefinition[] {
    const layerSet = new Set(layers.map((l) => l.toLowerCase()));
    return this.resources.filter((r) => layerSet.has(r.layer));
  }

  /**
   * Returns a single resource by its URI, or undefined if not found.
   */
  getResource(uri: string): ResourceDefinition | undefined {
    return this.byUri.get(uri);
  }

  /**
   * Returns all registered resources.
   */
  getAllResources(): ResourceDefinition[] {
    return [...this.resources];
  }
}
