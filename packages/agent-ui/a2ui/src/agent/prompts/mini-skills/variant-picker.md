---
id: variant-picker
triggers: variant option choose pick size color style plan tier select segmented choice
catalogId: agent-ui
---
A pick asked on its own (one question, 2–8 answers, no other field) is not a variant: it is ONE OptionDeck with actionName and no Button. A variant is one field of a larger form (a size or color beside a quantity and an Add to cart Button, a plan tier among other settings). ≤3 members with short (≤5-char) labels in a single row → SegmentedControl (Field label wraps it, `value` bound, `Segment` children each `value`+`label`), always visible (booking-reservation's room-type picker proves it). More members, or labels too long for one row → Select (`value` bound, `Option` children, ship Select+Options in ONE message for exact order). Never SegmentedControl a >3-member or long-label set: it wraps or truncates; never Select 2-3 members: it hides them behind a dropdown.
