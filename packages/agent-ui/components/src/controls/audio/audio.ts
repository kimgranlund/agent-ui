// audio.ts — UIAudioElement, the URL-sourced audio-player primitive (GH #1209; a conventional component
// admission per the ui-image ruling's precedent — the A2UI standard basic-catalog's AudioPlayer shape,
// realized as the NATIVE <audio controls>, no new ADR file, same wave as ui-video). A Display-class,
// non-form-associated leaf: the HOST mints no events, keyboard, or focus — the native element owns it all.
//
// Content model (the ui-image persistent-media law): the interior `<audio data-part="media" controls>` is
// created exactly once when `src` first goes non-empty and thereafter only ever MUTATED
// (src/preload/aria-label), never replaced. Empty `src` renders no <audio> at all.
//
// NO aspect box (contrast ui-video): an audio bar reserves no visual canvas — the UA player's intrinsic
// block-size IS the geometry (audio.md). No custom chrome; autoplay/loop are deliberate v1 absences.

import { UIElement, type ReactiveProps } from '../../dom/index.ts'
// Generated from audio.md's `attributes[]` (ADR-0173) — `node scripts/generate-props.mjs audio`.
import { props } from './audio.props.gen.ts'

export interface UIAudioElement extends ReactiveProps<typeof props> {}
export class UIAudioElement extends UIElement {
  static props = props

  // The persistent media element — built once, mutated thereafter (null until `src` is first non-empty).
  #media: HTMLAudioElement | null = null

  protected override connected(): void {
    this.effect(() => {
      const src = this.src
      const label = this.label
      const preload = this.preload

      if (src === '') {
        this.#media?.remove()
        this.#media = null
        return
      }

      if (!this.#media) {
        const audio = document.createElement('audio')
        audio.dataset.part = 'media'
        audio.setAttribute('controls', '') // native chrome always on (audio.md's fence)
        this.insertBefore(audio, this.firstChild)
        this.#media = audio
      }
      const audio = this.#media
      audio.src = src
      audio.setAttribute('preload', preload) // setAttribute — the image.ts jsdom-parity rationale
      if (label !== '') audio.setAttribute('aria-label', label)
      else audio.removeAttribute('aria-label')
    })
  }

  // Deliberately NO disconnected() nulling #media — the ui-image B2 reconnect-reparent lesson, verbatim.
}

if (!customElements.get('ui-audio')) customElements.define('ui-audio', UIAudioElement) // idempotent self-define
