---
id: variant-picker
triggers: variant option choose pick size color style plan tier select segmented choice
catalogId: agent-ui
---
Picking one option from a closed set (size, color, plan tier). ≤3 members with short (≤5-char) labels in a single row → SegmentedControl (Field label wraps it, `value` bound, `Segment` children each `value`+`label`) — always-visible, no open/close state (booking-reservation's room-type picker proves it). More members, or labels too long for one row → Select (`value` bound, `Option` children, ship Select+Options in ONE message for exact order). Never SegmentedControl a >3-member or long-label set — it wraps or truncates; never Select a 2-3-member always-visible choice — it hides the options behind a closed dropdown for no reason.
