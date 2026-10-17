---
{
  "name": "palette-presentation",
  "description": "The token-surface idiom: swatches for anchors, ramps for scales, a ladder for spacing and size tiers, one ContrastPair per pairing.",
  "id": "palette-presentation",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "palette-presentation"
}
---
Anchors first as Swatches, then each family as one Ramp; name steps 50-900. Each proposed text-on-background pairing is ONE ContrastPair (foreground, background, label): the surface computes its ratio and AA/AAA verdicts, so the prose never states a ratio the surface did not compute. Spacing and size tiers are ONE Ladder (label, then tiers of {label, value}), smallest step first, so each step renders at its real size.
