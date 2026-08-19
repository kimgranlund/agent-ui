---
id: table-toolbar-pagination
triggers: table toolbar pagination search filter sort page rows columns data grid records browse results
catalogId: agent-ui
---
Table + Toolbar + Pagination interplay. Table owns `search`/`sort`/`filter`/`page`/`pageSize` as its OWN bindable props — never hand-filter `rows` into a smaller array. Setting `page`+`pageSize` makes Table paint its OWN internal pager already — never add a separate Pagination node bound to that same table's page (a redundant second pager). Map: a Toolbar above hosts a TextField bound to the SAME path as Table.search, plus filter controls — pure chrome, it owns no state of its own. Pagination is for windowing something OTHER than a Table (a List, a card grid): bind `page` only — `pages`/`label` are plain, not bindable. Wall: none — fully hosted.
