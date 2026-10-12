import assert from "node:assert/strict";
import test from "node:test";
import {
  createSourceHealthInvalidation,
  parseSourceHealthInvalidation,
} from "../../src/domain/music/catalog-invalidation.ts";

test("outbox de saúde preserva perda de 64 e destinos internos sem metadados do provedor", () => {
  const result = createSourceHealthInvalidation({
    source: {
      keyHash: "a".repeat(64),
      revision: 7,
      policyVersion: 1,
      providerUrl: "https://provider.invalid/private",
      title: "PRIVATE_PROVIDER_TITLE",
      credential: "PRIVATE_CREDENTIAL",
    },
    theme: {
      id: "10000000-0000-4000-8000-000000000081",
      slug: "tema-compartilhado",
      title: "PRIVATE_THEME_TITLE",
    },
    before: {
      editorialState: "published",
      visibility: "visible",
      operationalState: "healthy",
      primaryModes: [32, 64],
    },
    after: {
      editorialState: "published",
      visibility: "visible",
      operationalState: "degraded",
      primaryModes: [32],
    },
  });
  assert.deepEqual(result, {
    schemaVersion: 1,
    ruleVersion: 1,
    type: "source_health_changed",
    cause: "health_change",
    source: {
      keyHash: "a".repeat(64),
      region: "BR",
      revision: 7,
      policyVersion: 1,
    },
    theme: {
      id: "10000000-0000-4000-8000-000000000081",
      slug: "tema-compartilhado",
    },
    transition: {
      fromVisibility: "visible",
      toVisibility: "visible",
      fromOperationalState: "healthy",
      toOperationalState: "degraded",
      lostPrimaryModes: [64],
      recoveredPrimaryModes: [],
    },
    paths: [
      "/",
      "/tema/tema-compartilhado",
      "/admin",
      "/admin/temas",
      "/admin/temas/10000000-0000-4000-8000-000000000081",
    ],
  });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|provider\.invalid/);
});

test("outbox recusa slug que poderia invalidar um destino fora do Tema", () => {
  assert.throws(
    () =>
      createSourceHealthInvalidation({
        source: { keyHash: "a".repeat(64), revision: 7, policyVersion: 1 },
        theme: {
          id: "10000000-0000-4000-8000-000000000081",
          slug: "../../admin/login",
        },
        before: {
          editorialState: "published",
          visibility: "visible",
          operationalState: "healthy",
          primaryModes: [32, 64],
        },
        after: {
          editorialState: "published",
          visibility: "visible",
          operationalState: "degraded",
          primaryModes: [32],
        },
      }),
    /Invalid catalog invalidation destination/,
  );
});

test("uma mudança de publicação editorial não pode ser emitida como mudança de saúde", () => {
  assert.throws(
    () =>
      createSourceHealthInvalidation({
        source: { keyHash: "a".repeat(64), revision: 7, policyVersion: 1 },
        theme: {
          id: "10000000-0000-4000-8000-000000000081",
          slug: "tema-compartilhado",
        },
        before: {
          editorialState: "published",
          visibility: "visible",
          operationalState: "healthy",
          primaryModes: [32, 64],
        },
        after: {
          editorialState: "draft",
          visibility: "hidden",
          operationalState: "editorial_draft",
          primaryModes: [32, 64],
        },
      }),
    /Editorial change is not a source health change/,
  );
});

test("outbox aceita somente identidades internas e versões positivas", () => {
  for (const invalid of [
    { theme: { id: "../../login", slug: "tema-compartilhado" } },
    {
      source: {
        keyHash: {
          toString: () => "a".repeat(64),
          credential: "PRIVATE_CREDENTIAL",
        },
        revision: 7,
        policyVersion: 1,
      },
    },
    {
      source: { keyHash: "PRIVATE_CREDENTIAL", revision: 7, policyVersion: 1 },
    },
    { source: { keyHash: "a".repeat(64), revision: 0, policyVersion: 1 } },
    { source: { keyHash: "a".repeat(64), revision: 7, policyVersion: 0 } },
  ]) {
    assert.throws(
      () =>
        createSourceHealthInvalidation({
          source: { keyHash: "a".repeat(64), revision: 7, policyVersion: 1 },
          theme: {
            id: "10000000-0000-4000-8000-000000000081",
            slug: "tema-compartilhado",
          },
          before: {
            editorialState: "published",
            visibility: "visible",
            operationalState: "healthy",
            primaryModes: [32, 64],
          },
          after: {
            editorialState: "published",
            visibility: "visible",
            operationalState: "degraded",
            primaryModes: [32],
          },
          ...invalid,
        }),
      /Invalid catalog invalidation identity/,
    );
  }
});

test("leitor do outbox recusa campos extras e destinos adulterados antes da invalidação", () => {
  const event = createSourceHealthInvalidation({
    source: { keyHash: "a".repeat(64), revision: 7, policyVersion: 1 },
    theme: {
      id: "10000000-0000-4000-8000-000000000081",
      slug: "tema-compartilhado",
    },
    before: {
      editorialState: "published",
      visibility: "visible",
      operationalState: "healthy",
      primaryModes: [32, 64],
    },
    after: {
      editorialState: "published",
      visibility: "visible",
      operationalState: "degraded",
      primaryModes: [32],
    },
  });
  assert.deepEqual(parseSourceHealthInvalidation(event), event);
  assert.throws(
    () =>
      parseSourceHealthInvalidation({
        ...event,
        credential: "PRIVATE_CREDENTIAL",
      }),
    /Invalid catalog invalidation payload/,
  );
  assert.throws(
    () =>
      parseSourceHealthInvalidation({
        ...event,
        paths: ["https://provider.invalid/private", ...event.paths.slice(1)],
      }),
    /Invalid catalog invalidation payload/,
  );
});
