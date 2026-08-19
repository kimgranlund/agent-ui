---
id: crud-entry-list
triggers: entry list crud manage items enable disable edit remove delete add library roster catalog skills tools agents entries rows toggle
catalogId: agent-ui
---
A CRUD entry-list — enable/disable + edit + add-from-library. Map: List templated over `/entries` (`{path,componentId}`); each row = Row(justify 'between', align 'center') of Field(label bound to the item's name, child: Switch, checked bound — Switch's own `label` is NOT bindable, and a sibling Text never NAMES the switch for assistive tech; Field's bindable label does both jobs) + Button(ghost 'Edit'). Edit: Drawer(edge 'end', open bound) BESIDE the Card, never inside CardContent > FormProvider > Column(one Field›TextField per field) > Row(solid Save, submit:true). Add-from-library: a Menu whose rows are BUTTONS, each with its own `action` carrying the picked id — never bare MenuItem, which has no `action` slot and commits nothing over the wire. Wall: drag-reorder is not hosted.
