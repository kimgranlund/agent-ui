---
{
  "name": "quest-log",
  "description": "adventure, dungeon, narrative quest, inventory, HP",
  "id": "quest-log",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "quest-log"
}
---
An adventure runs on one surface: a Timeline quest log (append one item per scene, cap ~8 and summarize older ones), ONE GameHud (stats HP and Gold with signed deltas, status = the scene), an inventory List (≤6 items), and 2-3 choice Buttons per scene. Lore goes in a Disclosure, never inline walls of text. Narration stays in chat; the surface carries STATE. End state: HP at 0 or the quest done shows ONE ResultCard (outcome lose or win, a title, a one-line summary, the final stats) whose child is a Play again Button with newGame true in its action context.
