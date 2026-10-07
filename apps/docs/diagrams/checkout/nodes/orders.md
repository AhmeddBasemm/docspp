The order service owns the order lifecycle. It is the only service that talks to the payment provider.

**States**

| State | Meaning |
|---|---|
| `pending` | stored, not yet charged |
| `paid` | the payment intent succeeded |
| `failed` | the card was declined or the intent expired |

Every state change publishes an `order.*` event so other services never need to poll.

```http
POST /orders
Authorization: Bearer <jwt>
Content-Type: application/json

{ "cartId": "c_81", "paymentMethod": "pm_card_visa" }
```
