# Domain Docs

How the engineering skills should consume this repository's domain documentation when exploring the codebase.

## Before exploring, read these

- `CONTEXT.md` at the repository root.
- `CONTEXT-MAP.md` at the repository root, if it exists.
- ADRs under `docs/adr/` that affect the area being changed.

If these files do not exist, proceed silently. The `/domain-modeling` skill creates them lazily when terminology or decisions are resolved.

## File structure

This is a single-context repository:

```text
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept, use the term defined in `CONTEXT.md`. Do not drift to synonyms the glossary explicitly avoids.

If the required concept is missing, reconsider whether the term belongs to the project or record the gap for `/domain-modeling`.

For Tema publication or health changes, distinguish the glossary's Publicação
editorial, Visibilidade derivada and Estado operacional. The CAT-04 rollout and
legacy public-read boundary are documented in `docs/qa/cat-04.md`.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly instead of silently overriding the decision.
