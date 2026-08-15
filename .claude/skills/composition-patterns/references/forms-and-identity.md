# Forms & identity flows

The `ui-form-provider` + `ui-field` spine and its seven consumer rows: the base labelled form,
then the ADR-0176 identity & account family (credential sign-in, magic link, OTP, social
sign-in, onboarding, account-settings) that all ride the same registry/labelling seam. Read this
file when wiring any form, or any of the six auth/onboarding/account surfaces.

| Assembly problem | The fleet's answer | Owner · exemplar |
|---|---|---|
| A labelled, validated form | `ui-form-provider` (the registry) + `ui-field` wrapping each control (the labelling seam; error rendering is reactive and field-owned) — never hand-rolled `<label for>` plumbing | ADR-0050/0051 · `site/pages/forms.ts` (one live form the whole guide narrates) |
| A credential form (registration or sign-in) | the shared `ui-form-provider` + `ui-field` auth-card spine; server rejections and cross-field checks poison the field via `setCustomValidity()` (blocks resubmit through the merged validity), but a PURELY custom message rides a page-owned status caption — `ui-text-field`'s user-invalid gate is blind to custom-only messages (the GH #554 finding; mechanism detail in the page's own file banner) | ADR-0176 cl.1/cl.2 + `identity-mock-transport.spec.md` SPEC-R1/R5/R8/R9 · `site/pages/credentials.ts` (`wireRegister`/`wireSignIn` + file banner) |
| A credential-less sign-in (magic link) | request → confirmation state (`ui-text` + a page-level countdown resend affordance) → confirm; confirm-step rejections attach to NO field (a stateless affordance click), so messages ride the same page-owned status caption — nothing to poison (detail in the page banner) | ADR-0176 cl.1/cl.2 + `identity-mock-transport.spec.md` SPEC-R3/R5/R8/R9 · `site/pages/magic-link.ts` (`wireMagicLink` + file banner) |
| A segmented one-time-code sign-in (OTP) | request → `ui-otp-field` field-wrapped → signed in; NO submit button — the control's user-completion `change` IS the verify trigger; `code-invalid`/`code-expired` render straight through `ui-field`'s inline error (post-#554 path), `code-rate-limited` rides the status caption; resend mirrors the server-enforced cooldown (detail in the page banner) | ADR-0176 cl.1/cl.2 + `code-entry-control.lld.md` + `identity-mock-transport.spec.md` SPEC-R2/R5/R8/R9 · `site/pages/otp-signin.ts` (`wireOtpFlow` + file banner) |
| A social provider sign-in (redirect + callback) | a provider-button row over plain `ui-button` — no form, no fields; `startSocialSignIn` simulates the redirect (display-only hint, SPEC-N8) and the callback card's Complete/Cancel actions simulate the OAuth callback (Cancel = the `generic` demo-denial sentinel); OQ2 realized as text-only buttons, no brand marks (detail in the page banner) | ADR-0176 cl.1/cl.2 + `identity-mock-transport.spec.md` SPEC-R4/R5/R8/R9 · `site/pages/social-signin.ts` (`wireSocialSignIn` + file banner) |
| A stepped onboarding flow (first-run) | next/back/skip over plain `ui-button` + signal-driven step panels, paired with `ui-progress`'s `segments` prop for the discrete Step-N-of-M readout (OQ1's ruling); the journey gates on `getSession()` alone (SPEC-N7 — no new transport operation); Skip and Finish reach the SAME terminal state (detail in the page banner) | ADR-0176 cl.1/cl.2 + `feed-family.spec.md` SPEC-R1 Amendment v1 + `identity-mock-transport.spec.md` SPEC-N7/R5 · `site/pages/onboarding.ts` (`wireOnboarding` + file banner) |
| An account-settings surface behind a sign-in gate | the SHIPPED `ui-settings` + a generic schema + store — no new control, no new transport operation; the gate hides the WHOLE surface, session fields render on a page-owned identity card (never schema fields), and the store deliberately OUTLIVES the session (the page banner records the three forks) | ADR-0176 cl.1/cl.2 + `identity-mock-transport.spec.md` SPEC-R5 + `settings.md` · `site/pages/account-settings.ts` (file banner) |

## Completed intakes

The ADR-0176 identity & account family (S1–S5) landed as the six auth/onboarding/account rows
above — nothing from that family remains queued (Kim's 2026-08-07 OQ rulings all realized;
GH #761 retired the stale Queued section this line replaces).
