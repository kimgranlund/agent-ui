---
id: form-rhythm
triggers: form signup sign-up register fields survey checkout questionnaire fieldset validation labels
---
Any FormProvider form's vertical rhythm. FormProvider declares zero layout (page-author-owns-layout) — its fields render crashed together unless wrapped. Map: FormProvider › Column gap='md' (the house rhythm) › one Field per control, each wrapping a TextField/Select/Switch/Checkbox; the submit Button rides inside the FormProvider, after the fields, gated by the form's validity. Wall: none — fully hosted.
