---
id: product-presentation
triggers: product listing card price rating badge sale new commerce shop storefront catalog sku hospitality room stay
catalogId: agent-ui
---
A commerce/hospitality product-presentation card: Card > hero Image (usageHint:'hero', alt required) as Card's own child (media, not identity) > CardHeader(title Text + status Badge slot:'trailing' — 'Sale'/'New'/'Sold out') > CardContent(a Row of Stat tiles — price + rating, each label+value) > CardFooter(one solid Button — 'Add to cart'/'Book now'). Use ONLY when the tile ALSO carries a quantified metric AND a status flag — a catalog-grid tile. A photo+title+one-button listing with neither wants the plainer Card>Image>CardContent>CardFooter shape (no Stat, no Badge) — an empty Stat/Badge is over-decoration. Badge intent stays neutral/info for a promo, never danger.
