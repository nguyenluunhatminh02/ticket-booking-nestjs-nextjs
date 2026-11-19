---
name: logging-observability
description: Logging best practices, structured logging, monitoring strategies, distributed tracing, metrics collection, observability patterns, log aggregation, alerting, dashboards, and production debugging. Use when implementing logging systems, setting up monitoring, configuring tracing, building observability pipelines, or debugging production issues.
license: MIT
version: 1.0.0
trigger: When implementing logging systems, setting up monitoring, configuring tracing, building observability pipelines, or debugging production issues.
---

# Logging & Observability Skill

Build comprehensive observability with structured logging, distributed tracing, metrics collection, and monitoring dashboards.

## When to Use

- Implementing logging strategies
- Setting up monitoring and alerting
- Configuring distributed tracing
- Building observability dashboards
- Debugging production issues
- Log aggregation and analysis
- Performance monitoring
- Incident response

## The Three Pillars of Observability

**Logs:** Discrete events with context
- What happened
- When it happened
- Where it happened
- Why it matters

**Metrics:** Aggregated measurements over time
- Request rates
- Error rates
- Latency percentiles
- Resource utilization

**Traces:** Request flow across services
- End-to-end request path
- Service dependencies
- Bottleneck identification
- Performance analysis

## Structured Logging

**JSON Format:**
```typescript
logger.info({
  message: 'User authenticated',
  userId: user.id,
  method: 'oauth',
  duration: 245,
  requestId: req.id,
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV
});
```

**Benefits:**
- Machine-parseable
- Searchable and filterable
- Context-rich
- Easy aggregation

**Log Levels:**
- **ERROR:** System failures, requires immediate attention
- **WARN:** Potential issues, monitor closely
- **INFO:** Normal operations, business events
- **DEBUG:** Detailed troubleshooting (disable in prod)
- **TRACE:** Very detailed (development only)

## What to Log

**Always Log:**
- Application startup/shutdown
- Authentication events (login, logout, failures)
- Errors and exceptions
- Security events (unauthorized access, rate limits)
- Critical business operations (payments, data changes)
- Performance metrics (slow queries, timeouts)

**Context to Include:**
- Request ID (for tracing)
- User ID (when applicable)
- Timestamp (ISO 8601)
- Environment (prod/staging/dev)
- Service name (microservices)
- Version (app version)

**Never Log:**
- Passwords, tokens, secrets
- Credit card numbers
- Personal information (PII)
- Session IDs
- API keys

## Distributed Tracing

**OpenTelemetry Setup:**
```typescript
import { trace } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

const provider = new NodeTracerProvider();
provider.register();

const tracer = trace.getTracer('my-service');

async function handleRequest(req, res) {
  const span = tracer.startSpan('handleRequest');
  
  try {
    span.setAttribute('userId', req.userId);
    span.setAttribute('method', req.method);
    
    const result = await processRequest(req);
    span.setStatus({ code: SpanStatusCode.OK });
    
    return result;
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}
```

**Trace Context Propagation:**
- W3C Trace Context headers
- Automatic propagation between services
- Correlate logs with traces
- Link spans across service boundaries

## Metrics Collection

**Key Metrics:**

**Application:**
- Request rate (req/s)
- Error rate (errors/total)
- Latency (p50, p95, p99)
- Active connections
- Queue depth

**Infrastructure:**
- CPU utilization
- Memory usage
- Disk I/O
- Network throughput
- Container/pod count

**Business:**
- User signups
- Transactions processed
- Revenue
- Feature usage

**Prometheus Example:**
```typescript
import { Counter, Histogram, Registry } from 'prom-client';

const registry = new Registry();

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

registry.registerMetric(httpRequestDuration);
registry.registerMetric(httpRequestsTotal);

// Middleware
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  
  res.on('finish', () => {
    end({ method: req.method, route: req.route, status_code: res.statusCode });
    httpRequestsTotal.inc({ method: req.method, route: req.route, status_code: res.statusCode });
  });
  
  next();
});
```

## Log Aggregation

**Stack Options:**

**ELK Stack:**
- Elasticsearch: Search and analytics
- Logstash: Log processing
- Kibana: Visualization

**Loki Stack:**
- Loki: Log aggregation (lightweight)
- Promtail: Log shipping
- Grafana: Visualization

**Cloud Solutions:**
- Datadog
- New Relic
- CloudWatch (AWS)
- Stackdriver (GCP)
- Azure Monitor

**Log Shipping:**
```yaml
# Fluentd configuration
<source>
  @type tail
  path /var/log/app/*.log
  pos_file /var/log/fluentd/app.log.pos
  tag app.*
  <parse>
    @type json
  </parse>
</source>

<match app.**>
  @type elasticsearch
  host elasticsearch
  port 9200
  logstash_format true
</match>
```

## Alerting Strategy

**Alert on Symptoms, Not Causes:**
- High error rate (symptom) vs. database down (cause)
- Slow response time (symptom) vs. missing index (cause)

**Alert Severity:**
- **Critical:** Immediate action required (pager duty)
- **Warning:** Investigate within hours
- **Info:** Review during business hours

**Example Alerts:**
```yaml
# Prometheus alerting rules
groups:
  - name: application
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/second"
      
      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"
          description: "95th percentile latency is {{ $value }}s"
```

**Avoid Alert Fatigue:**
- Only alert on actionable issues
- Set appropriate thresholds
- Use alert grouping
- Regularly review and tune alerts

## Dashboards

**Key Dashboard Panels:**

**Overview:**
- Request rate
- Error rate
- Latency percentiles
- Uptime

**Infrastructure:**
- CPU, memory, disk
- Network I/O
- Container health

**Application:**
- Top endpoints by latency
- Error breakdown by type
- Database query performance
- Cache hit rates

**Grafana Example:**
```json
{
  "dashboard": {
    "title": "Application Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
          }
        ]
      }
    ]
  }
}
```

## Production Debugging

**Systematic Approach:**
1. Check monitoring dashboards
2. Identify affected time range
3. Search logs for errors
4. Trace affected requests
5. Check recent deployments
6. Review infrastructure metrics
7. Identify root cause
8. Implement fix
9. Verify resolution

**Useful Commands:**
```bash
# Search logs
kubectl logs -f deployment/app --since=1h | grep ERROR

# Check pod status
kubectl get pods -l app=myapp

# View metrics
curl http://localhost:9090/api/v1/query?query=up

# Trace request
kubectl logs -f deployment/app | grep "requestId=abc123"
```

## Best Practices

**Logging:**
- Use structured logging (JSON)
- Include correlation IDs
- Log at appropriate levels
- Rotate logs regularly
- Ship logs to central system

**Metrics:**
- Track SLIs/SLOs
- Use appropriate buckets for histograms
- Label metrics consistently
- Set up alerting on symptoms
- Review dashboards regularly

**Tracing:**
- Propagate trace context
- Sample appropriately (100% in dev, 1% in prod)
- Include business context in spans
- Set reasonable timeouts
- Monitor trace storage costs

## Resources

- OpenTelemetry: https://opentelemetry.io/
- Prometheus: https://prometheus.io/
- Grafana: https://grafana.com/
- ELK Stack: https://www.elastic.co/elastic-stack
- Loki: https://grafana.com/oss/loki/
- Twelve-Factor App (Logs): https://12factor.net/logs
