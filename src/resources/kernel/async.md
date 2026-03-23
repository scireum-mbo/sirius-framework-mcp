# Async and Concurrency

Sirius-kernel provides its own concurrency primitives built around managed thread
pools, context propagation, and a promise/future model.

## Tasks Service

`Tasks` is the central service for running background work. It manages named
executor pools and ensures proper context propagation.

```java
@Part
private Tasks tasks;

// Run in the default executor
tasks.defaultExecutor().start(() -> {
    // Background work — CallContext is automatically transferred
});

// Run in a named executor
tasks.executor("my-pool").start(() -> {
    // Runs in a pool configured under "async.executor.my-pool"
});
```

### Executor Configuration

Executors are configured in HOCON:

```hocon
async.executor.my-pool {
    poolSize = 4
    maxSize = 16
    queueLength = 100
}
```

- `poolSize` — Core thread count.
- `maxSize` — Maximum thread count under load.
- `queueLength` — Work queue capacity. Tasks beyond this are rejected.

### Periodic Tasks

For recurring work, use `EveryMinute`, `EveryTenMinutes`, `EveryHour`, or
`EveryDay` by implementing the interface and registering:

```java
@Register(classes = {CleanupTask.class, EveryHour.class})
public class CleanupTask implements EveryHour {

    @Override
    public void runTimer() throws Exception {
        // Called every hour
    }
}
```

## CallContext

`CallContext` is thread-local context that automatically transfers to child
threads managed by `Tasks`. It carries:

- The current **language** (for NLS translations).
- The current **user** and **tenant** (MDC-style context).
- A **TaskContext** for monitoring progress and cancellation.
- **Log output** and flow tracking.

```java
// Access current context
CallContext ctx = CallContext.getCurrent();

// Get a sub-context component
UserInfo currentUser = ctx.get(UserInfo.class);
```

When `Tasks` dispatches work to a thread pool, it captures the caller's
`CallContext` and installs it in the worker thread. This means background
tasks automatically inherit the user, language, and logging context.

### TaskContext

Within a `CallContext`, the `TaskContext` tracks the current operation and
supports cooperative cancellation:

```java
TaskContext taskCtx = TaskContext.get();

// Check if the current task should stop
if (!taskCtx.isActive()) {
    return;
}

// Report progress
taskCtx.setState("Processing item %d of %d", current, total);
```

Long-running operations should periodically check `isActive()` to support
graceful cancellation.

## Promise and Future

Sirius provides its own `Promise<T>` as a lightweight alternative to
`CompletableFuture`:

```java
// Create a promise
Promise<String> promise = new Promise<>();

// Register handlers
promise.onSuccess(value -> {
    // Called when the promise is fulfilled
});
promise.onFailure(error -> {
    // Called when the promise fails
});

// Fulfill or fail
promise.success("result");
// or
promise.fail(new IOException("failed"));
```

### Blocking Wait

```java
String result = promise.await(Duration.ofSeconds(30));
```

`await()` blocks until the promise completes or the timeout expires.

### Chaining

```java
Promise<Integer> length = promise.map(String::length);
```

## DelayLine

`DelayLine` provides delayed execution — tasks are submitted and executed after
a configured delay:

```java
@Part
private DelayLine delayLine;

delayLine.callDelayed("my-token", Duration.ofMinutes(5), () -> {
    // Executed 5 minutes from now
});
```

The token parameter is used for deduplication — submitting a new task with the
same token cancels the previous one. This is useful for debouncing (e.g., only
send a notification if no further events arrive within 5 minutes).

## Orchestration

`Orchestration` coordinates distributed background work across cluster nodes.
It ensures that periodic tasks run on only one node in a cluster:

```java
@Register(classes = {MyDistributedTask.class, EveryHour.class})
public class MyDistributedTask implements EveryHour {

    @Part
    private Orchestration orchestration;

    @Override
    public void runTimer() throws Exception {
        orchestration.runInCluster("my-task", () -> {
            // Only executes on one node
        });
    }
}
```

## Best Practices

1. **Always use `Tasks`** for background work — never create raw threads.
   `Tasks` ensures context propagation and proper executor management.

2. **Check `isActive()`** in long-running loops to support cancellation.

3. **Use DelayLine** for debounce patterns instead of `Thread.sleep`.

4. **Configure executor pools** explicitly. The default pool is shared and
   should not be saturated with long-running tasks.

5. **Name your executors** descriptively. Executor names appear in thread dumps
   and monitoring, making debugging much easier.
