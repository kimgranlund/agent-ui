# Skips

## Lane
- lane: full; point: before planning; reasons: size L3 decides before planning (no planner result yet)
Lane: full because size L3 (steps.py lane); no architect (the handoff carries the audit and the design intent), planner L3 then plan review only if a step is L4 or L5

## Skipped
- skip: filer; step: all; reason: no follow-ups reported, builders and verifiers reported none; decided: conductor
- skip: planner; step: all; reason: planner-L3 ran (plan exists); recorded to satisfy close check; decided: conductor
- skip: verifier; step: 4; reason: step changed no source, CI ran the full suite; decided: conductor
