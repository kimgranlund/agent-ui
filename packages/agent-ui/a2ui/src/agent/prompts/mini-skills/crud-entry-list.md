---
id: crud-entry-list
triggers: entry list crud manage items enable disable edit remove delete add library roster catalog skills tools agents entries rows toggle
catalogId: agent-ui
---
An ordered CRUD entry-list — enable/disable + edit + add-from-library over named items. Map: List templated over `/entries` (`{path,componentId}`); each row = Row(justify 'between', align 'center') of Switch(checked bound) + Text(text bound to the item's name — Switch's own `label` is NOT bindable, so the visible name rides the separate Text, never the switch) + Button(ghost 'Edit', opens the edit Drawer). Edit: Drawer(edge 'end', open bound) > FormProvider > Column(one Field›TextField per editable field) > Row(solid Save, submit:true). Add-from-library: a Menu whose rows are BUTTONS, each its own `action` carrying the picked id — never bare MenuItem, which carries no `action` slot and commits nothing back over the wire. Wall: drag-reorder is not hosted.
