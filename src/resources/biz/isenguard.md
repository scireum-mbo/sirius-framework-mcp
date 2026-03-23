# Isenguard

Isenguard is the built-in rate limiting and firewall facility. It tracks request
counts per scope (IP, user, tenant) and realm, blocking requests that exceed
configured limits. It is typically backed by Redis for distributed rate limiting.

## Enabling Isenguard

Isenguard is gated behind a framework flag:

```hocon
sirius.frameworks {
    biz.isenguard = true
}
```

The `Isenguard` service is registered unconditionally but only enforces limits
when the framework is enabled and a `Limiter` backend is available.

## Limiter Backends

The limiter strategy is configured via:

```hocon
isenguard {
    limiter = "smart"   # default — uses Redis if available, else NOOP
}
```

Available strategies:
- **`smart`** (default) — uses `RedisLimiter` if Redis is available, otherwise
  falls back to `NOOPLimiter` (no rate limiting).
- **`redis`** — always use Redis. Fails if Redis is unavailable.
- **`noop`** — disables rate limiting entirely.

## Rate Limit Scopes

Each rate limit check requires a **scope** (who is being limited) and a **realm**
(what operation is being limited):

| Scope Type   | Constant                        | Example Value    |
|--------------|---------------------------------|------------------|
| Per IP       | `Isenguard.REALM_TYPE_IP`       | `"192.168.1.1"`  |
| Per Tenant   | `Isenguard.REALM_TYPE_TENANT`   | `"tenant-42"`    |
| Per User     | `Isenguard.REALM_TYPE_USER`     | `"user-123"`     |

The scope is a free-form string — you decide what to use as the key.

## Checking Rate Limits

### Programmatic API

```java
@Part
private Isenguard isenguard;

// Register a call and check if the limit is reached
boolean blocked = isenguard.registerCallAndCheckRateLimitReached(
        clientIp,                              // scope
        "api-calls",                           // realm
        Isenguard.USE_LIMIT_FROM_CONFIG,       // use configured limit
        () -> new RateLimitingInfo(tenantId, tenantName, userId)  // info for audit
);

if (blocked) {
    throw Exceptions.createHandled()
                    .withNLSKey("Isenguard.rateLimitReached")
                    .handle();
}
```

An overload accepts a `Runnable` callback that fires once when the limit is first
reached (useful for audit logging).

### Check Without Counting

```java
// Does not count as a call — only checks the current state
boolean alreadyBlocked = isenguard.checkRateLimitReached(clientIp, "api-calls");
```

## Configuring Limits

Limits are defined per realm in HOCON:

```hocon
isenguard {
    limit {
        api-calls {
            limit = 100          # max calls per interval
            intervalSeconds = 60 # check interval in seconds
        }
        login-attempts {
            limit = 5
            intervalSeconds = 300
        }
    }
}
```

You can also pass an explicit limit programmatically by providing a non-zero value
instead of `Isenguard.USE_LIMIT_FROM_CONFIG`.

## RateLimitedEntity

The `RateLimitedEntity` interface is a marker for entities that have rate limits
applied to them. Implementing it enables the `RateLimitEventsReportJobFactory`
to offer itself as a matching job for the entity:

```java
public interface RateLimitedEntity {
    String getRateLimitScope();
}
```

`Tenant` implements `RateLimitedEntity`, so tenants automatically get rate limit
reporting. Any custom entity can implement this interface:

```java
public class APIClient extends BizEntity implements RateLimitedEntity {
    @Override
    public String getRateLimitScope() {
        return "api-client-" + getIdAsString();
    }
}
```

## IP Blocking

Isenguard also functions as a firewall. IPs can be blocked permanently or
temporarily:

```java
isenguard.blockIP("192.168.1.100");
```

Blocked IPs receive HTTP 429 (Too Many Requests) responses. The
`BlockedIPsReportJobFactory` provides a UI for viewing and managing blocked IPs.

## Common Mistakes

1. **Forgetting `USE_LIMIT_FROM_CONFIG`** — Passing `0` as the explicit limit
   constant means "use config." Passing a non-zero value overrides the config.
   Accidentally passing `0` when you mean "no limit" does the wrong thing.

2. **Wrong scope granularity** — Rate limiting by IP is too coarse for shared
   networks (NAT). Rate limiting by user is too fine if you want to limit a
   tenant's total API usage. Choose the right scope for your use case.

3. **Not providing `RateLimitingInfo`** — The info supplier is called when the
   limit is first reached to create an audit log entry. Returning null values
   makes it hard to diagnose issues.

4. **Missing Redis** — With the `smart` limiter (default), rate limiting silently
   degrades to no-op when Redis is unavailable. In production, ensure Redis is
   running or use the `redis` limiter to fail fast.
