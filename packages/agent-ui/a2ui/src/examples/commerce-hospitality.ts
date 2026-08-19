// commerce-hospitality.ts — GH #1377's commerce+hospitality genui-pack: composed idioms the catalog can
// already express but no mini-skill/node-idioms card named yet (the a2ui-teaching class, "COMPOSE +
// TEACH" — same shape as GH #1355's crud-entry-list wave, GH #972's high-frequency-patterns wave).
//
// (1) PRODUCT-PRESENTATION CARD (the FLAGSHIP) — Card+Image+Stat+Badge: a hero Image (media, not
//     identity — the frontier-image-hero-card precedent), a CardHeader identity row (title + a trailing
//     status Badge), a CardContent Row of Stat tiles (the quantified metrics — price/rating), and a
//     CardFooter single commit Button. Distinct from frontier-image-hero-card's plainer Card>Image>
//     CardContent>CardFooter shape (that one carries NEITHER a Stat nor a Badge — a single-fact
//     listing). This is the corpus-admission candidate this wave judges (ADR-0068).
// (2) PRODUCT OPTIONS — variant-picker (SegmentedControl) + quantity (number TextField): a size-variant
//     SegmentedControl (≤3 short labels, the booking-reservation room-type precedent) and a Field-
//     wrapped `type:'number'` TextField for quantity, gated by one FormProvider, in a Card ending with
//     the Add-to-cart commit Button.
// (3) LISTING PHOTO GRID — media-grid: a Grid of bare Image tiles templated over a photo list, distinct
//     from media-file-grid's Attachment-tile idiom (high-frequency-patterns.ts) — every tile here IS a
//     photo meant to be viewed, never a heterogeneous file needing type-aware chrome.
//
// Admission (ADR-0165/ADR-0068): only (1) is judged + admitted this wave — the ticket's own scope
// (GH #1377) names ONE judged corpus seed, for the flagship. (2) and (3) carry the same "NO VERDICT
// SOUGHT YET, not a refusal" pending-state disposition the GH #729/#1205/#1206 waves used
// (disposition-allowlist.ts) — a future judged wave should admit or drop them, deleting their entries.

import type { ExampleSeed } from './types.ts'

const PRODUCT_ID = 'commerce-product-card'
/** The flagship: a boutique-hotel room listing (commerce+hospitality merge, the ticket's own domain
 *  framing) — hero Image, CardHeader(title + a trailing 'Popular' status Badge), CardContent(a Row of
 *  two Stat tiles — nightly price + guest rating), CardFooter(the one 'Book now' commit Button). Every
 *  varying field is data-bound (never a literal standing in for what a real agent would template) — the
 *  "dead data" defect class named at intake. Card-anatomy law observed: CardHeader carries identity
 *  (title+badge), CardContent carries substance (the Stat readouts), CardFooter carries the one action —
 *  never a Button loose in content (req-a2ui-patterns.md R1 / a2ui-payload.md P9).
 *  P5 repair (2026-08-19, first judged pass): the title+Badge originally rode a Row ONE LEVEL BELOW
 *  CardHeader — the judge caught that a slotted Badge's `[slot='trailing']` placement is a direct-child
 *  CSS grid (`card.css`'s `:has(> [slot='trailing'])`), so the Row-nested Badge rendered inert. Fixed by
 *  making Text+Badge CardHeader's own direct children with `format:'structured'` (the
 *  structured-container.ts:41-45 precedent) — re-judged fresh after the repair. */
export const commerceProductCardSeed: ExampleSeed = {
  name: 'commerce-product-card',
  description:
    'A commerce/hospitality product-presentation card — hero Image, CardHeader identity row with a status Badge, CardContent Row of price + rating Stat tiles, CardFooter single Book-now Button.',
  promptText: 'Show this room listing as a card: the photo, its name with a "Popular" badge, the nightly price and guest rating, and a book-now button.',
  surfaceId: PRODUCT_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: PRODUCT_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: PRODUCT_ID,
        value: {
          listing: {
            photo: '/photos/ocean-view-suite.jpg',
            title: 'Ocean View Suite',
            badge: 'Popular',
            price: '$240/night',
            rating: '4.8',
          },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: PRODUCT_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['hero', 'head', 'content', 'foot'] },
          {
            id: 'hero', component: 'Image', src: { path: '/listing/photo' },
            alt: 'Ocean View Suite, balcony over the bay at sunset', aspect: '16/9', usageHint: 'hero',
          },
          { id: 'head', component: 'CardHeader', format: 'structured', children: ['head_title', 'head_badge'] },
          { id: 'head_title', component: 'Text', variant: 'label', text: { path: '/listing/title' } },
          { id: 'head_badge', component: 'Badge', label: { path: '/listing/badge' }, intent: 'info', slot: 'trailing' },
          { id: 'content', component: 'CardContent', children: ['stats_row'] },
          { id: 'stats_row', component: 'Row', gap: 'lg', children: ['stat_price', 'stat_rating'] },
          { id: 'stat_price', component: 'Stat', label: 'Price', value: { path: '/listing/price' } },
          { id: 'stat_rating', component: 'Stat', label: 'Guest rating', value: { path: '/listing/rating' } },
          { id: 'foot', component: 'CardFooter', children: ['btn_book'] },
          { id: 'btn_book', component: 'Button', variant: 'solid', label: 'Book now', action: { action: 'book_listing' } },
        ],
      },
    },
  ],
}

const OPTIONS_ID = 'product-options-quantity'
/** variant-picker + quantity, composed: a size SegmentedControl (3 short labels — S/M/L, the
 *  booking-reservation room-type precedent, catalog-coverage.ts:135-141) and a Field-wrapped
 *  `type:'number'` quantity TextField, gated by one FormProvider (both required, add-to-cart blocked
 *  until a size is chosen), ending in the Add-to-cart commit Button. */
export const productOptionsQuantitySeed: ExampleSeed = {
  name: 'product-options-quantity',
  description:
    'A product detail add-to-cart card — a size SegmentedControl and a quantity number TextField, both Field-wrapped and gated by one FormProvider, with an Add-to-cart Button.',
  promptText: 'Show this sneaker with a size picker (S, M, L), a quantity field, and an add-to-cart button.',
  surfaceId: OPTIONS_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: OPTIONS_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: OPTIONS_ID,
        value: { product: { name: 'Trail Runner Sneaker', size: '', qty: '1' } },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: OPTIONS_ID,
        components: [
          // The FormProvider is the ROOT — the submit Button's actual DOM ancestor (the renderer resolves
          // submit gating via closest(); a FormProvider nested beside the CardFooter never gates it — the
          // generative-form.ts:24-28 / booking-reservation repair shape, re-hit here on first judging).
          { id: 'root', component: 'FormProvider', children: ['card'] },
          { id: 'card', component: 'Card', elevation: '1', children: ['head', 'content', 'foot'] },
          { id: 'head', component: 'CardHeader', children: ['title'] },
          { id: 'title', component: 'Text', variant: 'h4', text: { path: '/product/name' } },
          { id: 'content', component: 'CardContent', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'md', children: ['f_size', 'f_qty'] },
          { id: 'f_size', component: 'Field', label: 'Size', child: 'seg_size' },
          {
            id: 'seg_size', component: 'SegmentedControl', name: 'size', required: true,
            value: { path: '/product/size' }, children: ['seg_s', 'seg_m', 'seg_l'],
          },
          { id: 'seg_s', component: 'Segment', value: 's', label: 'S' },
          { id: 'seg_m', component: 'Segment', value: 'm', label: 'M' },
          { id: 'seg_l', component: 'Segment', value: 'l', label: 'L' },
          { id: 'f_qty', component: 'Field', label: 'Quantity', child: 'qty_field' },
          {
            id: 'qty_field', component: 'TextField', name: 'qty', type: 'number', min: '1', step: 1, required: true,
            value: { path: '/product/qty' },
          },
          { id: 'foot', component: 'CardFooter', children: ['btn_add'] },
          {
            id: 'btn_add', component: 'Button', variant: 'solid', label: 'Add to cart',
            action: { action: 'add_to_cart', submit: true },
          },
        ],
      },
    },
  ],
}

const GALLERY_ID = 'listing-photo-grid'
/** media-grid: a Grid of bare Image tiles templated over `/listing/photos` (the Grid-of-tile templating
 *  idiom, comparison-pricing-table/media-file-grid's precedent, applied to photos instead of Stat tiles
 *  or Attachment files). Every tile IS a photo to browse — `usageHint:'thumb'`, one shared `aspect`,
 *  `fit:'cover'`, `alt` bound per item — never an Attachment (that idiom is for heterogeneous FILES,
 *  high-frequency-patterns.ts's media-file-grid seed). */
export const listingPhotoGridSeed: ExampleSeed = {
  name: 'listing-photo-grid',
  description: 'A listing photo gallery — a Grid of bare Image tiles templated over the data model, every tile a photo (never a file Attachment).',
  promptText: 'Show the photos for this listing: the lobby, the pool deck, a suite bedroom, and the bay view.',
  surfaceId: GALLERY_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: GALLERY_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: GALLERY_ID,
        value: {
          listing: {
            photos: [
              { url: '/photos/lobby.jpg', caption: 'Lobby' },
              { url: '/photos/pool.jpg', caption: 'Pool deck' },
              { url: '/photos/suite.jpg', caption: 'Suite bedroom' },
              { url: '/photos/view.jpg', caption: 'Bay view' },
            ],
          },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: GALLERY_ID,
        components: [
          { id: 'root', component: 'Grid', gap: 'md', min: '10rem', children: { path: '/listing/photos', componentId: 'photo_tile' } },
          {
            id: 'photo_tile', component: 'Image', src: { path: 'url' }, alt: { path: 'caption' },
            aspect: '1/1', usageHint: 'thumb', fit: 'cover',
          },
        ],
      },
    },
  ],
}

/** Every seed this module defines — the barrel's family-array precedent (index.ts derives `allSeeds`
 *  length from these, never a hand-counted literal). */
export const commerceHospitalitySeeds: readonly ExampleSeed[] = [
  commerceProductCardSeed,
  productOptionsQuantitySeed,
  listingPhotoGridSeed,
]
