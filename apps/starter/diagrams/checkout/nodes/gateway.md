The only public entry point into the cluster.

- Verifies the JWT against Keycloak's signing keys, cached for ten minutes
- Rate limits per user: **60 requests per minute**
- Adds the `X-User-Id` header that the services trust
