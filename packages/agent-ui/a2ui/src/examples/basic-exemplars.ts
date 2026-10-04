// basic-exemplars.ts: the first seeds on the `allBasicSeeds` shelf (GH #1732), authored against the
// upstream A2UI Basic catalog registered locally as `a2ui-basic` (ADR-0169). Before this module the corpus
// held only agent-ui exemplars, so a producer targeting Basic had nothing to imitate.
//
// Each seed is ONE surface (ADR-0064) and uses only Basic catalog rows (`src/catalog/a2ui-basic/catalog.json`),
// in the Basic dialect, which differs from agent-ui in ways a producer must copy exactly:
//   - a Button carries its label as a `child` Text node and its action as `{ event: { name, context } }`;
//   - every input labels itself (`label` on TextField / CheckBox / ChoicePicker / Slider / DateTimeInput),
//     there is no Field wrapper;
//   - ChoicePicker `value` is a string ARRAY even when `mutuallyExclusive`;
//   - computed text is a `{ call, args, returnType }` function call (`formatString`, `formatCurrency`,
//     `formatNumber`, `pluralize`), the upstream `product-card` fixture's shape;
//   - `createSurface.catalogId` is the LOCAL short id `a2ui-basic`, never the upstream URL (ADR-0169 cl.13).
// The four seeds span a form, a templated result list, a settings panel, and a booking flow, so together
// they exercise all 14 Basic rows except `Card` (which wraps one child and has no header/footer slots).

import type { ExampleSeed } from './types.ts'

const CONTACT_SID = 'contact-form'

/** A support contact form: self-labelled TextFields, a chips ChoicePicker, a CheckBox, one submit Button. */
export const basicContactFormSeed: ExampleSeed<'a2ui-basic'> = {
  name: 'basic-contact-support-form',
  description:
    'A support contact form on the Basic catalog: an h2 title and body intro, self-labelled TextFields for ' +
    'name and email (shortText, the email one with a validationRegexp) and the message (longText), a ' +
    'mutuallyExclusive chips ChoicePicker for the topic bound to a string-array value, a CheckBox for "email ' +
    'me a copy", and a right-aligned primary Button whose child Text is the label and whose ' +
    'submit_contact_request event carries every bound field in its context.',
  promptText:
    'Build a contact support form: name, email, a topic picker (general question, billing, technical issue), ' +
    'a message box, an option to get a copy by email, and a Send button.',
  surfaceId: CONTACT_SID,
  protocolVersion: 'v1.0',
  catalogId: 'a2ui-basic',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: CONTACT_SID, catalogId: 'a2ui-basic', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: CONTACT_SID,
        value: { contact: { name: '', email: '', topic: ['general'], message: '', sendCopy: true } },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: CONTACT_SID,
        components: [
          {
            id: 'root',
            component: 'Column',
            justify: 'start',
            align: 'stretch',
            children: ['title', 'intro', 'name_field', 'email_field', 'topic_picker', 'message_field', 'copy_check', 'actions'],
          },
          { id: 'title', component: 'Text', text: 'Contact support', variant: 'h2' },
          {
            id: 'intro',
            component: 'Text',
            text: 'Tell us what you need and we will reply by email within one business day.',
            variant: 'body',
          },
          { id: 'name_field', component: 'TextField', label: 'Full name', value: { path: '/contact/name' }, variant: 'shortText' },
          {
            id: 'email_field',
            component: 'TextField',
            label: 'Email address',
            value: { path: '/contact/email' },
            variant: 'shortText',
            validationRegexp: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$',
          },
          {
            id: 'topic_picker',
            component: 'ChoicePicker',
            label: 'Topic',
            variant: 'mutuallyExclusive',
            displayStyle: 'chips',
            options: [
              { label: 'General question', value: 'general' },
              { label: 'Billing', value: 'billing' },
              { label: 'Technical issue', value: 'technical' },
            ],
            value: { path: '/contact/topic' },
          },
          { id: 'message_field', component: 'TextField', label: 'Message', value: { path: '/contact/message' }, variant: 'longText' },
          { id: 'copy_check', component: 'CheckBox', label: 'Email me a copy of this message', value: { path: '/contact/sendCopy' } },
          { id: 'actions', component: 'Row', justify: 'end', align: 'center', children: ['send_button'] },
          { id: 'send_label', component: 'Text', text: 'Send message' },
          {
            id: 'send_button',
            component: 'Button',
            variant: 'primary',
            child: 'send_label',
            action: {
              event: {
                name: 'submit_contact_request',
                context: {
                  name: { path: '/contact/name' },
                  email: { path: '/contact/email' },
                  topic: { path: '/contact/topic' },
                  message: { path: '/contact/message' },
                  sendCopy: { path: '/contact/sendCopy' },
                },
              },
            },
          },
        ],
      },
    },
  ],
}

const PRODUCTS_SID = 'product-list'

/** A product result list: one List template row per product, relative item binds, function-call text. */
export const basicProductListSeed: ExampleSeed<'a2ui-basic'> = {
  name: 'basic-product-results-list',
  description:
    'A shopping result list on the Basic catalog: an h2 heading built with formatString from /query, a ' +
    'caption count built from formatNumber + pluralize over /resultCount, and a vertical List whose children ' +
    'are a { path: "/products", componentId } template; each templated Row binds RELATIVE item paths (an ' +
    'Image url + description, an h4 name, a formatCurrency USD price) and ends in an "Add to cart" Button ' +
    'whose add_to_cart event context carries the item sku and name.',
  promptText:
    'Show my search results for trail running shoes as a list with a photo, name and price for each, and ' +
    'an Add to cart button on every row.',
  surfaceId: PRODUCTS_SID,
  protocolVersion: 'v1.0',
  catalogId: 'a2ui-basic',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: PRODUCTS_SID, catalogId: 'a2ui-basic', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: PRODUCTS_SID,
        value: {
          query: 'trail running shoes',
          resultCount: 3,
          products: [
            { sku: 'TR-2041', name: 'Ridgeline Trail 4', price: 139.95, imageUrl: 'https://images.example.com/shoes/ridgeline-trail-4.jpg' },
            { sku: 'TR-1877', name: 'Summit Grip GTX', price: 164.5, imageUrl: 'https://images.example.com/shoes/summit-grip-gtx.jpg' },
            { sku: 'TR-1502', name: 'Canyon Lite', price: 98, imageUrl: 'https://images.example.com/shoes/canyon-lite.jpg' },
          ],
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: PRODUCTS_SID,
        components: [
          { id: 'root', component: 'Column', align: 'stretch', children: ['heading', 'result_count', 'product_list'] },
          {
            id: 'heading',
            component: 'Text',
            text: { call: 'formatString', args: { value: 'Results for "${/query}"' }, returnType: 'string' },
            variant: 'h2',
          },
          {
            id: 'result_count',
            component: 'Text',
            text: {
              call: 'formatString',
              args: {
                value: "${formatNumber(value: ${/resultCount})} ${pluralize(value: ${/resultCount}, one: 'product', other: 'products')}",
              },
              returnType: 'string',
            },
            variant: 'caption',
          },
          {
            id: 'product_list',
            component: 'List',
            direction: 'vertical',
            align: 'stretch',
            children: { path: '/products', componentId: 'product_row' },
          },
          {
            id: 'product_row',
            component: 'Row',
            justify: 'spaceBetween',
            align: 'center',
            children: ['product_image', 'product_info', 'add_button'],
          },
          {
            id: 'product_image',
            component: 'Image',
            url: { path: 'imageUrl' },
            description: { path: 'name' },
            fit: 'cover',
            variant: 'smallFeature',
          },
          { id: 'product_info', component: 'Column', weight: 1, children: ['product_name', 'product_price'] },
          { id: 'product_name', component: 'Text', text: { path: 'name' }, variant: 'h4' },
          {
            id: 'product_price',
            component: 'Text',
            text: { call: 'formatCurrency', args: { value: { path: 'price' }, currency: 'USD' }, returnType: 'string' },
            variant: 'body',
          },
          { id: 'add_label', component: 'Text', text: 'Add to cart' },
          {
            id: 'add_button',
            component: 'Button',
            variant: 'default',
            child: 'add_label',
            action: { event: { name: 'add_to_cart', context: { sku: { path: 'sku' }, name: { path: 'name' } } } },
          },
        ],
      },
    },
  ],
}

const NOTIFY_SID = 'notification-settings'

/** A notification settings panel: CheckBox channels, a chips digest picker, a Slider, a two-button action row. */
export const basicNotificationSettingsSeed: ExampleSeed<'a2ui-basic'> = {
  name: 'basic-notification-settings',
  description:
    'A notification preferences panel on the Basic catalog: a header Row pairing a notifications Icon with an ' +
    'h2 title, an h4 subheading over three self-labelled CheckBoxes (email, push, SMS) bound to booleans, a ' +
    'horizontal Divider, a mutuallyExclusive chips ChoicePicker for the digest cadence, a 0 to 100 Slider for ' +
    'alert volume, and a right-aligned action Row with a borderless "Restore defaults" Button beside a primary ' +
    '"Save preferences" Button whose event context carries the whole /prefs object.',
  promptText:
    'Let me manage my notification settings: turn email, push and SMS alerts on or off, pick a daily or ' +
    'weekly digest, set the alert volume, and save or restore the defaults.',
  surfaceId: NOTIFY_SID,
  protocolVersion: 'v1.0',
  catalogId: 'a2ui-basic',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: NOTIFY_SID, catalogId: 'a2ui-basic', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: NOTIFY_SID,
        value: { prefs: { email: true, push: true, sms: false, digest: ['daily'], alertVolume: 60 } },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: NOTIFY_SID,
        components: [
          {
            id: 'root',
            component: 'Column',
            align: 'stretch',
            children: ['header', 'channels_heading', 'email_check', 'push_check', 'sms_check', 'divider', 'digest_picker', 'volume_slider', 'actions'],
          },
          { id: 'header', component: 'Row', align: 'center', children: ['header_icon', 'title'] },
          { id: 'header_icon', component: 'Icon', name: 'notifications' },
          { id: 'title', component: 'Text', text: 'Notification settings', variant: 'h2' },
          { id: 'channels_heading', component: 'Text', text: 'Where should we reach you?', variant: 'h4' },
          { id: 'email_check', component: 'CheckBox', label: 'Email', value: { path: '/prefs/email' } },
          { id: 'push_check', component: 'CheckBox', label: 'Push notifications', value: { path: '/prefs/push' } },
          { id: 'sms_check', component: 'CheckBox', label: 'Text messages (SMS)', value: { path: '/prefs/sms' } },
          { id: 'divider', component: 'Divider', axis: 'horizontal' },
          {
            id: 'digest_picker',
            component: 'ChoicePicker',
            label: 'Activity digest',
            variant: 'mutuallyExclusive',
            displayStyle: 'chips',
            options: [
              { label: 'Off', value: 'off' },
              { label: 'Daily', value: 'daily' },
              { label: 'Weekly', value: 'weekly' },
            ],
            value: { path: '/prefs/digest' },
          },
          { id: 'volume_slider', component: 'Slider', label: 'Alert volume', min: 0, max: 100, value: { path: '/prefs/alertVolume' } },
          { id: 'actions', component: 'Row', justify: 'end', align: 'center', children: ['reset_button', 'save_button'] },
          { id: 'reset_label', component: 'Text', text: 'Restore defaults' },
          {
            id: 'reset_button',
            component: 'Button',
            variant: 'borderless',
            child: 'reset_label',
            action: { event: { name: 'reset_notification_defaults' } },
          },
          { id: 'save_label', component: 'Text', text: 'Save preferences' },
          {
            id: 'save_button',
            component: 'Button',
            variant: 'primary',
            child: 'save_label',
            action: { event: { name: 'save_notification_preferences', context: { prefs: { path: '/prefs' } } } },
          },
        ],
      },
    },
  ],
}

const BOOKING_SID = 'appointment-booking'

/** An appointment request: a chips service picker, a bounded DateTimeInput, an optional notes field. */
export const basicAppointmentBookingSeed: ExampleSeed<'a2ui-basic'> = {
  name: 'basic-appointment-booking',
  description:
    'An appointment booking form on the Basic catalog: a header Row pairing a calendarToday Icon with an h2 ' +
    'title, a caption naming the shop, a mutuallyExclusive chips ChoicePicker for the service, one ' +
    'DateTimeInput with enableDate and enableTime whose value, min and max all bind ISO date-time strings in ' +
    'the model, an optional longText TextField for notes, and a right-aligned primary "Request appointment" ' +
    'Button whose request_appointment event context carries the service, slot and notes.',
  promptText:
    'I want to book a haircut at Northside Barbers. Let me choose the service, pick a date and time, add a ' +
    'note for the barber, and send the request.',
  surfaceId: BOOKING_SID,
  protocolVersion: 'v1.0',
  catalogId: 'a2ui-basic',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: BOOKING_SID, catalogId: 'a2ui-basic', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: BOOKING_SID,
        value: {
          booking: { service: ['cut'], when: '2026-10-07T14:30', earliest: '2026-10-05T09:00', latest: '2026-11-30T18:00', notes: '' },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: BOOKING_SID,
        components: [
          {
            id: 'root',
            component: 'Column',
            align: 'stretch',
            children: ['header', 'subtitle', 'service_picker', 'when_input', 'notes_field', 'actions'],
          },
          { id: 'header', component: 'Row', align: 'center', children: ['header_icon', 'title'] },
          { id: 'header_icon', component: 'Icon', name: 'calendarToday' },
          { id: 'title', component: 'Text', text: 'Book an appointment', variant: 'h2' },
          { id: 'subtitle', component: 'Text', text: 'Northside Barbers, 214 Elm Street', variant: 'caption' },
          {
            id: 'service_picker',
            component: 'ChoicePicker',
            label: 'Service',
            variant: 'mutuallyExclusive',
            displayStyle: 'chips',
            options: [
              { label: 'Haircut (30 min)', value: 'cut' },
              { label: 'Cut and beard trim (45 min)', value: 'cut-beard' },
              { label: 'Beard trim (15 min)', value: 'beard' },
            ],
            value: { path: '/booking/service' },
          },
          {
            id: 'when_input',
            component: 'DateTimeInput',
            label: 'Date and time',
            enableDate: true,
            enableTime: true,
            value: { path: '/booking/when' },
            min: { path: '/booking/earliest' },
            max: { path: '/booking/latest' },
          },
          {
            id: 'notes_field',
            component: 'TextField',
            label: 'Notes for your barber (optional)',
            value: { path: '/booking/notes' },
            variant: 'longText',
          },
          { id: 'actions', component: 'Row', justify: 'end', align: 'center', children: ['book_button'] },
          { id: 'book_label', component: 'Text', text: 'Request appointment' },
          {
            id: 'book_button',
            component: 'Button',
            variant: 'primary',
            child: 'book_label',
            action: {
              event: {
                name: 'request_appointment',
                context: { service: { path: '/booking/service' }, when: { path: '/booking/when' }, notes: { path: '/booking/notes' } },
              },
            },
          },
        ],
      },
    },
  ],
}

/** Every seed this module defines (the family-array precedent: `allBasicSeeds` spreads it, never a
 *  hand-counted literal). */
export const basicExemplarSeeds: readonly ExampleSeed<'a2ui-basic'>[] = [
  basicContactFormSeed,
  basicProductListSeed,
  basicNotificationSettingsSeed,
  basicAppointmentBookingSeed,
]
