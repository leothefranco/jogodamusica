const sensitiveKeyPattern =
  /^(?:authorization|capability|cookie|password|passwd|secret|senha|token|api[_-]?key)$/i;

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
      /\b(password|passwd|senha|secret|token|api[_-]?key|authorization|capability|cookie)\b(\s*[:=]\s*)([^\s|,;]+)/gi,
      "$1$2[REDACTED]",
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
      sensitiveKeyPattern.test(key)
        ? "[REDACTED]"
        : redactDiagnosticValue(entry, depth + 1, seen),
    ]),
  );
}
