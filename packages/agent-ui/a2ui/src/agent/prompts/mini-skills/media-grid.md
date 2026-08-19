---
id: media-grid
triggers: photo photos gallery images picture pictures album grid pics snapshots
catalogId: agent-ui
---
A photo/image gallery — ALL tiles are genuinely images meant to be viewed, not files. Grid(gap, min sizing the track) with `children` a `{path,componentId}` template over the photo list; each tile is a bare Image (`usageHint:'thumb'`, `fit:'cover'`, one shared `aspect`, `alt` bound per item). Distinct from media-file-grid's Attachment-tile idiom: reach for THIS when every item is a photo to browse (a listing's photo set); reach for Attachment tiles when files are heterogeneous (images+PDF+video) and need type-aware chrome (name/size/icon) — burying a real photo behind Attachment's file icon loses the photo. For a one-at-a-time paged sequence instead of a grid, use the Swiper/SwiperItem slideshow idiom, not Grid.
