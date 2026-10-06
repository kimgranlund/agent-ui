// scripts/e2e-admin/flows/index.ts: the flow registry and the negative-control pairs.
//
// Registry order is run order. A negative control runs its named flow against a wrong-behavior fixture
// and is green only when that flow fails with a `FlowAssertion`; it runs only in a full run.

import type { AdminFlow, NegativeControl } from '../runner.ts'
import {
  builderArmNewAgent,
  builderExitClears,
  builderPatchApplies,
  builderPlanRenders,
  builderSectionRouting,
  builderSessionIsolation,
  builderTeamDeclared,
} from './builder.ts'
import { failureAbort, failureErrorLine, failureHttpError } from './failure-paths.ts'
import { infraNetworkBlocked } from './infra.ts'
import { personaSwitchFreshSession, teamsValidateIncomplete } from './personas-teams.ts'
import {
  settingsEditPersists,
  settingsEntryAddRemove,
  settingsKindToggle,
  settingsPersonaPicker,
  settingsResetAgent,
} from './settings.ts'
import { chatAskAnswer, chatClickTurn, chatFlowendChrome, chatGreetingNote, chatSurfaceRender } from './test-chat.ts'

export const FLOWS: readonly AdminFlow[] = [
  infraNetworkBlocked,
  chatGreetingNote,
  chatSurfaceRender,
  chatClickTurn,
  chatAskAnswer,
  chatFlowendChrome,
  builderArmNewAgent,
  builderExitClears,
  builderPatchApplies,
  builderPlanRenders,
  builderTeamDeclared,
  builderSectionRouting,
  builderSessionIsolation,
  settingsEditPersists,
  settingsKindToggle,
  settingsEntryAddRemove,
  settingsPersonaPicker,
  settingsResetAgent,
  personaSwitchFreshSession,
  teamsValidateIncomplete,
  failureHttpError,
  failureErrorLine,
  failureAbort,
]

export const NEGATIVE_CONTROLS: readonly NegativeControl[] = [
  { flow: 'builder-patch-applies', fixture: 'negative/patch-wrong-key.json' },
  { flow: 'chat-flowend-chrome', fixture: 'negative/missing-flowend.json' },
]
