// video.ts — UIVideoElement, the URL-sourced video-player primitive (GH #1209; a conventional component
// admission per the ui-image ruling's exact precedent — the A2UI standard basic-catalog's Video shape,
// realized as the NATIVE <video controls>, no new ADR file). A Display-class, non-form-associated leaf:
// this HOST mints no events, no keyboard contract, no focus — the native element inside owns ALL of it.
//
// Content model (the ui-image persistent-media law, verbatim): the interior `<video data-part="media"
// controls>` is CONTROL-BUILT but PERSISTENT — created exactly once when `src` first goes non-empty and
// thereafter only ever MUTATED (src/poster/preload/aria-label), never replaced. An empty `src` renders no
// <video> at all (never a dead player shell — the avatar.ts "never a broken box" discipline).
//
// ZERO CLS: the host's `aspect-ratio` is ALWAYS concrete — image-model.ts's parseAspectRatio (SHARED, not
// forked: the same "W/H" grammar, the same 16/9 fallback) writes the private per-instance `--_aspect` style
// property (the ui-image/ui-progress precedent) — never "auto".
//
// NO custom chrome: transport, scrubbing, volume, fullscreen are the UA's own (`controls` is always set).
// autoplay/loop/muted and <track> captions are DELIBERATE v1 absences — named future intakes (video.md),
// never silent defaults.

import { UIElement, type ReactiveProps } from '../../dom/index.ts'
import { parseAspectRatio } from '../image/image-model.ts'
// Generated from video.md's `attributes[]` (ADR-0173) — `node scripts/generate-props.mjs video` to
// regenerate; never hand-edit video.props.gen.ts.
import { props } from './video.props.gen.ts'

export interface UIVideoElement extends ReactiveProps<typeof props> {}
export class UIVideoElement extends UIElement {
  static props = props

  // The persistent media element — built once, mutated thereafter (null until `src` is first non-empty).
  #media: HTMLVideoElement | null = null

  protected override connected(): void {
    this.effect(() => {
      const src = this.src
      const label = this.label
      const poster = this.poster
      const preload = this.preload

      if (src === '') {
        this.#media?.remove()
        this.#media = null
        return
      }

      if (!this.#media) {
        const video = document.createElement('video')
        video.dataset.part = 'media'
        // Native chrome always on — this component ships no custom player UI (video.md's fence).
        video.setAttribute('controls', '')
        this.insertBefore(video, this.firstChild)
        this.#media = video
      }
      const video = this.#media
      video.src = src
      // setAttribute (not IDL) for preload/poster — keeps jsdom probes and real-engine behaviour identical
      // (the image.ts loading/decoding setAttribute rationale).
      video.setAttribute('preload', preload)
      if (poster !== '') video.setAttribute('poster', poster)
      else video.removeAttribute('poster')
      // The player's accessible name — the NATIVE element carries it (video.md aria.labelSource); the host
      // mints no internals role, so nothing double-announces.
      if (label !== '') video.setAttribute('aria-label', label)
      else video.removeAttribute('aria-label')
    })

    // The zero-CLS aspect box — shared parseAspectRatio, private per-instance property (the ui-image law).
    this.effect(() => {
      this.style.setProperty('--_aspect', parseAspectRatio(this.aspect))
    })
  }

  // Deliberately NO disconnected() nulling #media — the reconnect-reparent lesson from ui-image's B2 review
  // finding applies verbatim: the interior element survives a host reparent as a real child, and nulling the
  // ref would prepend a SECOND player on reconnect.
}

if (!customElements.get('ui-video')) customElements.define('ui-video', UIVideoElement) // idempotent self-define
