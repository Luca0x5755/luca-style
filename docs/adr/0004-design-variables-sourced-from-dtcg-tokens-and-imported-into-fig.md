Status: Accepted

# Source design variables from DTCG tokens in code and import them into the suite design files

The design variables (colours, spacing, radius, typography roles) have one source of truth: the token files in `packages/tokens/`, written in the W3C Design Tokens (DTCG) format. The token set is the union of what code and the design file used before, with duplicates such as the type sizes merged under one name. The generator writes the variable data, and the existing offline script `scripts/design/apply-variables.js` writes it into the design file through `openpencil eval`. Nobody edits the variable values in a `.fig` by hand any more. The component masters stay authored in the `.fig` (ADR 0007 decides what that file holds).

This replaces the variable part of ADR 0003, which kept `tokens.json` and the `.fig` variables as two copies synced by hand and checked by script. The rest of ADR 0003 (one file per suite, masters duplicated, offline split) stands.

The token source moves from the custom `common / modes / suites` JSON to DTCG. The published outputs (`@luca-style/tokens/css`, `/data`, `/typography`) keep their current shape, because both consumer projects read them.

Evidence: none of the seven design systems benchmarked in `docs/research/design-system-benchmark.md` treats a design file as the source of truth. Primer exports tokens from code to its design tool one way; Carbon and Spectrum keep the token data authoritative.

We considered:

- **Keep two hand-synced copies.** Rejected: the check script only detects drift after it happens, and every value change is done twice.
- **Keep the custom JSON and emit DTCG only as an output.** Rejected: `$description`, schema validation and mode coverage all have standard DTCG forms. One format serves all three.
- **Import with OpenPencil's `import_design_tokens`.** Rejected: it needs the OpenPencil app running, so it cannot run in a script or CI. The offline script is already tested.
- **Keep only the variables code already had.** Rejected: the design-only variables would still need a second, hand-kept copy.
- **Also generate the masters from code.** Rejected for now: there is no reliable way to generate component layout into OpenPencil, so masters stay hand-authored.

Consequences:

- Every token carries a `$description` with its intended use, and a generated token reference is written for agents.
- The build fails when any suite × mode combination is missing a value.
- Scripts that compared `.fig` variables against `tokens.json` become redundant once the import runs in their place.
