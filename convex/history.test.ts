// @vitest-environment edge-runtime
/// <reference types="vite/client" />
// Ops: backfillHistory gives one player a believable history without touching any shop block.
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("backfillHistory: 9 walks, 1-2 plain blocks stolen from Leo, shop holders unchanged, idempotent", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.admin.demoSeed, {});
  const before = (await t.query(api.shops.list, {})).map((s) => [s.name, s.holderName, s.strength]);
  const me = await t.mutation(api.players.join, { deviceId: "owner", name: "Jack", color: "#FF4D5E" });

  const r = await t.mutation(internal.admin.backfillHistory, { deviceId: "owner" });
  expect(r.walks).toBe(9);
  expect(r.stolen).toBeGreaterThanOrEqual(1);
  expect(r.stolen).toBeLessThanOrEqual(2);

  expect((await t.query(api.shops.list, {})).map((s) => [s.name, s.holderName, s.strength])).toEqual(before);
  const s = await t.query(api.stats.mine, { playerId: me.playerId });
  expect(s).toMatchObject({ walks: 9, stealsMade: 1 });
  expect(s.blocksHeld).toBeGreaterThan(0);
  expect(s.points).toBeGreaterThan(0);
  expect(s.totalM).toBeGreaterThan(9 * 300);
  const ev = (await t.query(api.events.recent, {})).find((e) => e.byName === "Jack");
  expect(ev).toMatchObject({ fromName: "Leo", shopName: null });

  expect(await t.mutation(internal.admin.backfillHistory, { deviceId: "owner" })).toMatchObject({ walks: 0, skipped: "player already has walks" });
});
