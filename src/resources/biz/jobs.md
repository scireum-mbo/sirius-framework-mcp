# Jobs Framework

The jobs framework provides a system for defining, parameterizing, and executing
background tasks. Jobs are stateless factories (`JobFactory`) that produce work
which runs either interactively (in the browser) or as batch processes on
distributed worker nodes.

## JobFactory Interface

`JobFactory` is the top-level interface, annotated with `@AutoRegister` so that
implementations are automatically discovered. In practice, always subclass
`BasicJobFactory` which handles parameter collection, validation, and execution
setup.

```java
@AutoRegister
public interface JobFactory extends Named, Priorized {
    String getLabel();
    String getIcon();
    String getDescription();
    List<Parameter<?, ?>> getParameters();
    // ...
}
```

## Class Hierarchy — Choose the Right Base Class

The hierarchy branches into two paths: interactive and batch.

**Interactive jobs** run synchronously while the user waits:

- `BasicJobFactory`
  - `InteractiveJobFactory` — base for all interactive jobs
    - `ReportJobFactory` — produces tabular HTML reports
    - `DoughnutChartJobFactory` — renders a doughnut chart
    - `LinearChartJobFactory` — renders a line chart
    - `TimeseriesChartJobFactory` — renders a time-series chart
    - `PolarAreaChartJobFactory` — renders a polar area chart

**Batch jobs** run asynchronously in a distributed process:

- `BasicJobFactory`
  - `BatchProcessJobFactory` — creates a `Process` and dispatches work via `DistributedTasks`
    - `SimpleBatchProcessJobFactory` — single `execute(ProcessContext)` method
    - `ImportBatchProcessFactory` — file-based import workflows
    - `ExportBatchProcessFactory` — file-based export workflows
    - `CheckBatchProcessFactory` — data validation/checking workflows
    - `ReportBatchProcessFactory` — long-running report generation

**Key rule:** Pick the most specific base class. If your job imports data from a
file, extend `ImportBatchProcessFactory`, not `SimpleBatchProcessJobFactory`.

## Defining Parameters

Override `collectParameters()` to declare the job's inputs:

```java
@Override
protected void collectParameters(Consumer<Parameter<?, ?>> parameterCollector) {
    parameterCollector.accept(DATE_RANGE_PARAMETER);
    parameterCollector.accept(ACTIVE_ONLY_PARAMETER);
}
```

Common parameter types (all in `sirius.biz.jobs.params`):

| Type                   | Description                                |
|------------------------|--------------------------------------------|
| `StringParameter`      | Free-text input                            |
| `BooleanParameter`     | Checkbox toggle                            |
| `EnumParameter`        | Dropdown from a Java enum                  |
| `EntityParameter`      | Autocomplete for a database entity         |
| `LocalDateParameter`   | Date picker                                |
| `DateRangeParameter`   | Date range selector                        |
| `CodeListParameter`    | Selection from a code list                 |
| `FileParameter`        | File upload (references Layer 2 blobs)     |
| `IntParameter`         | Integer input                              |
| `SelectStringParameter`| Dropdown from a fixed list of strings      |

Parameters are built using a fluent API:

```java
private static final Parameter<String, StringParameter> NAME_PARAM =
        new StringParameter("name", "$MyJob.name")
                .withDescription("$MyJob.name.help")
                .markRequired()
                .build();
```

## SimpleBatchProcessJobFactory

The simplest way to create a batch job. Override `execute(ProcessContext)`:

```java
@Register
public class MyCleanupJob extends SimpleBatchProcessJobFactory {

    @Override
    protected String getLabel() { return "Cleanup old records"; }

    @Override
    protected void collectParameters(Consumer<Parameter<?, ?>> parameterCollector) {
        parameterCollector.accept(MAX_AGE_PARAMETER);
    }

    @Override
    protected void execute(ProcessContext process) throws Exception {
        int maxAge = process.getParameter(MAX_AGE_PARAMETER).orElse(30);
        // do work, use process.log() to report progress
    }

    @Override
    public String getCategory() {
        return StandardCategories.SYSTEM_ADMINISTRATION;
    }
}
```

**Important:** Override `execute(ProcessContext)`, not `executeInBackground()`.
The process context is already set up for you.

## Categories

Group jobs in the UI using `StandardCategories`:

- `StandardCategories.MISC` — miscellaneous
- `StandardCategories.SYSTEM_ADMINISTRATION` — system admin tasks
- `StandardCategories.MONITORING` — monitoring jobs
- `StandardCategories.USERS_AND_TENANTS` — user/tenant management

Or define your own category string constant (prefix with `$` for NLS lookup).

## Common Mistakes

1. **Storing state in the factory** — `JobFactory` is a singleton. Never store
   per-execution state in fields. Use `ProcessContext` or a `BatchJob` subclass.

2. **Wrong base class** — Using `SimpleBatchProcessJobFactory` for an import that
   should extend `ImportBatchProcessFactory` loses file handling, progress tracking,
   and error reporting that the more specific class provides.

3. **Missing `getCategory()`** — Jobs without a category are hard to find in the UI.

4. **Forgetting required permissions** — Override `getRequiredPermissions()` to
   restrict who can run the job. Without it, any logged-in user can trigger it.
