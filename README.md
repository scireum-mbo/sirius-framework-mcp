# sirius-framework-mcp

MCP server for the [Sirius framework](https://www.sirius-lib.net).

Helps AI assistants understand Sirius framework patterns. Provides pattern documentation (resources), codebase introspection (tools), and guided workflows (prompts).

## Installation

### Option 1: Local install (recommended for development)

```bash
git clone <this-repo>
cd sirius-framework-mcp
npm install
npm run build
npm link
```

### Option 2: Global install from npm

```bash
npm install -g sirius-framework-mcp
```

## Setup

### Claude Code (global — works in every session)

```bash
claude mcp add sirius --scope user -- sirius-framework-mcp
```

That's it. The server auto-detects which Sirius module you're working in from `pom.xml`.

### Claude Code (per-project)

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "sirius": {
      "command": "sirius-framework-mcp"
    }
  }
}
```

### Cursor

Create `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "sirius": {
      "command": "sirius-framework-mcp"
    }
  }
}
```

## Try it out

After setup, **start a new Claude Code session** (the MCP server connects on startup) and try:

**Read a pattern guide:**
> "Read the sirius entity-triple pattern and explain it"

**Introspect the codebase:**
> "List all entities in this project"
> "Show me all framework flags"
> "What routes are available?"

**Scaffold code:**
> "Scaffold a new entity called Invoice with fields amount and dueDate"

**Use a guided workflow:**
> "I want to add a new background job called InvoiceSync"
> "My entity isn't being picked up — help me debug"

## Workspace detection

The server automatically detects which Sirius layer your project belongs to by reading `pom.xml`:

| Detected artifact | Layer | Resources exposed |
|-------------------|-------|-------------------|
| `sirius-kernel` | kernel | kernel only |
| `sirius-web` | web | kernel, web |
| `sirius-db` | db | kernel, db |
| `sirius-biz` | biz | kernel, web, db, biz |
| Any other project | app | all layers |

Multi-module Maven projects are detected automatically.

## Available resources

24 pattern documentation files organized by framework layer.

### Kernel (5)

| URI | Description |
|-----|-------------|
| `sirius://kernel/di` | Dependency injection: @Part, @Parts, @Register, @ConfigValue |
| `sirius://kernel/lifecycle` | Lifecycle interfaces: Startable, Stoppable, Killable |
| `sirius://kernel/async` | Async primitives: Tasks, CallContext, Promise, DelayLine |
| `sirius://kernel/config` | Configuration: HOCON, file precedence, framework flags |
| `sirius://kernel/commons` | Utilities: NLS, Strings, Value, Amount, Explain |

### Web (3)

| URI | Description |
|-----|-------------|
| `sirius://web/controllers` | Controllers: BasicController, @Routed, @Permission |
| `sirius://web/services` | API services: @PublicService, @InternalService |
| `sirius://web/templates` | Pasta/Tagliatelle template engine |

### DB (5)

| URI | Description |
|-----|-------------|
| `sirius://db/entities` | Entity base classes: SQLEntity, MongoEntity, ElasticEntity |
| `sirius://db/composites` | Composite pattern: reusable embedded data structures |
| `sirius://db/refs` | Entity references: SQLEntityRef, MongoRef, OnDelete |
| `sirius://db/queries` | Query API: OMA, Mango, Elastic query patterns |
| `sirius://db/mixing` | Mixing ORM: descriptors, properties, schema management |

### Biz (11)

| URI | Description |
|-----|-------------|
| `sirius://biz/entity-triple` | Entity triple: interface + SQL + Mongo pattern |
| `sirius://biz/biz-controller` | BizController: tenant-aware CRUD controllers |
| `sirius://biz/jobs` | JobFactory hierarchy: batch, report, interactive jobs |
| `sirius://biz/processes` | Process monitoring: logging, progress, output |
| `sirius://biz/importer` | Data import: handlers, events, batch operations |
| `sirius://biz/tenants` | Multi-tenancy: Tenant, UserAccount, permissions |
| `sirius://biz/storage` | Object storage: Layer1/Layer2/Layer3 |
| `sirius://biz/analytics` | Metrics, execution flags, performance data |
| `sirius://biz/codelists` | Code lists, lookup tables, LookupValue |
| `sirius://biz/isenguard` | Rate limiting, @RateLimited, firewall |
| `sirius://biz/testing` | Kotlin/JUnit 5 testing with SiriusExtension |

## Available tools

### Introspection (6)

| Tool | Description |
|------|-------------|
| `list-entities` | Scan for entity classes (SQL, Mongo, Elastic) |
| `list-framework-flags` | Parse component-*.conf for sirius.frameworks flags |
| `list-routes` | Extract @Routed endpoints from controllers |
| `list-jobs` | Find JobFactory implementations |
| `list-composites` | Find Composite subclasses |
| `list-controllers` | Find controller classes with their routes |

### Scaffolding (5)

| Tool | Description |
|------|-------------|
| `scaffold-entity` | Generate entity triple (interface + JDBC + Mongo) |
| `scaffold-job` | Generate a background job skeleton |
| `scaffold-test` | Generate a Kotlin test class |
| `scaffold-composite` | Generate a Composite class |
| `scaffold-controller` | Generate a BizController with routes |

## Available prompts

| Prompt | Description |
|--------|-------------|
| `add-entity` | Guided: add a new entity with the triple pattern |
| `add-job` | Guided: add a background job |
| `add-feature` | Guided: add a full feature module (entity + controller + template + test) |
| `add-import-handler` | Guided: add a data import handler |
| `debug-framework-flags` | Guided: diagnose entity/service not being picked up |

## Related repositories

- [sirius-kernel](https://github.com/scireum/sirius-kernel) — Core framework (DI, config, commons)
- [sirius-web](https://github.com/scireum/sirius-web) — Web framework (HTTP, controllers, templates)
- [sirius-db](https://github.com/scireum/sirius-db) — Database abstraction (Mixing ORM)
- [sirius-biz](https://github.com/scireum/sirius-biz) — Business framework (tenants, jobs, storage)

## License

MIT
