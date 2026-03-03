# Desired Emotional Response

## Primary Emotional Goals

Three emotional states define the Nexa experience, in priority order:

1. **Empowered Clarity** — *"I understand my business better than I ever have."* Users should feel that Nexa gives them insight they couldn't get before — not through complexity, but through intelligent presentation. Period comparisons, cross-module flows, and the AI briefing combine to create a feeling of command. Sarah on her phone at 7am should feel like a CEO with a personal analyst, not a user battling an ERP.

2. **Effortless Competence** — *"I can do this without thinking about the software."* The system should feel invisible. Users should think about their business decisions (should I approve this PO?), not about the software mechanics (which menu, which tab, which field?). A new user should feel competent within 5 minutes. A legacy HansaWorld user should feel liberated within their first session.

3. **Trustworthy Partnership** — *"The AI is helping me, and I can verify everything it does."* Users must never feel that the AI is a black box or that it might act without their knowledge. Confidence scores, explainable suggestions ("Based on Acme's last 12 orders..."), and the absolute rule that nothing commits without approval — these create a partnership feeling, not an automation anxiety.

## Emotional Journey Mapping

| Stage | Target Emotion | Design Mechanism | Anti-Pattern to Avoid |
|-------|---------------|------------------|----------------------|
| **First Visit** | Curiosity → Quick Delight | Setup wizard with AI suggestions, "Magic Moment" in <5 min, first briefing with real data | Empty screens, long setup, "configure everything first" |
| **Morning Briefing** | Calm Control | Personalised, prioritised, actionable items with period comparisons. No alarms, no chaos — curated intelligence | Notification overload, red badges everywhere, anxiety-inducing urgency |
| **AI Record Creation** | Pleased Surprise | Pre-filled form appears with correct data, user thinks "it got it right" | Wrong data requiring extensive correction, breaking trust |
| **Document Upload** | "Wow" → Satisfied Trust | Watch fields populate in real-time from uploaded document, confidence indicators build trust | Slow extraction, errors, no feedback during processing |
| **Approval Flow** | Confident Authority | Clear what they're approving, why it's needed, one-tap action with undo available | Unclear consequences, no context, buried in workflow |
| **Error / Exception** | Guided Resolution | AI explains what went wrong, suggests fix, never a dead end. Tone is helpful, not alarming | Red error banners, cryptic codes, blame the user |
| **Month-End Close** | Progressive Accomplishment | Checklist with progress bar, each completed step gives small satisfaction, AI handles the tedious parts | Endless manual reconciliation, no sense of progress |
| **Return Visit** | Familiar Welcome | Remembered preferences, picked up where they left off, briefing reflects what changed since last visit | Starting from scratch, no continuity, generic home screen |

## Micro-Emotions

**Must cultivate:**

- **Confidence** over Confusion — Every screen answers "what am I looking at?" and "what should I do next?" within 2 seconds. Status badges, breadcrumbs, and contextual headers eliminate orientation anxiety.
- **Trust** over Scepticism — AI confidence scores (green/amber/red), "AI suggested because..." tooltips, and the immutable rule that AI never commits without approval. Trust is earned field-by-field, not assumed.
- **Accomplishment** over Frustration — Micro-celebrations: a subtle checkmark animation when an invoice is approved, a progress increment on the month-end checklist, a "you're up to date" state on the briefing. Small wins compound into satisfaction.
- **Delight** over Mere Satisfaction — Occasional "wow" moments: AI correctly pre-filling a complex 15-line invoice, document extraction nailing every field, a saved view that perfectly captures what the user needed. These moments create advocacy.

**Must prevent:**

- **Overwhelm** — Progressive disclosure on forms, tiered notifications (not everything is urgent), collapsible sidebar sections. The system must feel spacious, not dense.
- **Anxiety** — No aggressive red indicators for non-critical items. Financial errors are serious; a missing optional field is not. The colour system must distinguish severity honestly.
- **Abandonment** — No dead-end screens. Every error state has a next action. Every empty state has guidance. Every loading state has feedback. Users should never feel stranded.
- **Surveillance** — Audit trails exist but aren't visible as "tracking." The AI assistant is a helper, not a monitor. Activity logging serves the business, not management oversight.

## Design Implications

| Emotional Goal | UX Design Choice |
|---------------|-----------------|
| Empowered Clarity | Period comparison on EVERY metric (↑12% vs last month). Cross-module `<EventFlowTracker>` on every detail view. Role-based briefing as home screen — not a generic dashboard. |
| Effortless Competence | AI as primary path (natural language input always available). Progressive disclosure (primary tab shows 15 fields, not 280). Keyboard shortcuts for power users. Consistent patterns across all 11 modules. |
| Trustworthy Partnership | Confidence indicators on every AI-filled field. "AI suggested because..." expandable explanations. Side-by-side document view (original + extracted). Undo available for 30 seconds after approval. |
| Calm Control (Briefing) | Muted purple palette — not aggressive. Information density that informs without overwhelming. Items sorted by business priority, not chronological. Completed items fade, don't disappear. |
| Pleased Surprise (AI) | Streaming AI responses (watch fields fill in). Smooth animations on state transitions. Success states that feel rewarding (subtle glow, checkmark). |
| Guided Resolution (Errors) | Warm amber for warnings, reserved red only for blocking errors. Every error message includes a suggested action. Inline validation on form fields (don't wait for submit). Toast notifications auto-dismiss; errors persist until resolved. |
| Progressive Accomplishment | Month-end checklist with step counter and progress bar. Batch approval counter ("47 of 50 matched"). Briefing items that can be crossed off. Daily summary of what was accomplished. |

## Emotional Design Principles

1. **Calm Over Urgent** — The default emotional register is calm professionalism. Urgency is reserved for genuinely time-sensitive items (overdue payments, failed payroll runs, compliance deadlines). Most ERP notifications are informational, not urgent — the UX must reflect this through the 3-tier notification system (Tier 1: toast + centre for critical, Tier 2: centre only for standard, Tier 3: audit-only for routine).

2. **Earned Trust, Not Assumed Trust** — The AI starts every interaction by showing its work. Confidence scores are visible. Suggestions include reasoning. As users verify AI accuracy over time, trust compounds naturally. We never ask users to "just trust the AI" — we show them evidence and let trust emerge.

3. **Small Wins Compound** — Every completed action gets acknowledged: a subtle animation, a counter increment, a status change. These micro-celebrations are brief (200–400ms) and tasteful (not confetti) — but they create a rhythm of accomplishment that makes ERP work feel productive rather than administrative.

4. **Space to Think** — Generous whitespace in the purple theme, clear visual hierarchy, and progressive disclosure all serve the same purpose: giving the user's brain space to focus on the business decision, not the interface. The most important information has the most visual weight; everything else recedes.

5. **Recovery is Part of the Experience** — Errors, mistakes, and exceptions are normal business events, not failures. The UX treats them as part of the workflow: an AI extraction confidence of 45% is not an error — it's an invitation for the user to provide the correct value. An unmatched bank transaction is not a problem — it's an opportunity for the user to teach the system. The emotional tone of exceptions is "let's sort this out together."
