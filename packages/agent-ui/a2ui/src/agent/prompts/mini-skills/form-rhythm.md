---
id: form-rhythm
triggers: form signup sign-up register fields survey checkout questionnaire fieldset validation labels
catalogId: agent-ui
---
Any FormProvider form's vertical rhythm. FormProvider declares zero layout (page-author-owns-layout) — its fields render crashed together unless wrapped. Map: FormProvider › Column gap='md' (the house rhythm) › one Field per control, each wrapping a TextField/Select/Switch/Checkbox; the submit Button rides inside the FormProvider, after the fields, gated by the form's validity. Visible labels come from Field, never from a bare control: TextField/Select/ComboBox/MultiSelect/Slider never paint an on-screen label from their own label prop (aria-only or absent, ADR-0051) — set label on the wrapping Field instead. Checkbox/Switch's own label IS already visible (slotted text). Wall: none — fully hosted.
