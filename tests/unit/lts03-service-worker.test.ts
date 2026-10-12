import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

function workerHarness() {
  const stores = new Map<string, Map<string, Response>>([
    [
      "jogo-da-musica-shell-v3",
      new Map([["/offline", new Response("old brand")]]),
    ],
    ["another-app-cache", new Map()],
  ]);
  const listeners = new Map<string, (event: unknown) => void>();
  const fetched: string[] = [];
  let claimed = false;
  const caches = {
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        async addAll(urls: string[]) {
          for (const url of urls) store.set(url, new Response("new brand"));
        },
        async match(request: string | Request) {
          return store.get(
            typeof request === "string"
              ? request
              : new URL(request.url).pathname,
          );
        },
        async put(request: Request, response: Response) {
          store.set(new URL(request.url).pathname, response);
        },
      };
    },
  };
  runInNewContext(
    readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8"),
    {
      URL,
      caches,
      fetch: async (request: Request) => {
        fetched.push(request.url);
        return new Response("network");
      },
      self: {
        location: { origin: "https://lasttrack.example" },
        addEventListener: (name: string, listener: (event: unknown) => void) =>
          listeners.set(name, listener),
        skipWaiting: async () => undefined,
        clients: {
          claim: async () => {
            claimed = true;
          },
        },
      },
    },
  );
  async function lifecycle(name: string) {
    let pending: Promise<unknown> | undefined;
    listeners.get(name)!({
      waitUntil: (work: Promise<unknown>) => {
        pending = work;
      },
    });
    await pending;
  }
  function request(url: string, method = "GET") {
    let response: Promise<Response> | undefined;
    listeners.get("fetch")!({
      request: new Request(url, { method }),
      respondWith: (value: Promise<Response>) => {
        response = value;
      },
    });
    return response;
  }
  return { stores, lifecycle, fetched, request, claimed: () => claimed };
}

describe("upgrade da PWA Last Track Standing", () => {
  it("renova o shell antigo sem apagar caches de outros aplicativos", async () => {
    const worker = workerHarness();
    await worker.lifecycle("install");
    await worker.lifecycle("activate");
    expect(worker.stores.has("jogo-da-musica-shell-v3")).toBe(false);
    expect(worker.stores.has("another-app-cache")).toBe(true);
    expect(worker.claimed()).toBe(true);
    const currentShells = [...worker.stores.entries()].filter(([name]) =>
      name.startsWith("jogo-da-musica-"),
    );
    expect(currentShells).toHaveLength(1);
    const cachedPaths = [...currentShells[0][1].keys()];
    expect(cachedPaths).toEqual(
      expect.arrayContaining([
        "/offline",
        "/icon.svg",
        "/icons/icon-192.png",
        "/icons/icon-512.png",
        "/icons/admin-icon-192.png",
        "/icons/admin-icon-512.png",
      ]),
    );
    expect(await currentShells[0][1].get("/offline")!.text()).toBe("new brand");
  });
  it.each([
    "https://lasttrack.example/api/games",
    "https://lasttrack.example/api/admin/youtube/search",
    "https://lasttrack.example/admin",
    "https://lasttrack.example/admin/temas",
    "https://lasttrack.example/admin/manifest.webmanifest",
    "https://www.youtube.com/embed/test-video",
    "https://i.ytimg.com/vi/test/hqdefault.jpg",
  ])(
    "deixa a rede controlar o recurso protegido ou externo %s",
    async (url) => {
      const worker = workerHarness();
      await worker.lifecycle("install");
      const before = [...worker.stores.values()].flatMap((store) => [
        ...store.keys(),
      ]);
      expect(worker.request(url)).toBeUndefined();
      expect(worker.fetched).toEqual([]);
      expect(
        [...worker.stores.values()].flatMap((store) => [...store.keys()]),
      ).toEqual(before);
    },
  );

  it("não intercepta mutações mesmo em caminho de asset", () => {
    const worker = workerHarness();
    expect(
      worker.request("https://lasttrack.example/icons/icon-192.png", "POST"),
    ).toBeUndefined();
    expect(worker.fetched).toEqual([]);
  });
});
