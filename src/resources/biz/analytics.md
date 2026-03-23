# Analytics

The analytics module provides scheduled metric computation, performance flags,
event recording, and chart visualization. Metrics are computed per entity on
daily or monthly schedules.

## Metric Computers

### DailyMetricComputer

Computes a metric for each entity on a daily basis. Annotated with `@AutoRegister`
for automatic discovery:

```java
@AutoRegister
public abstract class DailyMetricComputer<E extends BaseEntity<?>>
        implements AnalyticalTask<E> {

    @Part @Nullable
    protected Metrics metrics;

    public abstract void compute(MetricComputerContext context, E entity) throws Exception;
}
```

Implementation example:

```java
public class OrderCountComputer extends DailyMetricComputer<SQLTenant> {

    @Override
    public Class<SQLTenant> getType() {
        return SQLTenant.class;
    }

    @Override
    public void compute(MetricComputerContext context, SQLTenant tenant) throws Exception {
        int count = oma.select(SQLOrder.class)
                       .eq(SQLOrder.TENANT, tenant)
                       .where(OMA.FILTERS.gte(SQLOrder.CREATED_AT, context.periodStart()))
                       .where(OMA.FILTERS.lte(SQLOrder.CREATED_AT, context.periodEnd()))
                       .count();
        metrics.updateDailyMetric("orders", tenant, context.date(), count);
    }
}
```

### MonthlyMetricComputer

Same pattern, but invoked monthly. Also runs daily for the current month via
best-effort scheduling to keep preliminary values up to date:

```java
public class MonthlyRevenueComputer extends MonthlyMetricComputer<SQLTenant> {

    @Override
    public void compute(MetricComputerContext context, SQLTenant tenant) throws Exception {
        // context.periodStart() and context.periodEnd() span the full month
        Amount revenue = computeRevenue(tenant, context.periodStart(), context.periodEnd());
        metrics.updateMonthlyMetric("revenue", tenant, context.date(), revenue.getAmount());
    }

    @Override
    public boolean suppressBestEffortScheduling() {
        return false;  // default: allow daily re-computation of current month
    }
}
```

### MonthlyLargeMetricComputer

For expensive computations that should only run once per month (not re-computed
daily via best effort).

## MetricComputerContext

Passed to every `compute()` call with pre-calculated time boundaries:

| Method                          | Description                                  |
|---------------------------------|----------------------------------------------|
| `date()`                        | The reference date for the metric            |
| `periodStart()`                 | Start of the period (LocalDateTime)          |
| `periodEnd()`                   | End of the period (LocalDateTime)            |
| `periodOutsideOfCurrentInterest()` | True if computing a historical period     |
| `bestEffort()`                  | True if this is a best-effort re-computation |

## Scheduling

The analytics scheduler iterates over entities and invokes registered computers.
There are separate schedulers for JDBC and MongoDB entities:

- `SQLAnalyticalTaskScheduler` — schedules tasks for `SQLEntity` types
- `MongoAnalyticalTaskScheduler` — schedules tasks for `MongoEntity` types

Enable the appropriate framework flags:

```hocon
sirius.frameworks {
    biz.analytics-metrics-jdbc = true    # Enable JDBC metric computation
    biz.analytics-metrics-mongo = false  # Enable MongoDB metric computation
    biz.scheduler-jdbc = true            # Enable JDBC scheduler
    biz.scheduler-mongo = false          # Enable MongoDB scheduler
}
```

Schedulers use batch emitters (`SQLEntityBatchEmitter`, `MongoEntityBatchEmitter`)
to process entities in configurable batch sizes via `DistributedTasks`.

## Execution Flags (Performance Flags)

Performance flags track boolean states per entity (e.g., "has overdue invoices",
"needs review"). They are stored as composites on entities:

- **`SQLPerformanceData`** — for JDBC entities
- **`MongoPerformanceData`** — for MongoDB entities

```java
@Framework("biz.tenants-jdbc")
public class SQLTenant extends BizEntity implements Tenant<Long>, PerformanceFlagged {
    private final SQLPerformanceData performanceData = new SQLPerformanceData(this);

    @Override
    public SQLPerformanceData getPerformanceData() {
        return performanceData;
    }
}
```

Enable with:

```hocon
sirius.frameworks {
    biz.analytics-execution-flags-jdbc = true
    biz.analytics-execution-flags-mongo = false
}
```

## AnalyticalTask Interface

Both `DailyMetricComputer` and `MonthlyMetricComputer` implement `AnalyticalTask<E>`.
Override `getLevel()` to control execution order (lower = earlier) when one computer
depends on another's results. Override `isEnabled()` to conditionally disable.

## Common Mistakes

1. **Missing scheduler framework flag** — Registering metric computers without
   enabling `biz.scheduler-jdbc` or `biz.scheduler-mongo` means they never execute.

2. **Wrong entity type** — A `DailyMetricComputer<SQLTenant>` only runs for
   `SQLTenant` entities. If your app uses MongoDB, you need a Mongo variant.

3. **Ignoring `periodOutsideOfCurrentInterest()`** — Use this flag to skip
   expensive external API calls when backfilling historical data.

4. **Not using `bestEffort()` correctly** — Best-effort runs provide preliminary
   values for the current period. Do not perform destructive operations during
   best-effort runs.
