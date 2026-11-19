---
name: caching-strategies
description: Caching patterns, cache invalidation strategies, Redis implementation, CDN caching, browser caching, distributed caching, cache warming, cache stampede prevention, and performance optimization. Use when implementing caching layers, optimizing application performance, reducing database load, setting up Redis, configuring CDNs, or designing cache invalidation strategies.
license: MIT
version: 1.0.0
trigger: When implementing caching layers, optimizing application performance, reducing database load, setting up Redis, configuring CDNs, or designing cache invalidation strategies.
---

# Caching Strategies Skill

Optimize application performance with effective caching patterns, distributed caching, and intelligent invalidation strategies.

## When to Use

- Implementing caching layers
- Reducing database load
- Improving response times
- Setting up Redis or Memcached
- Configuring CDN caching
- Designing cache invalidation
- Preventing cache stampedes
- Optimizing API performance

## Cache Types

**Application Cache:**
- In-memory (Redis, Memcached)
- Local cache (Node.js cache, Guava)
- ORM query cache
- Session storage

**Browser Cache:**
- HTTP cache headers
- Service workers
- LocalStorage/SessionStorage
- IndexedDB

**CDN Cache:**
- Edge locations
- Static assets
- API responses
- Dynamic content

**Database Cache:**
- Query result cache
- Prepared statement cache
- Buffer pool
- Materialized views

## Redis Implementation

**Basic Setup:**
```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

// Set with expiration
await redis.set('user:123', JSON.stringify(user), 'EX', 3600);

// Get
const cached = await redis.get('user:123');
if (cached) {
  return JSON.parse(cached);
}
```

**Cache-Aside Pattern:**
```typescript
async function getUser(userId: string) {
  const cacheKey = `user:${userId}`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Cache miss - fetch from database
  const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  
  // Store in cache with TTL
  await redis.set(cacheKey, JSON.stringify(user), 'EX', 3600);
  
  return user;
}
```

**Write-Through Cache:**
```typescript
async function updateUser(userId: string, data: UserData) {
  // Update database
  await db.query('UPDATE users SET ... WHERE id = $1', [userId, ...data]);
  
  // Update cache immediately
  const cacheKey = `user:${userId}`;
  await redis.set(cacheKey, JSON.stringify(data), 'EX', 3600);
}
```

**Write-Behind Cache:**
```typescript
async function updateUserAsync(userId: string, data: UserData) {
  // Update cache immediately
  const cacheKey = `user:${userId}`;
  await redis.set(cacheKey, JSON.stringify(data), 'EX', 3600);
  
  // Queue database write
  await queue.add('user-update', { userId, data });
}
```

## Cache Invalidation Strategies

**Time-Based (TTL):**
```typescript
// Simple expiration
await redis.set('key', value, 'EX', 3600); // 1 hour

// Sliding expiration
await redis.set('key', value, 'EX', 3600);
// On access, refresh TTL
await redis.expire('key', 3600);
```

**Event-Based:**
```typescript
// Invalidate on data change
async function updateUser(userId: string, data: UserData) {
  await db.updateUser(userId, data);
  
  // Invalidate cache
  await redis.del(`user:${userId}`);
  await redis.del(`users:list`);
}
```

**Tag-Based:**
```typescript
// Tag related cache entries
await redis.set('user:123', userData, 'EX', 3600);
await redis.sadd('user:123:tags', 'user', 'profile', 'auth');

// Invalidate by tag
async function invalidateTag(tag: string) {
  const keys = await redis.smembers(`${tag}:keys`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
```

**Version-Based:**
```typescript
const CACHE_VERSION = 'v1';
const cacheKey = `user:${userId}:${CACHE_VERSION}`;

// Bump version to invalidate all
const NEW_VERSION = 'v2';
```

## Cache Stampede Prevention

**Problem:** Multiple requests try to populate the same expired cache key simultaneously.

**Solution 1: Locking**
```typescript
async function getUserWithLock(userId: string) {
  const cacheKey = `user:${userId}`;
  const lockKey = `lock:${cacheKey}`;
  
  // Try cache
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Try to acquire lock
  const locked = await redis.set(lockKey, '1', 'EX', 10, 'NX');
  
  if (locked) {
    try {
      // Double-check cache (another request might have populated it)
      const recheck = await redis.get(cacheKey);
      if (recheck) return JSON.parse(recheck);
      
      // Fetch from database
      const user = await db.getUser(userId);
      await redis.set(cacheKey, JSON.stringify(user), 'EX', 3600);
      return user;
    } finally {
      await redis.del(lockKey);
    }
  } else {
    // Wait and retry
    await sleep(100);
    return getUserWithLock(userId);
  }
}
```

**Solution 2: Probabilistic Early Expiration**
```typescript
async function getUserProbabilistic(userId: string) {
  const cacheKey = `user:${userId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    const data = JSON.parse(cached);
    const ttl = await redis.ttl(cacheKey);
    
    // Refresh if TTL is low (20% chance when TTL < 20% of original)
    if (ttl < 720 && Math.random() < 0.2) {
      // Refresh in background
      refreshUserCache(userId);
    }
    
    return data;
  }
  
  // Cache miss
  return refreshUserCache(userId);
}
```

**Solution 3: Stale-While-Revalidate**
```typescript
async function getUserSWR(userId: string) {
  const cacheKey = `user:${userId}`;
  const staleKey = `stale:${cacheKey}`;
  
  // Check fresh cache
  const fresh = await redis.get(cacheKey);
  if (fresh) return JSON.parse(fresh);
  
  // Check stale cache
  const stale = await redis.get(staleKey);
  if (stale) {
    // Return stale, refresh in background
    refreshUserCache(userId);
    return JSON.parse(stale);
  }
  
  // No cache at all
  return refreshUserCache(userId);
}
```

## CDN Caching

**Cache Headers:**
```typescript
// Static assets (immutable)
res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

// API responses (short cache)
res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');

// Private user data
res.setHeader('Cache-Control', 'private, no-cache');

// Conditional requests
res.setHeader('ETag', '"abc123"');
res.setHeader('Last-Modified', 'Wed, 21 Oct 2025 07:28:00 GMT');
```

**CDN Configuration:**
```yaml
# Cloudflare example
rules:
  - match: "/*.js"
    cache: true
    edge_ttl: 31536000
    browser_ttl: 31536000
  
  - match: "/api/*"
    cache: true
    edge_ttl: 60
    bypass_cookie: "session"
  
  - match: "/admin/*"
    cache: false
```

**Cache Purging:**
```typescript
// Purge specific URL
await cloudflare.purgeCache({
  files: ['https://example.com/api/users/123']
});

// Purge by tag
await cloudflare.purgeCache({
  tags: ['user-123', 'product-list']
});

// Purge everything
await cloudflare.purgeCache({
  purge_everything: true
});
```

## Cache Warming

**Pre-warm on Startup:**
```typescript
async function warmCache() {
  const popularUsers = await db.query(
    'SELECT id FROM users ORDER BY last_active DESC LIMIT 1000'
  );
  
  await Promise.all(
    popularUsers.map(user => getUser(user.id))
  );
}

// Run on application start
app.on('ready', warmCache);
```

**Scheduled Warming:**
```typescript
// Refresh popular items every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  const popularProducts = await getPopularProducts();
  await Promise.all(
    popularProducts.map(p => cacheProduct(p.id))
  );
});
```

## Multi-Level Caching

```typescript
class MultiLevelCache {
  private l1 = new Map(); // In-memory (L1)
  private l2 = redis;     // Redis (L2)
  
  async get(key: string) {
    // L1 check
    if (this.l1.has(key)) {
      return this.l1.get(key);
    }
    
    // L2 check
    const l2Value = await this.l2.get(key);
    if (l2Value) {
      const parsed = JSON.parse(l2Value);
      this.l1.set(key, parsed); // Promote to L1
      return parsed;
    }
    
    // Cache miss
    return null;
  }
  
  async set(key: string, value: any, ttl = 3600) {
    this.l1.set(key, value);
    await this.l2.set(key, JSON.stringify(value), 'EX', ttl);
  }
}
```

## Cache Metrics

**Track:**
- Hit rate (hits / total requests)
- Miss rate
- Eviction rate
- Memory usage
- Latency (cache vs database)

**Example:**
```typescript
class CacheMetrics {
  private hits = 0;
  private misses = 0;
  
  recordHit() { this.hits++; }
  recordMiss() { this.misses++; }
  
  getHitRate() {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }
}

// Expose as metrics
app.get('/metrics', (req, res) => {
  res.json({
    cache_hit_rate: cacheMetrics.getHitRate(),
    cache_hits: cacheMetrics.hits,
    cache_misses: cacheMetrics.misses
  });
});
```

## Best Practices

**Do:**
- Set appropriate TTLs based on data volatility
- Use cache versioning for schema changes
- Monitor cache hit rates (aim for 80%+)
- Implement cache stampede prevention
- Use compression for large values
- Test cache invalidation thoroughly
- Size cache appropriately (monitor memory)

**Don't:**
- Cache sensitive data without encryption
- Cache indefinitely without invalidation
- Ignore cache consistency issues
- Over-cache (stale data problems)
- Forget to handle cache failures
- Cache large objects without compression

## Resources

- Redis: https://redis.io/
- Memcached: https://memcached.org/
- CDN Caching: https://www.cloudflare.com/learning/cdn/what-is-a-cdn/
- Cache Invalidation: https://martinfowler.com/bliki/CacheInvalidation.html
- AWS ElastiCache: https://aws.amazon.com/elasticache/
