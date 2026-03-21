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
- Related data sections on the same page (e.g. schedules + alerts) should each use independent pagination state.
- Horizontal table scrolling is allowed when columns are information-dense.
  - Prefer preserving key columns/labels over forcing aggressive truncation.
  - Use the shared table container behavior for consistent horizontal scroll UX.

## 4) Non-Scrollable-By-Default Experience

- Build pages to minimize vertical overflow:
  - compact cards
  - paginated sections
  - concise summaries over verbose blocks
- If content can exceed view height, add pagination/filtering first before adding extra scroll containers.

## 5) Filters and Controls

- Filter rows must use clear, explicit labels in triggers (avoid ambiguous values like `all` without context).
  - Prefer `Status: All`, `Created by: All`, etc.
- Keep adjacent filter controls visually uniform:
  - matching widths where practical
  - consistent horizontal spacing and icon anchoring
- Date controls must follow the same visual rhythm as Select controls:
  - right-aligned icon inside field
  - icon placement aligned to select chevrons
  - avoid hidden/native click targets that conflict with custom icon trigger
- Provide a `Clear filters` affordance on complex list pages.
- If a new filter is introduced, show the corresponding data in table columns where applicable
  (for example, `Created by` filter should have a visible `Created By` column).
- Use full date-time values (not date-only) for operational/run-style tables unless there is a clear reason not to.

## 6) Forms

- Use dedicated create/edit pages for complex forms.
- Keep label/input spacing consistent (`space-y-2`) across fields.
- Place primary save/create actions in the page header right when appropriate.
- Keep destructive actions separate and clearly styled (`variant="destructive"`).

## 7) Notifications

- Notification UI should be generic and type-agnostic (not tightly coupled to one feature).
- Sidebar bell shows unread count (`9+` cap).
- Notification popover shows latest items only (quick actions); full history/management belongs to `/notifications`.
- Include `View all` and `Mark all as read` actions for multi-notification workflows.

## 8) Copy and Naming

- Use product name `Bench` consistently in UI and docs.
- Use concise, action-oriented labels (e.g., "Create Schedule", "Mark all as read").
- Favor domain terms users understand (`Scenario`, `Suite`, `Run`, `Alert`).

## 9) Accessibility and Feedback

- Every async action should have loading, empty, and error states.
- Keep focus styles and keyboard behavior consistent with existing shared components.
- Use visible confirmation for destructive bulk actions.

## 10) Contextual Implementation Completeness

- Do not ship isolated UI changes when the feature implies related updates.
- For list/filter enhancements, implement full parity contextually:
  - filter controls
  - matching table columns/visible data
  - date + time formatting consistency across similar pages
- For API response shape changes, always update:
  - frontend types and usage
  - API documentation examples in Postman collection
- Validate end-to-end behavior (frontend + backend) before considering work complete.
