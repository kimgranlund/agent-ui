---
id: product-presentation
triggers: product listing card price rating badge sale new commerce shop storefront catalog sku hospitality room stay
catalogId: agent-ui
---
A product, room or offer to buy or book is ONE ProductCard: title, subtitle, image (+ imageAlt), price (+ priceNote like "per night"), rating (0 to 5), badge (+ badgeIntent) and one action (actionLabel + action). Never rebuild it from Card, Image, Stat, Badge and Button. For several items, template ONE ProductCard over a list in a Grid (min about 16rem), bind each prop to the item path, and put the item id in the action context. Omit every prop you have no value for: no price and no action is an exhibit tile (an icon in place of image gives an image-free header). badgeIntent is neutral or info for a promo, never danger. A click anywhere on the card fires its action. Content not for sale stays a Card.
