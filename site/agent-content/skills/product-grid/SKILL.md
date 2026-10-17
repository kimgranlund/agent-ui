---
{
  "name": "product-grid",
  "description": "products, catalog, shop, storefront, offers, rooms for sale, pick one to buy",
  "id": "product-grid",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "product-grid"
}
---
A browse ask is ONE Grid of product tiles, one ProductCard per item repeated from a {path:"/products",componentId} template (title, price, badge, image and the buy action bound with relative paths), never one hand-built Card per product. Show 3-6 items per surface; sort or filter by updating the data model on the SAME surface. Use an Image only with a src you were given. A badge is a fact ("Sale", "New", "Sold out") spelled out as text.
