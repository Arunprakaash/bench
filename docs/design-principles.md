# Bench UI Design Principles

This document defines the default UX patterns for list pages, forms, and app layout in Bench.

## 1) Page Structure

- Use a consistent page shell:
  - title + subtitle
  - page-level actions on the right
  - error state banner below header
- Prefer `p-8 space-y-6` for top-level page spacing.
- Keep page sections visually grouped in bordered cards with consistent padding.

## 2) List-First Pattern

- For entities with CRUD, prefer:
  - list page (search/filter/table)
  - separate create page
  - separate edit page
- Avoid mixing large create forms and full data tables on the same page.

## 3) Tables and Pagination

- Use shared table primitives (`Table`, `TablePagination`) on all list screens.
- Use pagination to avoid long scrolling pages.
- Target pages should remain mostly within viewport height under typical data volume.
- Avoid unbounded lists and large in-card scroll regions where pagination can solve it.

## 4) Non-Scrollable-By-Default Experience

- Build pages to minimize vertical overflow:
  - compact cards
  - paginated sections
  - concise summaries over verbose blocks
- If content can exceed view height, add pagination/filtering first before adding extra scroll containers.

## 5) Forms

- Use dedicated create/edit pages for complex forms.
- Keep label/input spacing consistent (`space-y-2`) across fields.
- Place primary save/create actions in the page header right when appropriate.
- Keep destructive actions separate and clearly styled (`variant="destructive"`).

## 6) Notifications

- Notification UI should be generic and type-agnostic (not tightly coupled to one feature).
- Sidebar bell shows unread count (`9+` cap).
- Notification popover shows latest items only; full history/management belongs to `/notifications`.

## 7) Copy and Naming

- Use product name `Bench` consistently in UI and docs.
- Use concise, action-oriented labels (e.g., "Create Schedule", "Mark all as read").
- Favor domain terms users understand (`Scenario`, `Suite`, `Run`, `Alert`).

## 8) Accessibility and Feedback

- Every async action should have loading, empty, and error states.
- Keep focus styles and keyboard behavior consistent with existing shared components.
- Use visible confirmation for destructive bulk actions.
