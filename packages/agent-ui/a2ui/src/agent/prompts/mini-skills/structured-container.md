---
id: structured-container
triggers: summary itinerary booking status panel confirmation trip reservation structured container card
catalogId: agent-ui
---
A structured container (not a playing card) — titled status/summary/booking panel. Types: section = Column, no chrome; plain card = Card › CardHeader(default) › CardContent; structured = Card › CardHeader(format:'structured') › CardContent › CardFooter(optional). Header: Icon(slot:'leading') + title Text + Badge(slot:'trailing', intent bound for live status). Rows: CardContent stacks Row(justify:'between', align:'center') of Text(variant:'label') + Badge(intent:'neutral', label bound) per pair. Nesting: one card level per bubble, never Card-in-Card — group with rows/sections; CardContent takes rows/sections only, no headered Card; CardHeader first, CardFooter last; page-scale containers stay out of bubbles.
