# Configuration System

Sirius uses Typesafe Config (HOCON format) for all configuration. The system
supports layered config files with well-defined precedence and a framework
flag mechanism for enabling/disabling modules.

## HOCON Format

HOCON (Human-Optimized Config Object Notation) is a superset of JSON:

```hocon
http {
    port = 9000
    sessionTimeout = 30 minutes
    ssl.enabled = false
}

# Lists
allowed.hosts = ["localhost", "example.com"]

# Substitutions
app.url = "http://"${http.host}":"${http.port}
```

Key features: comments with `#`, duration/size literals (`30 minutes`, `512MB`),
path expressions with dots, and variable substitution.

## File Precedence

Config files are loaded in this order, with later files overriding earlier ones:

1. **`component-NNN-name.conf`** — Framework defaults, loaded by classpath scan.
   The numeric prefix controls load order (e.g., `component-050-kernel.conf`
   loads before `component-070-biz.conf`).

2. **`application.conf`** — Application-level defaults. This is where a Sirius
   application defines its own configuration.

3. **`develop.conf`** — Development overrides. Loaded only when the system
   property `sirius.debug` is set (automatically set in dev mode). Use this
   for local database URLs, debug flags, etc.

4. **`instance.conf`** — Instance-specific configuration. Loaded last, used
   for production secrets, deployment-specific URLs, and other environment
   settings. Typically not checked into version control.

### Merge Behavior

Later files **merge** with earlier ones — they do not replace the entire tree.
A key in `instance.conf` overrides only that specific key; everything else
from earlier files remains.

## Framework Flags

The `sirius.frameworks` config section controls which modules are active:

```hocon
sirius.frameworks {
    biz.tenants       = true
    biz.tenants-jdbc  = true
    biz.tenants-mongo = false
    biz.storage       = true
    biz.jobs          = true
    biz.processes     = true
    biz.analytics     = false
}
```

**All flags default to `false`.** A module must be explicitly enabled by the
application or it will not be loaded.

Framework flags affect two things:

1. **Entity loading** — Entities annotated with `@Framework("flag.name")` are
   only registered in the ORM when the flag is `true`.

2. **Service loading** — Services annotated with `@Register(framework = "flag.name")`
   are only instantiated and registered when the flag is `true`.

### Naming Convention

Framework flags follow the pattern `module.feature` or `module.feature-variant`:
- `biz.tenants` — The tenants module
- `biz.tenants-jdbc` — JDBC variant of tenants
- `biz.tenants-mongo` — MongoDB variant of tenants

## @ConfigValue Injection

Configuration values can be injected directly into fields:

```java
@ConfigValue("http.port")
private int port;

@ConfigValue("product.name")
private String productName;

@ConfigValue("feature.enabled")
private boolean enabled;

@ConfigValue("http.sessionTimeout")
private Duration sessionTimeout;

@ConfigValue("allowed.hosts")
private List<String> hosts;
```

The injection happens at startup time and values are immutable after that.

## Accessing Config Programmatically

For dynamic access, use the `Sirius` class:

```java
// Get a config value
String value = Sirius.getSettings().getString("my.config.key");

// Check if a framework is enabled
boolean enabled = Sirius.isFrameworkEnabled("biz.tenants");
```

## Extension Configs

Libraries can provide default configuration by including a
`component-NNN-name.conf` file in their JAR's classpath root. The naming
convention:

- `component-050-kernel.conf` — sirius-kernel defaults
- `component-060-web.conf` — sirius-web defaults
- `component-060-db.conf` — sirius-db defaults
- `component-070-biz.conf` — sirius-biz defaults

The numbering ensures correct load order: kernel before web, web before biz.

## System Properties

Some settings can be overridden via JVM system properties:

- `-Dsirius.debug=true` — Enables development mode (loads `develop.conf`)
- `-Dport=9000` — Override HTTP port
- `-Dsirius.nodeName=node1` — Set the cluster node name

## Best Practices

1. **Never hardcode values** that might vary between environments. Use config.

2. **Put secrets in `instance.conf`** and exclude it from version control.

3. **Use `develop.conf`** for local database URLs and debug settings.

4. **Document config keys** in your `component-*.conf` with comments — these
   serve as the default values and documentation for downstream users.

5. **Check framework flags** before depending on a module's services. If your
   code is optional, guard it with a framework flag on your own `@Register`.
