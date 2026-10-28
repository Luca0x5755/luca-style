Status: Proposed

# Build every component on Base UI, including Select

All shared components use Base UI for behaviour, keyboard handling, focus and accessibility. The design system keeps only styling and the public component API. This includes `Select`, which moves from the native `<select>` to a Base UI select with a styled popup, so every control has the same look across browsers and devices.

Evidence from `docs/research/design-system-benchmark.md`: Radix Themes, shadcn/ui, Spectrum and Chakra each delegate behaviour and accessibility to a separate headless layer instead of writing it per component.

We considered:

- **React Aria Components.** The most thorough accessibility and i18n coverage, and its `data-*` state attributes suit CSS-variable styling. Not chosen in favour of Base UI.
- **Radix Primitives** and **Ark UI.** Not chosen in favour of Base UI.
- **Keep the native `<select>`.** Rejected by the owner: the popup cannot be styled, so Select would look different from every other control and from the suite design files.
- **Keep hand-written behaviour and adopt a library only for future complex components.** Rejected for the same consistency reason.

Consequences:

- `@luca-style/react` gains a runtime dependency on Base UI.
- The DOM of `Select` changes. Consumer end-to-end tests that drive a native `<select>` must be updated; the 0.2.0 upgrade notes in `docs/consumer-guide.md` say so.
- The `Select` master in both suite design files gains an open-popup state.
- The public props of existing components stay as they are where Base UI allows it.
