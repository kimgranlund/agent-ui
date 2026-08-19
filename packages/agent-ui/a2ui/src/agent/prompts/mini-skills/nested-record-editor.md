---
id: nested-record-editor
triggers: team roster members nested parent record group manage assign role add member remove
catalogId: agent-ui
---
Nested-record editor — one parent record (name/description) OWNING a member sub-list, each member its own fields — not a flat entry-list (there is an owning parent, not a container of peers). Map: FormProvider > Column(Field›TextField for the parent's own name/description) > List templated over `/team/members`, each member a Row of Select(bound `role`) + TextField(bound a per-member field) + Button(ghost 'Remove'). A trailing Button 'Add member' appends one blank record to the array (one updateDataModel write, no tree resend). Distinct from master-detail-split (peers browsed via SELECTION) and the flat CRUD entry-list (no owning parent). Wall: cross-member checks (e.g. a unique pick) are host logic, not wire-expressible.
