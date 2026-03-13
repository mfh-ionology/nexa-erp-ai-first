# Visual Design Foundation

## Colour System

**Primary Palette — Purple Theme (from prototypes D/E/F):**

| Token | Hex | Usage | Contrast Ratio (on white) |
|-------|-----|-------|--------------------------|
| `primary` | `#7c3aed` | Buttons, links, active states, AI indicators | 4.63:1 (AA pass) |
| `primary-light` | `#a78bfa` | Hover states, secondary accents, backgrounds | 3.01:1 (decorative only) |
| `primary-dark` | `#5b21b6` | Pressed states, active navigation | 7.35:1 (AAA pass) |
| `primary-50` | `#f4f2ff` | Page background, subtle tint | N/A (background) |
| `primary-100` | `#ede9fe` | Card hover, selected row highlight | N/A (background) |

**Neutral Palette:**

| Token | Hex | Usage |
|-------|-----|-------|
| `surface` | `#ffffff` | Cards, panels, form backgrounds |
| `text-primary` | `#1e1b4b` | Headings, primary body text |
| `text-secondary` | `#6b7280` | Labels, placeholders, muted text |
| `text-tertiary` | `#9ca3af` | Disabled text, timestamps |
| `border` | `#e5e7eb` | Card borders, dividers, input borders |
| `border-focus` | `#7c3aed` | Focused input borders (matches primary) |

**Semantic Status Palette (9 categories):**

| Category | Token | Hex | Icon | Usage Examples |
|----------|-------|-----|------|---------------|
| Initial | `status-initial` | `#6b7280` | Circle outline | Draft, New, Pending |
| InProgress | `status-in-progress` | `#3b82f6` | Spinner/arrows | Processing, Open, Active |
| AwaitingAction | `status-awaiting` | `#f59e0b` | Clock/hand | Pending Approval, On Hold |
| Success | `status-success` | `#10b981` | Checkmark | Approved, Paid, Completed, Delivered |
| Partial | `status-partial` | `#8b5cf6` | Half-circle | Partially Paid, Partially Delivered |
| Cancelled | `status-cancelled` | `#6b7280` | X-circle (dashed) | Cancelled, Voided, Withdrawn |
| Error | `status-error` | `#ef4444` | X-circle (solid) | Failed, Rejected, Bounced |
| Warning | `status-warning` | `#f59e0b` | Triangle-alert | Overdue, At Risk, Expiring |
| Terminal | `status-terminal` | `#1f2937` | Lock | Closed, Archived, Final |

**AI Confidence Palette:**

| Level | Token | Hex | Background | Usage |
|-------|-------|-----|-----------|-------|
| High (>=90%) | `confidence-high` | `#10b981` | `#ecfdf5` | Auto-suggested, minimal review |
| Medium (70–89%) | `confidence-medium` | `#f59e0b` | `#fffbeb` | Review recommended |
| Low (<70%) | `confidence-low` | `#ef4444` | `#fef2f2` | Manual entry needed |

## Typography System

**Font Stack:**

| Role | Font | Weight Range | Usage |
|------|------|-------------|-------|
| **Display** | Plus Jakarta Sans | 600–800 | Page titles, section headers, navigation items |
| **Body** | Inter | 400–600 | Body text, form labels, descriptions, table cells |
| **Mono** | JetBrains Mono | 400–500 | Invoice numbers, amounts (£4,250.00), codes, IDs |

**Tailwind CSS 4 Font Mapping:**

The v0 design system maps these fonts to Tailwind CSS 4 font family slots. Note that "Display" (Plus Jakarta Sans) is mapped to the `font-serif` slot — this is a Tailwind convention for the secondary font family, not a traditional serif font.

| Tailwind Class | CSS Variable | Actual Font | Spec Role |
|---|---|---|---|
| `font-sans` | `--font-sans` | Inter | Body |
| `font-serif` | `--font-serif` | Plus Jakarta Sans | Display (headings, navigation) |
| `font-mono` | `--font-mono` | JetBrains Mono | Mono (amounts, codes, IDs) |

Backward-compatibility aliases `--font-display` and `--font-body` are also defined in `globals.css`.

**Type Scale (based on 16px root):**

| Token | Size | Line Height | Weight | Usage |
|-------|------|------------|--------|-------|
| `text-2xl` | 30px / 1.875rem | 36px | 700 | Page titles ("Invoices", "The Briefing") |
| `text-xl` | 24px / 1.5rem | 32px | 600 | Section headers, card titles |
| `text-lg` | 20px / 1.25rem | 28px | 600 | Sub-section headers, entity names |
| `text-base` | 16px / 1rem | 24px | 400 | Body text, descriptions, table cells |
| `text-sm` | 14px / 0.875rem | 20px | 400 | Form labels, secondary text, metadata |
| `text-xs` | 12px / 0.75rem | 16px | 500 | Badges, timestamps, field hints |
| `text-mono-lg` | 18px / 1.125rem | 24px | 500 | Invoice totals, monetary amounts |
| `text-mono-sm` | 13px / 0.8125rem | 18px | 400 | Record IDs, reference numbers |

**Typography Rules:**
- Headings always use Plus Jakarta Sans with semibold (600) or bold (700) weight
- Body text uses Inter at regular (400) weight, with medium (500) for emphasis
- All monetary amounts use JetBrains Mono — numbers must align in tabular columns
- Line height minimum: 1.5x for body text (accessibility requirement)
- Maximum line length: 80ch for readability in description fields

## Spacing & Layout Foundation

**8px Grid System:**
All spacing derives from an 8px base unit. Components snap to the 8px grid for visual consistency.

| Token | Value | Usage |
|-------|-------|-------|
| `space-0.5` | 4px | Inline icon gaps, badge padding |
| `space-1` | 8px | Tight element gaps, input padding-x |
| `space-1.5` | 12px | Form field gaps, small card padding |
| `space-2` | 16px | Standard element gaps, card padding |
| `space-3` | 24px | Section gaps, card content padding |
| `space-4` | 32px | Major section gaps |
| `space-6` | 48px | Page section dividers |
| `space-8` | 64px | Major layout gaps |

**Layout Grid:**

| Breakpoint | Columns | Gutter | Margin | Max Content Width |
|-----------|---------|--------|--------|------------------|
| Phone (375px) | 4 | 16px | 16px | 100% |
| Tablet (768px) | 8 | 24px | 24px | 100% |
| Desktop (1024px) | 12 | 24px | 32px | 100% |
| Large (1280px) | 12 | 32px | 48px | 1440px |
| XL (1536px) | 12 | 32px | auto | 1440px |

**Layout Principles:**
1. **Header + Content** — Desktop uses full-width content area with mega-menu overlay (380px slide-from-left), favourites toolbar (40px), and module context bar (32px) above the content
2. **Card-based composition** — Content areas use card grids, not freeform layouts. Cards have consistent padding (20px), border-radius (12px / `rounded-xl`), and subtle border (`#e5e7eb`)
3. **Density control** — Default "comfortable" density (16px gaps between elements). Power users can switch to "compact" density (8px gaps) via user preferences
4. **Z-index layers** — Background (0) → Content (10) → Sticky headers (20) → Mega-menu overlay (30) → Dropdowns (40) → Modals (50) → Toasts (60) → Command palette (70)

## Shadow & Radius Tokens (Concept D)

These tokens are defined in `globals.css` and used consistently across all card and interactive elements:

**Shadow Tokens:**

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-card` | `0 1px 3px rgba(0,0,0,0.06)` | Default card resting shadow |
| `--shadow-card-hover` | `0 4px 12px rgba(124,58,237,0.1)` | Card hover shadow (purple-tinted) |
| `--shadow-dropdown` | `0 4px 12px rgba(0,0,0,0.1)` | Dropdown menus, popovers |

**Radius Tokens:**

| Token | Value | Tailwind Class | Usage |
|-------|-------|---------------|-------|
| `--radius-card` | `12px` / `0.75rem` | `rounded-xl` | Cards, panels, modals |
| `--radius-button` | `8px` / `0.5rem` | `rounded-lg` | Buttons, inputs, nav items |
| `--radius-input` | `6px` / `0.375rem` | `rounded-md` | Form inputs, selects |
| `--radius-badge` | `99px` | `rounded-full` | Badges, pills, status indicators |

## Accessibility Considerations

**WCAG 2.1 AA Compliance (Target):**

| Requirement | Standard | Nexa Implementation |
|-------------|----------|-------------------|
| Text contrast | 4.5:1 minimum | Primary purple (#7c3aed) on white = 4.63:1 ✓ |
| Large text contrast | 3:1 minimum | All heading combinations pass ✓ |
| Non-text contrast | 3:1 minimum | Status colours on their backgrounds all pass ✓ |
| Touch targets | 24x24px minimum (2.5.8) | 44x44px phone, 48x48px tablet (exceeds) ✓ |
| Focus indicators | 2px visible ring | Purple focus ring (#7c3aed) on all interactive elements ✓ |
| Keyboard navigation | All interactive elements reachable | Tab order follows visual order; skip links provided ✓ |
| Screen reader | Semantic HTML + ARIA | Radix primitives provide ARIA by default ✓ |
| Motion | Reduced motion respect | `prefers-reduced-motion` disables all animations ✓ |
| Colour alone | Never sole indicator | Status always shows icon + colour + text label ✓ |

**Colour Blindness Considerations:**
- Status colours are distinguishable under all common types (protanopia, deuteranopia, tritanopia) because each category also has a unique icon shape
- AI confidence uses green/amber/red BUT also shows dot shape (filled/half/empty) and text label
- Never rely on colour alone — always pair with icon, text, or pattern
