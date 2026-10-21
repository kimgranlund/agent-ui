---
id: step-flow
triggers: wizard multi-step steps scenes walkthrough
catalogId: agent-ui
---
A flow the user walks in order with Back and Next is ONE StepFlow on a canvas surface, never on an ask. Each scene is one child, in order; steps holds their labels. Not Tabs: Tabs is for panels visited in any order. Back and Next run on the client, and Next checks the scene's fields, so add no Back or Next Button to any scene. Bind every field under /draft/<key> and bind draft to /draft, so the draft is the whole answer. Finish one of two ways: set finishAction {action, context} (the finish press sends it with the draft in its context) and finishLabel, or, where the catalog has a BookingForm, leave finishAction out and make that form the last scene, whose own Button commits; StepFlow then draws Back on that Button's row.
