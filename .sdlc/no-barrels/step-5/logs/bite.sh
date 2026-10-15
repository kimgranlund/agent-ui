#!/bin/zsh
# Mutate one seam at a time, run the control-loading test, restore. Prints each mutation's exit code.
cd /Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-nobarrels
R=packages/agent-ui/a2ui/src/renderer/renderer.ts
W=packages/agent-ui/a2ui/src/renderer/widget.ts
T=packages/agent-ui/a2ui/src/renderer/control-loading.test.ts
cp $R /tmp/.bite-r-$$; cp $W /tmp/.bite-w-$$
run() { npx vitest run $T > .sdlc/no-barrels/step-5/logs/bite-$1.log 2>&1; echo "$1 rc=$? $(grep -c '×' .sdlc/no-barrels/step-5/logs/bite-$1.log) failing"; cp /tmp/.bite-r-$$ $R; cp /tmp/.bite-w-$$ $W; }
# 1: updateDataModel never queued
python3 -c "
p='$R'; s=open(p).read(); s=s.replace('    if (queued !== undefined) {\n      queued.messages.push({ run: () => this.#applyDataModel(body) })','    if (false as boolean) {\n      queued!.messages.push({ run: () => this.#applyDataModel(body) })',1); open(p,'w').write(s)"
run datamodel
# 2: finalize never queued
python3 -c "
p='$R'; s=open(p).read(); s=s.replace('      this.#finalizeOrQueue(surfaceId)','      this.#finalizeSurface(surfaceId)',1); open(p,'w').write(s)"
run finalize
# 3: no failed-load placeholder in create()
python3 -c "
p='$W'; s=open(p).read(); s=s.replace('entry.controls.missing([factory.tag]).length > 0) return placeholder(node)','false) return placeholder(node)',1); open(p,'w').write(s)"
run placeholder
# 4: no queue drop on teardown
python3 -c "
p='$R'; s=open(p).read(); s=s.replace('    this.#controlQueues.delete(id) // ADR-0233','    void 0 // ADR-0233',1); open(p,'w').write(s)"
run teardown
rm -f /tmp/.bite-r-$$ /tmp/.bite-w-$$
git diff --stat -- $R $W | tail -1
