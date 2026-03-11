# Journey 15: Suggested Knowledge — Accept Platform Suggestion

## Visual Checkpoints

### Checkpoint 1: Suggested Tab Loaded
- **When**: After navigating to /ai/admin/knowledge#suggested
- **Screenshot**: `step-1-suggested-tab-loaded.png`
- **What to look for**: Suggested tab is active, suggested articles displayed as cards with title, platform category badge (BEST_PRACTICE/HELP/DEFAULT_CONFIG/SKILL_UPDATE), version number, published date, content preview, and action buttons (Accept purple, Edit & Accept outline, Reject red). Purple background (#f4f2ff). If no suggestions exist, shows "You're all caught up" empty state.

### Checkpoint 2: Article Preview Expanded
- **When**: After clicking "Read more" on a suggested article
- **Screenshot**: `step-2-article-preview-expanded.png`
- **What to look for**: Full content of the suggested article is revealed. The "Read more" button should change to "Show less". Card expands to show full article content.

### Checkpoint 3: Article Accepted — Success Toast
- **When**: After clicking "Accept" button on the suggested article
- **Screenshot**: `step-3-accept-success-toast.png`
- **What to look for**: Success toast with text like "Knowledge article accepted and added to your knowledge base". The accepted article card should slide out / disappear from the Suggested tab list.

### Checkpoint 4: Accepted Article in Knowledge Articles Tab
- **When**: After switching to Knowledge Articles tab to verify the accepted article
- **Screenshot**: `step-4-accepted-article-in-list.png`
- **What to look for**: The accepted article appears in the Knowledge Articles list with source "Platform Suggested" and confidence ~90%.
