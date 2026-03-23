# Lifecycle Interfaces

Sirius-kernel defines three lifecycle interfaces that components can implement to
hook into the application startup and shutdown process. All three extend `Priorized`,
which controls execution order.

## Startable

`Startable` is called once after dependency injection is complete. This is the
primary hook for initialization logic that depends on injected `@Part` fields.

```java
@Register(classes = {MyService.class, Startable.class})
public class MyServiceImpl implements MyService, Startable {

    @Part
    private OMA oma;

    @Override
    public int getPriority() {
        return PriorityCollector.DEFAULT_PRIORITY;
    }

    @Override
    public void started() {
        // All @Part fields are populated at this point.
        // Initialize caches, start background work, etc.
    }
}
```

**Key points:**
- `started()` is called exactly once, during framework boot.
- All `@Part` fields are guaranteed to be injected before `started()` runs.
- Components are started in priority order (lower `getPriority()` values first).
- The `started()` method should not block indefinitely — long-running work should
  be dispatched to an executor via the `Tasks` service.

## Stoppable

`Stoppable` is called during graceful shutdown. It **must not block** for extended
periods — it should signal threads to stop, release non-critical resources, and
return quickly.

```java
@Register(classes = {CacheManager.class, Startable.class, Stoppable.class})
public class CacheManager implements Startable, Stoppable {

    @Override
    public void started() {
        // Initialize caches
    }

    @Override
    public void stopped() {
        // Signal cache eviction threads to stop.
        // Must return quickly — do NOT block here.
    }
}
```

**Key points:**
- `stopped()` is called in reverse priority order (highest priority stopped first).
- Must not block. If you need to wait for cleanup, implement `Killable` instead.
- Called before `Killable.killed()`, so resources may still be partially available.

## Killable

`Killable` is the final shutdown hook. Unlike `Stoppable`, it **may block** to
perform thorough cleanup — closing database connections, flushing buffers,
writing final state.

```java
@Register(classes = {ConnectionPool.class, Startable.class, Killable.class})
public class ConnectionPool implements Startable, Killable {

    @Override
    public void started() {
        // Open connection pool
    }

    @Override
    public void killed() {
        // Close all connections, wait for pending queries.
        // Blocking is acceptable here.
    }
}
```

**Key points:**
- `killed()` is called after all `Stoppable` instances have been stopped.
- May block for cleanup — this is the last chance before the JVM exits.
- Called in reverse priority order.

## Priorized

All lifecycle interfaces extend `Priorized`:

```java
public interface Priorized {
    int getPriority();
}
```

Priority values control execution order:
- **Startup**: lower values start first (priority 10 starts before priority 100).
- **Shutdown**: higher values stop/kill first (reverse order).

Common priority constants from `PriorityCollector`:
- `DEFAULT_PRIORITY` (100) — Use unless you have a specific ordering need.

## Registration Pattern

The most important pattern: always list lifecycle interfaces in `@Register(classes = ...)`:

```java
// CORRECT
@Register(classes = {MyService.class, Startable.class, Stoppable.class})
public class MyServiceImpl implements MyService, Startable, Stoppable { ... }

// WRONG — lifecycle methods will never be called!
@Register
public class MyServiceImpl implements MyService, Startable, Stoppable { ... }
```

This is a common mistake. The framework discovers lifecycle participants by
looking up registered classes — if `Startable.class` is not in the `classes`
list, the framework does not know the component is startable.

## Initialization Order Summary

1. All `@Register` components are instantiated.
2. All `@Part` fields are injected.
3. `Startable.started()` is called in priority order (ascending).
4. Application runs.
5. Shutdown signal received.
6. `Stoppable.stopped()` is called in reverse priority order (non-blocking).
7. `Killable.killed()` is called in reverse priority order (may block).
8. JVM exits.

## Initializable

A less common alternative: `Initializable` provides an `initialize()` method
that is called even earlier than `started()`, during the injection phase itself.
Use this only when your component must be ready before other `@Part` injections
complete. In most cases, prefer `Startable`.
