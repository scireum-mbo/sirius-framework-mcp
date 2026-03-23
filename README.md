# sirius-mcp

MCP server for the [Sirius framework](https://www.sirius-lib.net).

Helps AI assistants (Claude Code, Cursor, etc.) understand Sirius framework patterns. Provides pattern documentation (resources), codebase introspection (tools), and guided workflows (prompts).

## Installation

```bash
npx sirius-mcp
```

Or install globally:

```bash
npm install -g sirius-mcp
```

## Configuration

### Claude Code

Add to your `.claude/mcp.json` or `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "sirius": {
      "command": "npx",
      "args": ["sirius-mcp"],
      "env": {
        "SIRIUS_WORKSPACE": "/path/to/your/sirius/project"
      }
    }
  }
}
```

### Cursor

Add the same JSON to `.cursor/mcp.json` in your project root.

## Workspace detection

The server automatically detects which Sirius layer your project belongs to by parsing `pom.xml`:

- If the artifact is `sirius-kernel`, `sirius-web`, `sirius-db`, or `sirius-biz`, only the relevant layers are exposed.
- If your project depends on a Sirius artifact, it is treated as an application and all layers are exposed.
- Multi-module POMs are detected automatically.

Set `SIRIUS_WORKSPACE` to the project root containing the `pom.xml`.

## Available resources

24 pattern documentation files organized by framework layer.

### Kernel (5)

| URI | Description |
|-----|-------------|
| `sirius://kernel/di` | Dependency injection patterns: @Part, @Parts, @Register, @ConfigValue |
| `sirius://kernel/lifecycle` | Lifecycle interfaces: Startable, Stoppable, Killable |
| `sirius://kernel/async` | Async primitives: Tasks, CallContext, Promise, DelayLine |
| `sirius://kernel/config` | Configuration system: HOCON, file precedence, framework flags |
| `sirius://kernel/commons` | Common utilities: NLS, Strings, Value, Amount, Explain |

### Web (3)

| URI | Description |
|-----|-------------|
| `sirius://web/controllers` | Web controllers: routing, request handling, response rendering |
| `sirius://web/services` | Web services: JSON APIs, ServiceCall, structured endpoints |
| `sirius://web/templates` | Pasta/Tagliatelle template engine: syntax, tags, extensions |

### DB (5)

| URI | Description |
|-----|-------------|
| `sirius://db/entities` | Entity definitions: SQLEntity, MongoEntity, ElasticEntity |
| `sirius://db/composites` | Composite pattern: reusable embedded data structures |
| `sirius://db/refs` | References and foreign keys: EntityRef, BaseEntityRef |
| `sirius://db/queries` | Query API: SmartQuery, filters, pagination, aggregation |
| `sirius://db/mixing` | Mixing ORM: Mixins, annotations, schema management |

### Biz (11)

| URI | Description |
|-----|-------------|
| `sirius://biz/entity-triple` | Entity triple pattern: interface + SQL + Mongo implementations |
| `sirius://biz/biz-controller` | BizController base class: tenant-aware controllers |
| `sirius://biz/jobs` | Jobs framework: background job definitions, factories, parameters |
| `sirius://biz/processes` | Process monitoring: logs, counters, state tracking |
| `sirius://biz/importer` | Data import framework: ImportHandler, EntityImportHandler |
| `sirius://biz/tenants` | Multi-tenant management: Tenant, UserAccount, permissions |
| `sirius://biz/storage` | Object storage: Layer1 (physical), Layer2 (metadata), Layer3 (VFS) |
| `sirius://biz/analytics` | Analytics: metrics, events, Clickhouse integration |
| `sirius://biz/codelists` | Code lists: lookup tables, managed enumerations |
| `sirius://biz/isenguard` | Isenguard: rate limiting, firewall, IP blocking |
| `sirius://biz/testing` | Testing patterns: SiriusExtension, test entities, scenarios |

## Available tools

### Introspection (6)

| Tool | Description |
|------|-------------|
| `list-entities` | Scan Java source files for entity classes (SQL, Mongo, Elastic) |
| `list-framework-flags` | Parse component-*.conf files for sirius.frameworks flags |
| `list-routes` | Extract @Routed endpoints from controllers, optionally filtered by prefix |
| `list-jobs` | Find JobFactory implementations (batch, report, interactive) |
| `list-composites` | Find Composite subclasses in the codebase |
| `list-controllers` | Find BizController/BasicController subclasses with their routes |

### Scaffold (5)

| Tool | Description |
|------|-------------|
| `scaffold-entity` | Generate entity triple boilerplate (interface + JDBC + Mongo) |
| `scaffold-job` | Generate a background job skeleton |
| `scaffold-test` | Generate a Kotlin test class with SiriusExtension |
| `scaffold-composite` | Generate a Composite class with fields and accessors |
| `scaffold-controller` | Generate a BizController with route methods |

## Available prompts

| Prompt | Description |
|--------|-------------|
| `add-entity` | Guided workflow: add a new Sirius entity using the entity-triple pattern |
| `add-job` | Guided workflow: add a new background job (batch, report, or interactive) |
| `add-feature` | Guided workflow: add a complete feature module (entity + controller + template + test) |
| `add-import-handler` | Guided workflow: add a data import handler for an entity |
| `debug-framework-flags` | Guided workflow: diagnose why an entity or service is not being picked up |

## Related repositories

- [sirius-kernel](https://github.com/scireum/sirius-kernel) -- Core framework (DI, config, commons)
- [sirius-web](https://github.com/scireum/sirius-web) -- Web framework (HTTP, controllers, templates)
- [sirius-db](https://github.com/scireum/sirius-db) -- Database abstraction layer (Mixing ORM)
- [sirius-biz](https://github.com/scireum/sirius-biz) -- Business framework (tenants, jobs, storage)

## License

MIT
