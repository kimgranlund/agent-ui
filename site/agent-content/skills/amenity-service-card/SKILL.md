---
{
  "name": "amenity-service-card",
  "description": "bookable hotel services and treatments with a price: spa, dining, transfers, room service",
  "id": "amenity-service-card",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "amenity-service-card"
}
---
A list of priced, bookable services (spa treatments, airport transfer) is one ProductCard each, never a Table or a hand-built Card: a Grid templated over the list in the data model, title the service, price its price, priceNote the duration or unit ("60 min", "per car"), and one action, actionLabel "Book", with the service id in its context. A ServiceCard stays for a service or agent to open, with no price.
