const sensitiveKeySegments = new Set([
  "authorization",
  "capability",
  "cookie",
  "password",
  "passwd",
  "secret",
  "senha",
  "token",
]);

function getKeySegments(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isSensitiveKey(key: string): boolean {
  const segments = getKeySegments(key);
  return (
    segments.some((segment) => sensitiveKeySegments.has(segment)) ||
    segments.some(
      (segment, index) => segment === "api" && segments[index + 1] === "key",
    )
  );
}

function isIpv6(candidate: string): boolean {
  if (!candidate.includes(":")) return false;
  const halves = candidate.split("::");
  if (halves.length > 2) return false;

  const groups = halves.flatMap((half) =>
    half.split(":").filter((group) => group.length > 0),
  );
  if (
    groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group)) ||
    groups.length > 8
  ) {
    return false;
  }

  return halves.length === 2 ? groups.length < 8 : groups.length === 8;
}

export function redactDiagnostic(value: string): string {
  return value
    .replace(
      /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s|,"']+/gi,
      "[REDACTED_CONNECTION_STRING]",
    )
    .replace(
      /\b(?:Server|Host|Data Source)\s*=[^|,\r\n]+(?:;[^|,\r\n]+)+/gi,
      "[REDACTED_CONNECTION_STRING]",
    )
    .replace(/\bhttps?:\/\/[^\s|,"']+/gi, (candidate) => {
      try {
        const url = new URL(candidate);
        return url.username || url.password || url.search
          ? "[REDACTED_URL]"
          : candidate;
      } catch {
        return "[REDACTED_URL]";
      }
    })
    .replace(/\bBearer\s+[^\s|,;]+/gi, "Bearer [REDACTED]")
    .replace(
      /(["']?)((?:[A-Za-z0-9_-]*(?:authorization|capability|cookie|password|passwd|secret|senha|token)[A-Za-z0-9_-]*)|(?:[A-Za-z0-9_-]*api[_-]?key[A-Za-z0-9_-]*))\1(\s*[:=]\s*)("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|[^\s|,;}"']+)/gi,
      (candidate, keyQuote, key, separator, assignmentValue) => {
        if (!isSensitiveKey(key)) return candidate;

        const valueQuote = assignmentValue[0];
        const redactedValue =
          valueQuote === '"' || valueQuote === "'"
            ? `${valueQuote}[REDACTED]${valueQuote}`
            : "[REDACTED]";
        return `${keyQuote}${key}${keyQuote}${separator}${redactedValue}`;
      },
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[REDACTED_IP]")
    .replace(/[0-9a-f:]*:[0-9a-f:]+/gi, (candidate) =>
      isIpv6(candidate) ? "[REDACTED_IP]" : candidate,
    );
}

export function redactDiagnosticValue(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (typeof value === "string") return redactDiagnostic(value);
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === undefined
  ) {
    return value;
  }
  if (typeof value !== "object") return { type: typeof value };
  if (depth >= 5 || seen.has(value)) return "[REDACTED_DEPTH_LIMIT]";

  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((entry) => redactDiagnosticValue(entry, depth + 1, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      isSensitiveKey(key)
        ? "[REDACTED]"
        : redactDiagnosticValue(entry, depth + 1, seen),
    ]),
  );
}
