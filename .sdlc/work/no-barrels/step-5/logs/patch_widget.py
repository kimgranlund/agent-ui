p='packages/agent-ui/a2ui/src/renderer/widget.ts'
s=open(p).read()
def rep(old,new):
    global s
    assert s.count(old)==1, old
    s=s.replace(old,new)

rep("""    return placeholder(node)
  }
  return factory.create()
}""","""    return placeholder(node)
  }
  // ADR-0233: in a catalog with a control loader, a node whose control is still undefined (its load failed;
  // the renderer host already emitted CONTROL_LOAD) renders as a placeholder, never as an undefined element.
  if (entry?.controls !== undefined && entry.controls.missing([factory.tag]).length > 0) return placeholder(node)
  return factory.create()
}""")

rep("""  if (factory === undefined) return // placeholder element — no props/input wiring (create() already reported CATALOG)
""","""  if (factory === undefined) return // placeholder element — no props/input wiring (create() already reported CATALOG)
  if (entry?.controls !== undefined && isPlaceholder(el)) return // ADR-0233: a failed-load placeholder stays inert
""")

rep("""function placeholder(node: A2uiComponent): HTMLElement {""","""function placeholder(node: A2uiComponent): HTMLElement {""")

rep("""  el.setAttribute('data-id', node.id)
  return el
}""","""  el.setAttribute('data-id', node.id)
  return el
}

/** Whether `el` is a placeholder minted by `create()` (an unknown type, or a control that failed to load). */
export function isPlaceholder(el: HTMLElement): boolean {
  return el.localName === 'a2ui-placeholder'
}""")
open(p,'w').write(s)
print('ok')
