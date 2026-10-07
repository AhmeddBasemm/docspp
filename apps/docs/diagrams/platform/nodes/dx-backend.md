Runs on the device and never faces the management stack directly. It dials **in** to the gateway VM's agent, and the agent relays jobs over that connection.

Each service contributes five pieces, all keyed by the same type string:

1. a UI remote
2. a proxy route
3. an authorization resource
4. a licence rule
5. a metric definition (planned)
