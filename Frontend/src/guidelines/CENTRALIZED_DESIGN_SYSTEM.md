# Centralized Design System

## Purpose
This guide defines the shared visual and interaction rules for the BMDC interface so all features feel consistent, user friendly, and engaging.

## Core Visual Language
- Theme direction: civic-modern, clean surfaces with subtle depth and warm accent energy.
- Typography:
  - Display/headings: Sora
  - Body/UI text: Manrope
- Color tokens:
  - Primary: actionable blue
  - Secondary: supportive green
  - Accent: highlight amber
  - Semantic destructive for critical actions
- Surface strategy:
  - Soft layered gradients for cards, sidebars, and page shell
  - Light atmospheric background aura for depth without noise

## Token Source of Truth
Use CSS custom properties in `src/index.css` as the only token source:
- Color tokens (`--background`, `--primary`, etc.)
- Surface tokens (`--surface-soft`, `--surface-raised`)
- Motion tokens (`--duration-fast`, `--duration-normal`, `--ease-standard`)
- Typography tokens (`--font-display`, `--font-body`)

## Shared Interaction Classes
These classes are centralized and should be reused instead of ad hoc effects:
- `ds-shell`: page-shell background treatment
- `ds-sidebar`: sidebar surface styling
- `ds-topbar`: sticky top-bar glass effect
- `ds-page`: page-entry animation
- `ds-nav-item`: navigation hover/active behavior
- `ds-button`: button micro-interactions
- `ds-card`: card hover depth and polish
- `ds-field`: form field focus and transition treatment

## Component Usage Rules
- Use shared primitives from `src/components/ui` first.
- Avoid one-off inline animation values unless absolutely necessary.
- Prefer token-based color and spacing over hardcoded values.
- For new high-traffic screens, wrap shell areas with shared classes before adding custom styles.

## Micro-Interaction Principles
- Keep motion fast and purposeful.
- Prioritize feedback over decoration:
  - Hover state for discoverability
  - Focus state for keyboard clarity
  - Press state for click confirmation
- Do not animate large layout shifts.
- Respect readability and contrast in both light and dark modes.

## Accessibility Guardrails
- Maintain visible focus ring behavior.
- Preserve semantic color intent (info, success, warning, destructive).
- Ensure text remains readable on gradient surfaces.
- Avoid reducing motion clarity for critical status/alerts.

## Implementation Notes
When adding a new UI module:
1. Start with shared primitives (`Button`, `Card`, `Input`, `Select`).
2. Apply centralized `ds-*` classes as needed.
3. Validate both desktop and mobile behavior.
4. Keep visual language aligned with this guide.
