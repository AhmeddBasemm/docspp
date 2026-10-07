Stripe is the only service outside our network. We call it with an **idempotency key** on every request, and it answers either `succeeded` or a decline code such as `card_declined`.
