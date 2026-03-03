# Observability and Logs — Guide

Last updated: 2025-09-04

## Purpose
Explain observability in Nexa, with safe logging.

## Who should read this
Ops, SRE, and developers.

## Correlation IDs
- Each request includes a correlation ID in headers and logs.

## Masked logs
- Secrets and personal IDs must be masked: `***redacted***`, `xxx`.

## Metrics to watch
- Request rate, error rate
- p95 latency
- Job queue depth

## Minimum dashboard panels
- API latency (p50/p95/p99)
- Error rate by route
- Background job success/failure
- Connector health



