The payments API is the only service that writes to the ledger and the only one allowed to talk to Stripe.

Every mutating request needs an `Idempotency-Key` header. The API stores the key with the payment row, so a retry returns the first result instead of charging twice.
