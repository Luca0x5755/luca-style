Status: Accepted

# Source design variables from DTCG tokens in code and import them into the design file

The design variables (colours, spacing, radius, typography roles) have one source of truth: the token files in `packages/tokens/`, written in the W3C Design Tokens (DTCG) format. The token set is the union of what code and the design file need, with duplicates such as the type sizes merged under one name. The generator writes a Penpot-importable token JSON (`docs/mockup/themes/penpot-tokens.json`), which is imported by hand in the Penpot app. Nobody edits the variable values in the design file. The component masters stay authored in the design file (ADR 0007 decides what that file holds; ADR 0008 chose the tool).

The token source is DTCG rather than a custom JSON. The published outputs (`@luca-style/tokens/css`, `/data`, `/typography`) keep their shape, because both consumer projects read them.

Evidence: none of the seven design systems benchmarked in `docs/research/design-system-benchmark.md` treats a design file as the source of truth. Primer exports tokens from code to its design tool one way; Carbon and Spectrum keep the token data authoritative.

We considered:

- **Keep two hand-synced copies.** Rejected: a check script only detects drift after it happens, and every value change is done twice.
- **Keep the custom JSON and emit DTCG only as an output.** Rejected: `$description`, schema validation and mode coverage all have standard DTCG forms. One format serves all three.
- **Write variables into the design file from a script.** Rejected: Penpot has no offline CLI, and a script over its plugin API would change with the API version.
- **Keep only the variables code already had.** Rejected: the design-only variables would still need a second, hand-kept copy.
- **Also generate the masters from code.** Rejected for now: there is no reliable way to generate component layout into the design tool, so masters stay hand-authored.

Consequences:

- Every token carries a `$description` with its intended use, and a generated token reference is written for agents.
- The build fails when any suite × mode combination is missing a value.
- `npm run check:penpot` compares the committed design file against the generated variable data, so drift fails the check.
