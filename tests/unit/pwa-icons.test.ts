import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function readPngSize(path: string) {
  const bytes = readFileSync(new URL(path, import.meta.url));
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

describe("ícones das PWAs", () => {
  it("entrega os tamanhos instaláveis para o admin", () => {
    expect(readPngSize("../../public/icons/admin-icon-192.png")).toEqual({
      width: 192,
      height: 192,
    });
    expect(readPngSize("../../public/icons/admin-icon-512.png")).toEqual({
      width: 512,
      height: 512,
    });
  });

  it("mantém identidades visuais diferentes", () => {
    const publicIcon = readFileSync(
      new URL("../../public/icons/icon-512.png", import.meta.url),
    );
    const adminIcon = readFileSync(
      new URL("../../public/icons/admin-icon-512.png", import.meta.url),
    );

    expect(adminIcon.equals(publicIcon)).toBe(false);
  });
});
