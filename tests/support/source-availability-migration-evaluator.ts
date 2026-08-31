type MigrationRow = Record<string, unknown>;
type SqlBoolean = boolean | null;

type ForeignKey = {
  columns: string[];
  onDelete: string;
  referencedColumns: string[];
  referencedTable: string;
};

type TableModel = {
  checks: Array<(row: MigrationRow) => SqlBoolean>;
  defaults: Set<string>;
  foreignKeys: ForeignKey[];
  grantedRoles: Set<string>;
  notNull: Set<string>;
  policyCount: number;
  primaryKey: string[];
  revokedRoles: Set<string>;
  rlsEnabled: boolean;
  rlsForced: boolean;
};

type Token = {
  type:
    | "comma"
    | "identifier"
    | "keyword"
    | "number"
    | "operator"
    | "paren"
    | "string";
  value: string | number;
};

type Operand = (row: MigrationRow) => unknown;
type Predicate = (row: MigrationRow) => SqlBoolean;

const boundTable = "source_availability_observations";
const unboundTable = "unbound_source_availability_observations";
const protectedRoles = ["public", "anon", "authenticated"];
const songId = "20000000-0000-4000-8000-000000000020";
const otherSongId = "20000000-0000-4000-8000-000000000021";
const sourceKeyHash = "a".repeat(64);
const observedAt = new Date("2026-01-01T00:00:00.000Z");
const validUntil = new Date("2026-01-08T00:00:00.000Z");
const graceUntil = new Date("2026-01-09T00:00:00.000Z");

function relationName(fragment: string) {
  const identifiers = [...fragment.matchAll(/"([^"]+)"/g)];
  return identifiers.at(-1)?.[1] ?? fragment.trim().toLowerCase();
}

function quotedColumns(fragment: string) {
  return [...fragment.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function splitTopLevel(value: string) {
  const parts: string[] = [];
  let depth = 0;
  let quote: '"' | "'" | null = null;
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote) {
        if (value[index + 1] === quote) {
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
    } else if (character === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function tokenize(expression: string) {
  const value = expression.replace(/"[^"]+"\./g, "");
  const tokens: Token[] = [];
  let index = 0;

  while (index < value.length) {
    const character = value[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === '"') {
      const end = value.indexOf('"', index + 1);
      if (end < 0) throw new Error("Identificador SQL incompleto.");
      tokens.push({
        type: "identifier",
        value: value.slice(index + 1, end),
      });
      index = end + 1;
      continue;
    }
    if (character === "'") {
      let parsed = "";
      index += 1;
      while (index < value.length) {
        if (value[index] === "'") {
          if (value[index + 1] === "'") {
            parsed += "'";
            index += 2;
            continue;
          }
          index += 1;
          break;
        }
        parsed += value[index];
        index += 1;
      }
      tokens.push({ type: "string", value: parsed });
      continue;
    }
    if (/\d/.test(character)) {
      const match = value.slice(index).match(/^\d+(?:\.\d+)?/);
      if (!match) throw new Error("Número SQL inválido.");
      tokens.push({ type: "number", value: Number(match[0]) });
      index += match[0].length;
      continue;
    }
    const operator = value.slice(index).match(/^(?:>=|<=|<>|!=|=|>|<|~)/);
    if (operator) {
      tokens.push({ type: "operator", value: operator[0] });
      index += operator[0].length;
      continue;
    }
    if (character === "(" || character === ")") {
      tokens.push({ type: "paren", value: character });
      index += 1;
      continue;
    }
    if (character === ",") {
      tokens.push({ type: "comma", value: character });
      index += 1;
      continue;
    }
    const word = value.slice(index).match(/^[a-z_][a-z0-9_]*/i);
    if (word) {
      const normalized = word[0].toLowerCase();
      tokens.push({
        type: ["and", "in", "is", "not", "null", "or"].includes(normalized)
          ? "keyword"
          : "identifier",
        value: normalized,
      });
      index += word[0].length;
      continue;
    }
    throw new Error(`Token SQL desconhecido: ${character}`);
  }

  return tokens;
}

function comparable(value: unknown) {
  return value instanceof Date ? value.getTime() : value;
}

function compareOrder(
  left: unknown,
  operator: ">" | ">=" | "<" | "<=",
  right: unknown,
) {
  const comparableLeft = comparable(left);
  const comparableRight = comparable(right);
  const orderedLeft =
    typeof comparableLeft === "number" && typeof comparableRight === "number"
      ? comparableLeft
      : String(comparableLeft);
  const orderedRight =
    typeof comparableLeft === "number" && typeof comparableRight === "number"
      ? comparableRight
      : String(comparableRight);

  if (operator === ">") return orderedLeft > orderedRight;
  if (operator === ">=") return orderedLeft >= orderedRight;
  if (operator === "<") return orderedLeft < orderedRight;
  return orderedLeft <= orderedRight;
}

function compare(left: unknown, operator: string, right: unknown) {
  if (
    left === null ||
    left === undefined ||
    right === null ||
    right === undefined
  ) {
    return null;
  }
  const comparableLeft = comparable(left);
  const comparableRight = comparable(right);

  switch (operator) {
    case "=":
      return comparableLeft === comparableRight;
    case "!=":
    case "<>":
      return comparableLeft !== comparableRight;
    case ">":
      return compareOrder(left, operator, right);
    case ">=":
      return compareOrder(left, operator, right);
    case "<":
      return compareOrder(left, operator, right);
    case "<=":
      return compareOrder(left, operator, right);
    case "~":
      return new RegExp(String(comparableRight)).test(String(comparableLeft));
    default:
      return false;
  }
}

class CheckExpressionParser {
  private position = 0;

  constructor(private readonly tokens: Token[]) {}

  parse() {
    const predicate = this.parseOr();
    if (this.position !== this.tokens.length) {
      throw new Error("Expressão CHECK contém tokens não consumidos.");
    }
    return predicate;
  }

  private current() {
    return this.tokens[this.position];
  }

  private match(type: Token["type"], value?: string) {
    const token = this.current();
    if (
      !token ||
      token.type !== type ||
      (value !== undefined && token.value !== value)
    ) {
      return false;
    }
    this.position += 1;
    return true;
  }

  private consume(type: Token["type"], value?: string) {
    const token = this.current();
    if (!this.match(type, value)) {
      throw new Error(`Token CHECK esperado: ${value ?? type}.`);
    }
    return token;
  }

  private parseOr(): Predicate {
    let left = this.parseAnd();
    while (this.match("keyword", "or")) {
      const previous = left;
      const right = this.parseAnd();
      left = (row) => {
        const leftValue = previous(row);
        const rightValue = right(row);
        if (leftValue === true || rightValue === true) return true;
        if (leftValue === null || rightValue === null) return null;
        return false;
      };
    }
    return left;
  }

  private parseAnd(): Predicate {
    let left = this.parsePrimary();
    while (this.match("keyword", "and")) {
      const previous = left;
      const right = this.parsePrimary();
      left = (row) => {
        const leftValue = previous(row);
        const rightValue = right(row);
        if (leftValue === false || rightValue === false) return false;
        if (leftValue === null || rightValue === null) return null;
        return true;
      };
    }
    return left;
  }

  private parsePrimary(): Predicate {
    if (this.match("paren", "(")) {
      const expression = this.parseOr();
      this.consume("paren", ")");
      return expression;
    }

    const left = this.parseOperand();
    if (this.match("keyword", "is")) {
      const negated = this.match("keyword", "not");
      this.consume("keyword", "null");
      return (row) =>
        negated
          ? left(row) !== null && left(row) !== undefined
          : left(row) == null;
    }
    if (this.match("keyword", "in")) {
      this.consume("paren", "(");
      const options: Operand[] = [];
      do {
        options.push(this.parseOperand());
      } while (this.match("comma"));
      this.consume("paren", ")");
      return (row) => {
        const comparisons = options.map((option) =>
          compare(left(row), "=", option(row)),
        );
        if (comparisons.includes(true)) return true;
        if (comparisons.includes(null)) return null;
        return false;
      };
    }

    const operator = String(this.consume("operator").value);
    const right = this.parseOperand();
    return (row) => compare(left(row), operator, right(row));
  }

  private parseOperand(): Operand {
    const token = this.current();
    if (!token) throw new Error("Operando CHECK ausente.");
    this.position += 1;

    if (token.type === "identifier") {
      return (row) => row[String(token.value)];
    }
    if (token.type === "number" || token.type === "string") {
      return () => token.value;
    }
    throw new Error("Operando CHECK inválido.");
  }
}

function compileCheck(expression: string) {
  return new CheckExpressionParser(tokenize(expression)).parse();
}

function createTableModel(): TableModel {
  return {
    checks: [],
    defaults: new Set(),
    foreignKeys: [],
    grantedRoles: new Set(),
    notNull: new Set(),
    policyCount: 0,
    primaryKey: [],
    revokedRoles: new Set(),
    rlsEnabled: false,
    rlsForced: false,
  };
}

function buildCatalog(statements: string[]) {
  const tables = new Map<string, TableModel>();

  for (const statement of statements) {
    const createTable = statement.match(
      /^CREATE TABLE\s+((?:"[^"]+"\.)?"[^"]+")\s*\(([\s\S]*)\)\s*;?$/i,
    );
    if (createTable) {
      const name = relationName(createTable[1]);
      const table = createTableModel();
      for (const item of splitTopLevel(createTable[2])) {
        const primaryKey = item.match(
          /^CONSTRAINT\s+"[^"]+"\s+PRIMARY KEY\s*\(([^)]+)\)$/i,
        );
        if (primaryKey) {
          table.primaryKey = quotedColumns(primaryKey[1]);
          continue;
        }
        const check = item.match(
          /^CONSTRAINT\s+"[^"]+"\s+CHECK\s*\(([\s\S]*)\)$/i,
        );
        if (check) {
          table.checks.push(compileCheck(check[1]));
          continue;
        }
        const column = item.match(/^"([^"]+)"\s+([\s\S]+)$/);
        if (column) {
          if (/\bNOT NULL\b/i.test(column[2])) table.notNull.add(column[1]);
          if (/\bDEFAULT\b/i.test(column[2])) table.defaults.add(column[1]);
        }
      }
      tables.set(name, table);
      continue;
    }

    const foreignKey = statement.match(
      /^ALTER TABLE\s+((?:"[^"]+"\.)?"[^"]+")\s+ADD CONSTRAINT\s+"[^"]+"\s+FOREIGN KEY\s*\(([^)]+)\)\s+REFERENCES\s+((?:"[^"]+"\.)?"[^"]+")\s*\(([^)]+)\)\s+ON DELETE\s+(.+?)\s+ON UPDATE/i,
    );
    if (foreignKey) {
      tables.get(relationName(foreignKey[1]))?.foreignKeys.push({
        columns: quotedColumns(foreignKey[2]),
        onDelete: foreignKey[5].trim().toLowerCase(),
        referencedColumns: quotedColumns(foreignKey[4]),
        referencedTable: relationName(foreignKey[3]),
      });
      continue;
    }

    const rls = statement.match(
      /^ALTER TABLE\s+((?:"[^"]+"\.)?"[^"]+")\s+(ENABLE|DISABLE|FORCE|NO FORCE) ROW LEVEL SECURITY/i,
    );
    if (rls) {
      const table = tables.get(relationName(rls[1]));
      if (table) {
        const operation = rls[2].toLowerCase();
        if (operation === "enable") table.rlsEnabled = true;
        if (operation === "disable") table.rlsEnabled = false;
        if (operation === "force") table.rlsForced = true;
        if (operation === "no force") table.rlsForced = false;
      }
      continue;
    }

    const revoke = statement.match(
      /^REVOKE\s+ALL\s+ON TABLE\s+((?:"[^"]+"\.)?"[^"]+")\s+FROM\s+([^;]+);?$/i,
    );
    if (revoke) {
      const table = tables.get(relationName(revoke[1]));
      for (const role of revoke[2].split(",")) {
        table?.revokedRoles.add(role.trim().replaceAll('"', "").toLowerCase());
      }
      continue;
    }

    const grant = statement.match(
      /^GRANT\s+.+?\s+ON(?:\s+TABLE)?\s+((?:"[^"]+"\.)?"[^"]+")\s+TO\s+([^;]+);?$/i,
    );
    if (grant) {
      const table = tables.get(relationName(grant[1]));
      for (const role of grant[2].split(",")) {
        table?.grantedRoles.add(role.trim().replaceAll('"', "").toLowerCase());
      }
      continue;
    }

    const policy = statement.match(
      /^CREATE POLICY\s+.+?\s+ON\s+((?:"[^"]+"\.)?"[^"]+")/i,
    );
    if (policy) {
      const table = tables.get(relationName(policy[1]));
      if (table) table.policyCount += 1;
    }
  }

  return tables;
}

function canInsert(
  tables: Map<string, TableModel>,
  tableName: string,
  row: MigrationRow,
  options: {
    existing?: MigrationRow[];
    referenced?: Record<string, MigrationRow[]>;
  } = {},
) {
  const table = tables.get(tableName);
  if (!table) return false;

  const required = new Set([...table.notNull, ...table.primaryKey]);
  for (const column of required) {
    if (
      (row[column] === null || row[column] === undefined) &&
      !table.defaults.has(column)
    ) {
      return false;
    }
  }
  if (table.checks.some((check) => check(row) === false)) return false;
  if (
    table.primaryKey.length > 0 &&
    options.existing?.some((existing) =>
      table.primaryKey.every((column) => existing[column] === row[column]),
    )
  ) {
    return false;
  }

  for (const foreignKey of table.foreignKeys) {
    const referencedRows =
      options.referenced?.[foreignKey.referencedTable] ?? [];
    const matched = referencedRows.some((referencedRow) =>
      foreignKey.columns.every(
        (column, index) =>
          row[column] === referencedRow[foreignKey.referencedColumns[index]],
      ),
    );
    if (!matched) return false;
  }

  return true;
}

function availableRow(tableName: string): MigrationRow {
  return {
    ...(tableName === boundTable
      ? { song_id: songId }
      : { source_key_hash: sourceKeyHash }),
    region: "BR",
    confirmed_state: "available",
    confirmation_reason: "available",
    error_code: null,
    observed_at: observedAt,
    last_attempt_at: observedAt,
    last_confirmed_at: observedAt,
    valid_until: validUntil,
    grace_until: graceUntil,
    next_check_at: validUntil,
    revision: 1,
    policy_version: 1,
  };
}

function validRows(tableName: string) {
  const available = availableRow(tableName);
  return [
    available,
    {
      ...available,
      confirmed_state: "unavailable",
      confirmation_reason: "not_found",
      valid_until: null,
      grace_until: null,
      next_check_at: new Date("2026-01-02T00:00:00.000Z"),
    },
    {
      ...available,
      confirmed_state: "unknown",
      confirmation_reason: null,
      last_confirmed_at: null,
      valid_until: null,
      grace_until: null,
      next_check_at: new Date("2026-01-01T01:00:00.000Z"),
    },
  ];
}

function invalidRows(tableName: string) {
  const [available, unavailable, unknown] = validRows(tableName);
  return [
    { ...available, region: "br" },
    { ...available, revision: 0 },
    { ...available, policy_version: 0 },
    {
      ...available,
      observed_at: new Date("2026-01-02T00:00:00.000Z"),
    },
    {
      ...available,
      last_confirmed_at: new Date("2026-01-02T00:00:00.000Z"),
    },
    {
      ...available,
      next_check_at: new Date("2025-12-31T00:00:00.000Z"),
    },
    { ...available, confirmed_state: "unknown" },
    { ...available, confirmation_reason: "not_found" },
    { ...available, last_confirmed_at: null },
    { ...available, valid_until: null },
    { ...available, grace_until: null },
    {
      ...available,
      last_attempt_at: new Date("2026-01-09T00:00:00.000Z"),
      last_confirmed_at: new Date("2026-01-09T00:00:00.000Z"),
      next_check_at: new Date("2026-01-09T00:00:00.000Z"),
    },
    {
      ...available,
      valid_until: new Date("2026-01-10T00:00:00.000Z"),
      grace_until: new Date("2026-01-09T00:00:00.000Z"),
      next_check_at: new Date("2026-01-10T00:00:00.000Z"),
    },
    { ...unavailable, confirmed_state: "available" },
    { ...unavailable, confirmation_reason: "available" },
    { ...unavailable, last_confirmed_at: null },
    { ...unavailable, valid_until: validUntil },
    { ...unavailable, grace_until: graceUntil },
    { ...unknown, confirmed_state: "available" },
    { ...unknown, confirmation_reason: "available" },
    { ...unknown, last_confirmed_at: observedAt },
    { ...unknown, valid_until: validUntil },
    { ...unknown, grace_until: graceUntil },
    ...(tableName === unboundTable
      ? [{ ...available, source_key_hash: "not-a-sha256" }]
      : []),
  ];
}

function auditConstraints(tables: Map<string, TableModel>, tableName: string) {
  const referenced = { songs: [{ id: songId }, { id: otherSongId }] };
  return (
    validRows(tableName).every((row) =>
      canInsert(tables, tableName, row, { referenced }),
    ) &&
    invalidRows(tableName).every(
      (row) => !canInsert(tables, tableName, row, { referenced }),
    )
  );
}

function auditUniqueness(tables: Map<string, TableModel>, tableName: string) {
  const base = availableRow(tableName);
  const referenced = { songs: [{ id: songId }, { id: otherSongId }] };
  const duplicateRejected = !canInsert(
    tables,
    tableName,
    { ...base },
    {
      existing: [base],
      referenced,
    },
  );
  const otherRegionAccepted = canInsert(
    tables,
    tableName,
    { ...base, region: "US" },
    { existing: [base], referenced },
  );
  const identityColumn =
    tableName === boundTable ? "song_id" : "source_key_hash";
  const otherIdentityAccepted = canInsert(
    tables,
    tableName,
    {
      ...base,
      [identityColumn]: tableName === boundTable ? otherSongId : "b".repeat(64),
    },
    { existing: [base], referenced },
  );

  return duplicateRejected && otherRegionAccepted && otherIdentityAccepted;
}

export function evaluateSourceAvailabilityMigration(migration: string) {
  const statements = migration
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim());
  const tables = buildCatalog(statements);
  const violations: string[] = [];

  for (const tableName of [boundTable, unboundTable]) {
    const table = tables.get(tableName);
    if (!auditConstraints(tables, tableName)) {
      violations.push(`constraints:${tableName}`);
    }
    if (!auditUniqueness(tables, tableName)) {
      violations.push(`uniqueness:${tableName}`);
    }
    if (!table?.rlsEnabled || !table.rlsForced || table.policyCount !== 0) {
      violations.push(`rls:${tableName}`);
    }
    if (
      !table ||
      protectedRoles.some(
        (role) => !table.revokedRoles.has(role) || table.grantedRoles.has(role),
      )
    ) {
      violations.push(`grants:${tableName}`);
    }
  }

  const bound = tables.get(boundTable);
  const foreignKey = bound?.foreignKeys.find(
    (candidate) =>
      candidate.columns.join(",") === "song_id" &&
      candidate.referencedTable === "songs" &&
      candidate.referencedColumns.join(",") === "id",
  );
  const base = availableRow(boundTable);
  const validReferenceAccepted = canInsert(tables, boundTable, base, {
    referenced: { songs: [{ id: songId }] },
  });
  const missingReferenceRejected = !canInsert(tables, boundTable, base, {
    referenced: { songs: [] },
  });
  if (
    !foreignKey ||
    foreignKey.onDelete !== "cascade" ||
    !validReferenceAccepted ||
    !missingReferenceRejected
  ) {
    violations.push(`foreign-key:${boundTable}`);
  }

  return { statementCount: statements.length, violations };
}
