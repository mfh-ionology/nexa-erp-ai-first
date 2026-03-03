# Connector Enable Flags

Values treated as enabled: "1", "true" (case-insensitive), or "on". If unset, defaults to enabled.

Environment variables:

- CONNECTOR_SHOPIFY_ENABLED
- CONNECTOR_AMAZON_ENABLED
- CONNECTOR_EBAY_ENABLED
- CONNECTOR_HMRC_RTI_ENABLED
- CONNECTOR_OPEN_BANKING_ENABLED
- CONNECTOR_EDI_ENABLED

Health endpoint reads flags:

- GET /api/integrations/health
