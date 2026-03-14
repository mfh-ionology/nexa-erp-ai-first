# Responsive Design & Accessibility

## Responsive Strategy

**Desktop (1024px+) — Full Experience:**
- Mega-menu navigation: 380px slide-from-left overlay with drill-down accordion, triggered by hamburger button in header
- Favourites toolbar: 40px horizontal bar with pinned page shortcuts (overflow chevron for excess items)
- Module context bar: 32px bar auto-detected from URL, showing Pages/Settings/Reports pills
- Split panels: side-by-side views for Document Viewer, related entity preview
- Multi-column layouts: 2-3 column card grids for dashboards and briefings
- Keyboard shortcuts fully active: Cmd+K (AI), Cmd+N (new), Cmd+S (save)
- Data tables: full columns visible, horizontal scroll for wide tables
- Density toggle: "Comfortable" (default) or "Compact" mode

**Tablet (768–1023px) — Touch-Optimised:**
- Mega-menu: same as desktop, touch-optimised with 48px minimum tap targets on menu items
- Favourites toolbar and module context bar: same as desktop
- Touch targets: 48x48px minimum for all interactive elements
- Forms: single-column layout (header fields stack vertically)
- Tables: priority columns visible, horizontal scroll for secondary columns
- Barcode scanning: camera integration for Marcus's warehouse workflow
- Split panels: stacked vertically (document on top, form below) rather than side-by-side

**Phone (375–767px) — Briefing-First:**
- Mobile navigation per user preference (`mobileNavStyle` on User model):
  - CLASSIC_TABS (default): 5-tab bottom bar (Briefing, Modules, AI, Notifications, Profile)
  - MINIMAL: Floating action button + gesture navigation
  - MY_SHORTCUTS: Bottom bar shows user's pinned favourite pages
- Briefing as home screen: full-width cards, swipe to dismiss completed items
- Forms: full-width single-column, sticky "Approve" button at bottom
- Tables: card layout (each row becomes a card with key fields)
- AI input: full-width text area, voice input button
- Modals: full-screen sheets sliding up from bottom
- No mega-menu — module navigation via bottom nav, Modules tab, or AI command

## Breakpoint Behaviour Matrix

| Component | Phone (375px) | Tablet (768px) | Desktop (1024px) |
|-----------|--------------|----------------|-----------------|
| Navigation | Per-user preference (CLASSIC_TABS / MINIMAL / MY_SHORTCUTS) | Mega-menu + favourites toolbar + context bar | Mega-menu + favourites toolbar + context bar |
| Briefing | Stacked cards, swipeable | 2-column cards | 3-column cards |
| Entity List | Card layout per row | Table with priority columns | Full table |
| Form | Single column, stacked | Single column, wider | Multi-column tabs |
| Document Viewer | Stacked (doc → form) | Stacked (doc → form) | Side-by-side |
| EventFlowTracker | Vertical steps | Horizontal, scrollable | Horizontal, full |
| Dialogs | Full-screen sheet | Centered modal | Centered modal |
| Buttons | Full-width | Auto-width | Auto-width |

## Accessibility Strategy

**Target: WCAG 2.1 Level AA**

**Keyboard Navigation:**
- All interactive elements reachable via Tab key
- Tab order follows visual reading order (left-to-right, top-to-bottom)
- Skip links: "Skip to content" and "Skip to navigation" at page top
- Focus trap in modals and dialogs (Tab cycles within modal)
- Escape key closes modals, popovers, and command palette
- Arrow keys navigate within: tabs, dropdown menus, table rows, calendar
- Enter/Space activates focused element

**Screen Reader Support:**
- Semantic HTML: `<nav>`, `<main>`, `<header>`, `<footer>`, `<section>`, `<article>`
- ARIA landmarks: `role="banner"`, `role="navigation"`, `role="main"`, `role="complementary"`
- ARIA live regions: toast notifications (`aria-live="polite"`), AI streaming responses (`aria-live="assertive"`)
- All images have `alt` text; decorative images use `alt=""`
- Form fields have associated `<label>` elements (Radix handles this)
- Status badges announce: "Invoice status: Awaiting Approval" (not just colour)
- Tables use `<th scope="col">` and `<th scope="row">`

**Motion & Animation:**
- All animations respect `prefers-reduced-motion` media query
- When reduced motion is preferred: instant state changes (no transitions), static icons (no pulse/spin), progress bars update in steps (not smooth)
- Default animation durations: micro-interactions 150–200ms, state transitions 300–400ms, page transitions 200ms
- No auto-playing animations that can't be paused

**Colour & Contrast:**
- All text meets 4.5:1 contrast ratio against its background
- Large text (>=18px or >=14px bold) meets 3:1 minimum
- Interactive element boundaries meet 3:1 against adjacent colours
- Status is never communicated by colour alone — always icon + colour + text label
- Focus indicators: 2px purple ring, clearly visible on all backgrounds
- High contrast mode: respects `forced-colors` media query

## Testing Strategy

**Automated Testing:**
- `eslint-plugin-jsx-a11y` in CI pipeline — blocks builds on accessibility violations
- Axe-core integration in component tests — every component tested for ARIA compliance
- Lighthouse accessibility audit on every deploy — target score >=90

**Manual Testing Checklist (per release):**
- Keyboard-only navigation through all critical journeys (no mouse)
- VoiceOver (macOS/iOS) screen reader testing on key flows
- NVDA (Windows) screen reader testing on key flows
- Colour blindness simulation (protanopia, deuteranopia) on all status displays
- Zoom to 200% — all content readable, no horizontal scroll on text
- Phone testing on actual devices (iPhone SE, Samsung Galaxy) not just browser emulation

## Implementation Guidelines

**For Developers:**

1. **Use semantic HTML first** — `<button>` not `<div onClick>`, `<a href>` not `<span onClick>`
2. **Radix primitives handle ARIA** — don't add redundant ARIA attributes to Shadcn components
3. **Test with keyboard** — every PR must pass keyboard navigation for changed components
4. **Use `rem` not `px`** — except for borders and shadows. This ensures user font-size preferences are respected
5. **Mobile-first media queries** — write styles for phone, then add complexity at larger breakpoints via Tailwind prefixes
6. **Image optimisation** — use `next/image` patterns (lazy loading, responsive sizes, WebP format)
7. **Touch target sizing** — minimum 44x44px tap area even if visual element is smaller (use padding)
8. **Focus management** — when opening a modal, focus first interactive element; when closing, return focus to trigger
