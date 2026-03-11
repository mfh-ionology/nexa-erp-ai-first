# Visual Checkpoint Manifest — Journey 19: Concept D Visual Fidelity

## CP-1: Page Layout & Concept D Background
- **When**: After navigating to /settings/document-templates and page fully loads
- **Screenshot file**: step-1-page-layout-concept-d-background.png
- **What to look for**:
  - Page background is #f4f2ff (light purple), NOT white or grey
  - Sidebar has purple active item highlight (purple bg + white text)
  - Header is 56px height with purple "N" logo mark
  - Centered search in header area

## CP-2: Primary Button Styling
- **When**: After verifying Add Template button computed styles
- **Screenshot file**: step-2-add-template-button-styling.png
- **What to look for**:
  - "Add Template" button background is #7c3aed (violet-600) → rgb(124, 58, 237)
  - White text on the button
  - 8px border-radius (rounded-lg)
  - Button looks distinctly purple, not generic blue/grey

## CP-3: Template Card Design Tokens
- **When**: After verifying card computed styles
- **Screenshot file**: step-3-template-card-styling.png
- **What to look for**:
  - Cards have 12px border-radius (rounded-xl)
  - Subtle shadow (shadow-sm) on cards
  - White card background against the light purple page background
  - Plus Jakarta Sans for card headings
  - Inter for body text
  - Version counts in monospace/tabular-nums (JetBrains Mono)

## CP-4: Badge Styling Verification
- **When**: After verifying Active/Default badge computed styles
- **Screenshot file**: step-4-badge-styling.png
- **What to look for**:
  - Green "Active" badge with green background tint
  - Purple "Default" badge with violet background tint (#ede9fe)
  - Badges are pill-shaped (rounded-full)
  - Consistent padding and small text

## CP-5: Editor Form Design Tokens
- **When**: After clicking "Add Template" button and editor form opens
- **Screenshot file**: step-5-editor-form-styling.png
- **What to look for**:
  - Plus Jakarta Sans for form headings
  - Form inputs with proper border styling
  - Focus states use purple focus ring
  - Toggle switches with purple active colour
  - HTML Template textarea uses monospace font (JetBrains Mono)
  - Textarea has adequate height (min ~400px) and 1.5 line-height
  - Collapsible sections present
