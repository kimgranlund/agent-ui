// content-fields.ts: T-0162, the one field definition of each agent content kind (agent-content SPEC
// ACS-R10). A persona field is defined here once: its settings store key, its `agent.md` frontmatter key,
// its value type, where the admin pane edits it, and the optional layout hints the settings form reads.
// Every reader derives from this table instead of keeping its own list:
// - the content validator (`site/agent-content/schema.ts`) and the `scripts/agent-content.mjs` CLI check
//   each content file's frontmatter with `checkFieldValue`;
// - the settings pane's Agent and Model sections (`agentConfigSchema`, agent-admin-schema.ts) are the
//   `agent` and `model` rows mapped to `SettingsField`s;
// - the persona file's key set and the Builder's patch vocabulary (`PERSONA_STATE_KEYS`, persona-patch.ts)
//   are the `state` rows, and the patch gate admits a value only when `checkFieldValue` passes;
// - the pane coverage test pins every pane-edited row to a rendered `[data-field]`, and the reverse.
//
// It imports nothing, so Node loads it under type stripping (the generator and the CLI) as readily as
// the browser does. Labels and help text here are the pane's own, moved, not reworded: the Agent and Model
// sections and the surface, bankroll and response-type rows read them from here.

/** A field's value shape. `flags` is an object of booleans; `entries` an id-keyed entry list; `refs` a list
 *  of `<id>@<version>` refs; `true` and `false` a literal that is the only admitted value. */
export type FieldType = 'id' | 'string' | 'boolean' | 'integer' | 'number' | 'enum' | 'strings' | 'refs' | 'flags' | 'entries' | 'true' | 'false'

/** Where a field is edited. The first eight are the admin settings pane; `roster` is the Manage agents
 *  card; `seed` is seeded from the content file and never edited in the pane (a persona's catalog fragment
 *  and domains); `state` is persona state no control writes (the two kind switches the pane does not
 *  mount); `file` exists only in the content file (roster identity and authoring notes). */
export const FIELD_HOMES = ['agent', 'model', 'model-grid', 'switch', 'surface', 'catalog', 'entries', 'bankroll', 'roster', 'seed', 'state', 'file'] as const
export type FieldHome = (typeof FIELD_HOMES)[number]

/** The homes the settings pane renders a control for, each tagged `data-field` with its store key. */
export const PANE_HOMES: readonly FieldHome[] = ['agent', 'model', 'model-grid', 'switch', 'surface', 'catalog', 'entries', 'bankroll']

/** The settings form's layout hints for a field the `ui-settings` form renders (homes `agent` and `model`).
 *  `gate` names the model capability row member that decides whether the field shows and which values it
 *  offers; `notes` are per-value sentences appended to the description when that value is offered. */
export interface FormHint {
  control: 'text' | 'select' | 'boolean' | 'number'
  default?: string | number | boolean
  required?: boolean
  gate?: 'efforts' | 'thinking' | 'displays' | 'cacheTtls'
  optionLabels?: Readonly<Record<string, string>>
  notes?: Readonly<Record<string, string>>
}

export interface ContentField {
  /** The settings store key; absent for a field only the content file carries. */
  key?: string
  /** The content file's frontmatter key; absent for store state no file carries. */
  file?: string
  type: FieldType
  /** The file's shape when it differs from the store's (`domains` is a list in the file and a `+`-joined id
   *  in the store; `bankroll` is `true` in the file and the `bankrollCapable` flag in the store). */
  fileType?: FieldType
  values?: readonly string[]
  min?: number
  /** A string that must not be empty. */
  nonEmpty?: boolean
  /** Required in the content file. */
  required?: boolean
  home: FieldHome
  /** Persona state: exported in a persona file and patchable by the Builder (`PERSONA_STATE_KEYS`). */
  state?: boolean
  /** Runtime state the agent's turns write (game state), not an edit: no provenance, no strip. */
  runtime?: true
  label: string
  description?: string
  form?: FormHint
}

/** The capability entry kinds a persona references and a pack groups: the content files' kinds, defined
 *  here once (`site/agent-content/schema.ts` re-exports them as `ENTRY_KINDS`). */
export const CONTENT_ENTRY_KINDS = ['skill', 'workflow', 'resource', 'tool'] as const
export type ContentEntryKind = (typeof CONTENT_ENTRY_KINDS)[number]

/** The persona-flavored pack categories (GH #143), defined here once (re-exported by schema.ts). A third
 *  flavor earns its own member the day a third persona-flavored pack ships, never a bare string. */
export const PRESET_CATEGORIES = ['hospitality', 'games'] as const

/** A content id: lowercase and hyphenated, the folder name. */
export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** A ref: `<id>@<version>`, or `./<id>@<version>` for an entry under the persona's own folder. The groups
 *  are the `./`, the id and the version (`parseRef` in schema.ts reads them). */
export const REF_PATTERN = /^(\.\/)?([a-z0-9]+(?:-[a-z0-9]+)*)@([1-9][0-9]*)$/

/** The entry kinds the admin pane lists, in `ENTRY_KINDS` order (pinned by content-fields.test.ts). */
export const PANE_ENTRY_KINDS = ['prompt-section', 'skill', 'workflow', 'resource', 'tool', 'pattern-source', 'catalog'] as const

const KIND_LABELS: Readonly<Record<(typeof PANE_ENTRY_KINDS)[number], string>> = {
  'prompt-section': 'Instructions',
  skill: 'Skills',
  workflow: 'Workflows',
  resource: 'Resources',
  tool: 'Tools',
  'pattern-source': 'Pattern sources',
  catalog: 'Catalogs',
}

/** The content file's ref list for a capability kind (`skills: ["menu-card@1"]`); none for a pane-only kind. */
const fileRefsOf = (kind: string): string | undefined => ((CONTENT_ENTRY_KINDS as readonly string[]).includes(kind) ? `${kind}s` : undefined)

/** The persona kind. State rows are in the persona file's key order. */
export const PERSONA_FIELDS: readonly ContentField[] = [
  { file: 'id', type: 'id', required: true, home: 'file', label: 'Id' },
  { file: 'version', type: 'integer', min: 1, required: true, home: 'file', label: 'Seed version' },
  { file: 'order', type: 'integer', min: 1, home: 'file', label: 'Roster position' },
  { file: 'roster', type: 'false', home: 'file', label: 'In the roster' },
  { file: 'label', type: 'string', nonEmpty: true, required: true, home: 'roster', label: 'Label' },
  { file: 'tagline', type: 'string', nonEmpty: true, required: true, home: 'file', label: 'Tagline' },
  { file: 'category', type: 'enum', values: PRESET_CATEGORIES, home: 'file', label: 'Category' },
  {
    key: 'name',
    file: 'name',
    type: 'string',
    required: true,
    home: 'agent',
    state: true,
    label: 'Name',
    description: "The agent's display name.",
    form: { control: 'text', default: 'Untitled agent', required: true },
  },
  { key: 'model', file: 'model', type: 'string', required: true, home: 'model-grid', state: true, label: 'Default model' },
  {
    key: 'effort',
    file: 'effort',
    type: 'enum',
    values: ['low', 'medium', 'high', 'xhigh'],
    home: 'model',
    state: true,
    label: 'Effort',
    description: 'How much the model thinks and writes per turn. The chat composer starts here and can change it per turn.',
    form: { control: 'select', gate: 'efforts', optionLabels: { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra high' } },
  },
  {
    key: 'thinking',
    file: 'thinking',
    type: 'enum',
    values: ['adaptive', 'disabled', 'between_tools'],
    home: 'model',
    state: true,
    label: 'Thinking',
    description: 'Adaptive lets the model decide.',
    form: {
      control: 'select',
      gate: 'thinking',
      default: 'adaptive',
      optionLabels: { adaptive: 'Adaptive', disabled: 'Off', between_tools: 'Between tools' },
      notes: { disabled: 'Off turns thinking off (effort high or below).', between_tools: 'Between tools skips up-front thinking (effort high or below).' },
    },
  },
  {
    key: 'showReasoning',
    file: 'showReasoning',
    type: 'boolean',
    home: 'model',
    state: true,
    label: 'Show reasoning',
    description: "Stream a summary of the model's thinking into the chat. Off returns thinking empty; billing is the same.",
    form: { control: 'boolean', gate: 'displays' },
  },
  {
    key: 'maxTokens',
    file: 'maxTokens',
    type: 'integer',
    min: 0,
    home: 'model',
    state: true,
    label: 'Max tokens',
    description: 'The output ceiling per call, thinking included. 0 uses the effort-based default.',
    form: { control: 'number', default: 0 },
  },
  {
    key: 'cacheTtl',
    file: 'cacheTtl',
    type: 'enum',
    values: ['off', '5m', '1h'],
    home: 'model',
    state: true,
    label: 'Prompt cache',
    description: 'Cache the system prompt between turns for this long.',
    form: { control: 'select', gate: 'cacheTtls', default: 'off', optionLabels: { off: 'Off', '5m': '5 minutes', '1h': '1 hour' } },
  },
  { key: 'modelsIncluded', type: 'flags', home: 'model-grid', state: true, label: 'Models offered' },
  { key: 'agentEnabled', type: 'boolean', home: 'switch', state: true, label: 'Agent' },
  ...PANE_ENTRY_KINDS.map(
    (kind): ContentField => ({
      key: `${kind}sEnabled`,
      ...(kind === 'tool' ? { file: 'toolsEnabled', required: true } : {}),
      type: 'boolean',
      // Instructions carries no master switch, and the catalog kind's gate is the A2UI surface switch.
      home: kind === 'prompt-section' || kind === 'catalog' ? 'state' : 'switch',
      state: true,
      label: KIND_LABELS[kind],
    }),
  ),
  { key: 'surfaceMarkdown', type: 'boolean', home: 'surface', state: true, label: 'Markdown' },
  { key: 'surfaceA2ui', type: 'boolean', home: 'surface', state: true, label: 'A2UI' },
  { key: 'surfaceGenui', type: 'boolean', home: 'surface', state: true, label: 'GenUI' },
  { key: 'surfaceGenuiDogfood', type: 'boolean', home: 'surface', state: true, label: 'Use agent-ui components' },
  { key: 'surfacePlanner', type: 'boolean', home: 'surface', state: true, label: 'Planner' },
  { key: 'surfaceAuthoring', type: 'boolean', home: 'surface', state: true, label: 'Authoring' },
  { key: 'a2uiCatalog', type: 'string', home: 'catalog', state: true, label: 'Catalog' },
  { key: 'a2uiLocalPatterns', file: 'localPatterns', type: 'string', home: 'seed', state: true, label: 'Local patterns' },
  { key: 'bankrollCapable', file: 'bankroll', type: 'boolean', fileType: 'true', home: 'seed', state: true, label: 'Bankroll' },
  { key: 'bankroll', type: 'number', min: 0, home: 'bankroll', state: true, runtime: true, label: 'Stored bankroll' },
  ...PANE_ENTRY_KINDS.map(
    (kind): ContentField => ({
      key: `entries:${kind}`,
      ...(fileRefsOf(kind) === undefined ? {} : { file: fileRefsOf(kind), fileType: 'refs' as const, required: true }),
      type: 'entries',
      home: 'entries',
      state: true,
      label: KIND_LABELS[kind],
    }),
  ),
  // Store keys the pane edits that are not persona-file state (never exported, never patchable).
  { key: 'surfaceBubbles', type: 'boolean', home: 'surface', label: 'Chat bubbles' },
  { key: 'prefers', type: 'enum', values: ['auto', 'text', 'surface'], home: 'surface', label: 'Response type' },
  { key: 'a2uiDomains', file: 'domains', type: 'string', fileType: 'strings', home: 'seed', label: 'Domains' },
  // File only: the seed's shape and its authoring context.
  { file: 'disabledBuiltins', type: 'strings', home: 'file', label: 'Builtin sections seeded off' },
  { file: 'changelog', type: 'strings', home: 'file', label: 'Changelog' },
  { file: 'notes', type: 'strings', home: 'file', label: 'Notes' },
]

/** A capability entry file's frontmatter (`SKILL.md`, `WORKFLOW.md`, `RESOURCE.md`, `TOOL.md`). */
export const ENTRY_FIELDS: readonly ContentField[] = [
  { file: 'name', type: 'id', required: true, home: 'file', label: 'Name' },
  { file: 'description', type: 'string', required: true, home: 'file', label: 'Description' },
  { file: 'id', type: 'id', required: true, home: 'file', label: 'Id' },
  { file: 'version', type: 'integer', min: 1, required: true, home: 'file', label: 'Version' },
  { file: 'kind', type: 'enum', values: CONTENT_ENTRY_KINDS, required: true, home: 'file', label: 'Kind' },
  { file: 'availability', type: 'enum', values: ['context', 'invocable'], required: true, home: 'file', label: 'Availability' },
  { file: 'label', type: 'string', nonEmpty: true, required: true, home: 'file', label: 'Label' },
]

/** A pack file (`pack.json`). */
export const PACK_FIELDS: readonly ContentField[] = [
  { file: 'id', type: 'id', required: true, home: 'file', label: 'Id' },
  { file: 'version', type: 'integer', min: 1, required: true, home: 'file', label: 'Version' },
  { file: 'kind', type: 'enum', values: CONTENT_ENTRY_KINDS, required: true, home: 'file', label: 'Kind' },
  { file: 'order', type: 'integer', min: 1, required: true, home: 'file', label: 'Order' },
  { file: 'label', type: 'string', nonEmpty: true, required: true, home: 'file', label: 'Label' },
  { file: 'description', type: 'string', required: true, home: 'file', label: 'Description' },
  { file: 'category', type: 'enum', values: PRESET_CATEGORIES, home: 'file', label: 'Category' },
  { file: 'rejectOnCollision', type: 'true', home: 'file', label: 'Reject on collision' },
  { file: 'entries', type: 'refs', home: 'file', label: 'Entries' },
  { file: 'derived', type: 'enum', values: ['mini-skill'], home: 'file', label: 'Derived' },
]

/** The persona row for a store key. */
export const PERSONA_FIELD_BY_KEY: ReadonlyMap<string, ContentField> = new Map(
  PERSONA_FIELDS.filter((f): f is ContentField & { key: string } => f.key !== undefined).map((f) => [f.key, f]),
)

/** The persona file's state keys, in order: `PERSONA_STATE_KEYS`' source. */
export const PERSONA_STATE_FIELD_KEYS: readonly string[] = PERSONA_FIELDS.filter((f) => f.state === true && f.key !== undefined).map((f) => f.key!)

const isPlainObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

/** The one value check: `undefined` when `value` fits `field` (on the store side, or the file side when
 *  the file's shape differs), else the reason it does not. An absent value is the caller's question
 *  (`required`); this checks a present one. */
export function checkFieldValue(field: ContentField, value: unknown, side: 'store' | 'file' = 'store'): string | undefined {
  const type = side === 'file' && field.fileType !== undefined ? field.fileType : field.type
  const name = (side === 'file' ? field.file : field.key) ?? field.key ?? field.file ?? field.label
  switch (type) {
    case 'id':
      return typeof value === 'string' && ID_PATTERN.test(value) ? undefined : `${name} is not a lowercase-hyphenated id`
    case 'string':
      if (typeof value !== 'string') return `${name} is not a string`
      return field.nonEmpty === true && value === '' ? `${name} is not a non-empty string` : undefined
    case 'boolean':
      return typeof value === 'boolean' ? undefined : `${name} is not a boolean`
    case 'true':
      return value === true ? undefined : `${name} is true when present`
    case 'false':
      return value === false ? undefined : `${name} is false when present`
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) return `${name} is not an integer`
      return field.min !== undefined && value < field.min ? `${name} is below ${field.min}` : undefined
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return `${name} is not a number`
      return field.min !== undefined && value < field.min ? `${name} is below ${field.min}` : undefined
    case 'enum':
      return typeof value === 'string' && (field.values ?? []).includes(value) ? undefined : `${name} ${JSON.stringify(value)} is not one of ${(field.values ?? []).join(', ')}`
    case 'strings':
      return Array.isArray(value) && value.every((s) => typeof s === 'string') ? undefined : `${name} is not a string array`
    case 'refs':
      if (!Array.isArray(value) || !value.every((s) => typeof s === 'string')) return `${name} is not a string array`
      for (const ref of value) if (!REF_PATTERN.test(ref)) return `${name} ref ${ref} is not <id>@<version> or ./<id>@<version>`
      return undefined
    case 'flags':
      return isPlainObject(value) && Object.values(value).every((v) => typeof v === 'boolean') ? undefined : `${name} is not an object of booleans`
    case 'entries':
      return Array.isArray(value) && value.every((e) => isPlainObject(e) && typeof e['id'] === 'string') ? undefined : `${name} is not a list of entries with string ids`
  }
}

/** Every problem in one frontmatter object against a kind's fields: an unknown key, a missing required
 *  field, a value of the wrong shape. `[]` means it fits. Kind-specific rules (refs that resolve, folder
 *  names, order uniqueness) stay with the caller. */
export function checkFrontmatter(fields: readonly ContentField[], frontmatter: Readonly<Record<string, unknown>>): string[] {
  const out: string[] = []
  const byFile = new Map(fields.filter((f) => f.file !== undefined).map((f) => [f.file!, f]))
  for (const key of Object.keys(frontmatter)) if (!byFile.has(key)) out.push(`unknown key ${key}`)
  for (const [key, field] of byFile) {
    const value = frontmatter[key]
    if (value === undefined) {
      if (field.required === true) out.push(`${key} is required`)
      continue
    }
    const problem = checkFieldValue(field, value, 'file')
    if (problem !== undefined) out.push(problem)
  }
  return out
}
