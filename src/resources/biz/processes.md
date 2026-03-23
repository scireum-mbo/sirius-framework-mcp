# Processes

The process framework provides a way to track, log, and monitor long-running
background operations. Processes are stored in Elasticsearch and provide a
real-time UI for viewing progress, logs, and outputs.

## The Processes Service

`Processes` is the central service, registered with framework flag `biz.processes`:

```java
@Register(classes = Processes.class, framework = Processes.FRAMEWORK_PROCESSES)
public class Processes { ... }
```

Enable it in your configuration:

```hocon
sirius.frameworks {
    biz.processes = true
}
```

## Two Types of Processes

### Normal Processes

Created for a finite task, run to completion, then terminate:

```java
@Part
private Processes processes;

public void runExport() {
    String processId = processes.createProcess(
            "export",                      // type (for filtering)
            "Export Products",             // title shown in UI
            "fa-solid fa-download",        // icon
            UserContext.getCurrentUser(),   // owning user
            PersistencePeriod.THREE_MONTHS, // how long to keep
            Map.of("format", "csv")        // context data
    );

    processes.execute(processId, process -> {
        // process is a ProcessContext
        process.log(ProcessLog.info().withMessage("Starting export..."));
        // do work
        process.addTiming("products", watchElapsed);
        process.forceUpdateState("Exported 500 products");
    });
}
```

- `execute(processId, consumer)` — runs the consumer and marks the process as
  completed (or errored) when done.
- `partiallyExecute(processId, consumer)` — runs the consumer but leaves the
  process open for further work (even from other nodes).

### Standby Processes

Long-lived processes for recurring background activity (e.g., a webhook receiver
that logs errors):

```java
processes.executeInStandbyProcess(
        "webhook-receiver",                         // type
        () -> "Webhook Receiver",                   // title supplier
        "fa-solid fa-satellite-dish",               // icon
        () -> "Processing incoming webhooks...",     // state supplier
        process -> {
            // This runs each time the standby process is invoked
            process.log(ProcessLog.warn().withMessage("Received invalid payload"));
        }
);
```

Standby processes are created on demand and reused. The system periodically cleans
up old log entries to prevent unbounded growth.

## ProcessContext — The Client API

Inside `execute()` or `partiallyExecute()`, you interact with a `ProcessContext`:

| Method                            | Description                                  |
|-----------------------------------|----------------------------------------------|
| `log(ProcessLog)`                 | Writes a log entry (info, warn, error)       |
| `addTiming(counter, millis)`      | Increments a named performance counter       |
| `addDebugTiming(counter, millis)` | Counter visible only when debugging enabled  |
| `incCounter(counter)`             | Increment a counter by one                   |
| `forceUpdateState(text)`          | Updates the process state text immediately   |
| `updateTitle(text)`               | Changes the process title                    |
| `addOutput(ProcessOutput)`        | Adds a structured output (table, chart)      |
| `getProcessId()`                  | Returns the process ID                       |
| `isActive()`                      | Returns false if the process was cancelled    |

### Structured Outputs

Processes can produce tables and charts, not just log lines:

```java
TableOutput table = process.addTable("results", "Results", columns);
table.addRow("product-1", "Widget", "42");

ChartOutput chart = process.addChart("timeline", "Timeline");
```

## Process Entity

`Process` is an Elasticsearch entity gated by `@Framework(Processes.FRAMEWORK_PROCESSES)`.
It stores:
- Process metadata (type, title, icon, user, tenant)
- State (RUNNING, STANDBY, TERMINATED, CANCELED, ERRORED)
- Counters and timings
- Context map (arbitrary key-value pairs)
- Persistence period (how long to retain)

`ProcessLog` is a separate Elasticsearch entity for individual log entries,
also gated by `@Framework(Processes.FRAMEWORK_PROCESSES)`.

## Layered Cache Architecture

Because Elasticsearch has a ~1-second write-visibility delay, `Processes` uses a
two-level cache:

1. **First-level cache** — very short-lived, for direct modifications on the same node.
2. **Second-level cache** — coherent cache for reading "static" process data
   (context, user, title) across nodes.

Standby processes have their own coherent cache since they are long-lived and few
in number.

## PersistencePeriod

Controls how long a completed process is retained before automatic cleanup:

- `PersistencePeriod.ONE_DAY`
- `PersistencePeriod.TWO_WEEKS`
- `PersistencePeriod.THREE_MONTHS`
- `PersistencePeriod.SIX_MONTHS`
- `PersistencePeriod.ONE_YEAR`
- `PersistencePeriod.FOREVER`

## Common Mistakes

1. **Using `execute()` when `partiallyExecute()` is needed** — If multiple nodes
   or tasks contribute to one process, `execute()` will prematurely mark it as done.

2. **Logging too much** — Every `ProcessLog` is an Elasticsearch document.
   Use `addTiming()` for high-frequency counters instead of logging each item.

3. **Ignoring `isActive()`** — Always check `process.isActive()` in long loops.
   If the user cancels, you should stop promptly.

4. **Forgetting the framework flag** — Without `biz.processes = true` in the
   config, the `Processes` service will not load and `@Part Processes` will be null.
