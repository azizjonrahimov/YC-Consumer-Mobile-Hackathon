import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { cellOf } from "./lib/grid";
import { addPoints } from "./lib/ledger";
import { captureWalk } from "./lib/capture";
import { squareLoop } from "./lib/loop";
import { VENUE } from "./lib/config";
import venueShops from "../assets/seed-shops.json";

type ShopSeed = { name: string; lat: number; lng: number; reward: string; feeCents: number };

async function upsertShops(ctx: MutationCtx, shops: ShopSeed[]): Promise<void> {
  for (const s of shops) {
    const cellId = cellOf({ lat: s.lat, lng: s.lng });
    const all = await ctx.db.query("shops").collect(); // tiny table
    const same = all.find((x) => x.name === s.name);
    // Two shops in one block: keep the first, skip the second.
    if (all.some((x) => x.cellId === cellId && x._id !== same?._id)) continue;
    const doc = { name: s.name, lat: s.lat, lng: s.lng, cellId, reward: s.reward, feeCents: s.feeCents };
    let shopId;
    if (same) {
      await ctx.db.patch(same._id, doc);
      shopId = same._id;
    } else {
      shopId = await ctx.db.insert("shops", doc);
    }
    // Contract v4: two offers per shop if it has none.
    if (!(await ctx.db.query("offers").withIndex("by_shopId", (q) => q.eq("shopId", shopId)).first())) {
      await ctx.db.insert("offers", { shopId, title: s.reward, cost: 300 });
      await ctx.db.insert("offers", { shopId, title: "10% off your order", cost: 100 });
    }
  }
}

export const seedShops = mutation({
  args: {
    shops: v.array(v.object({ name: v.string(), lat: v.number(), lng: v.number(), reward: v.string(), feeCents: v.number() })),
  },
  handler: async (ctx, { shops }): Promise<{ count: number }> => {
    await upsertShops(ctx, shops);
    return { count: (await ctx.db.query("shops").collect()).length };
  },
});

export const reset = mutation({
  args: {},
  handler: async (ctx): Promise<null> => {
    for (const table of ["cells", "shopHolds", "walks", "events", "rewards", "ledger", "vouchers"] as const) {
      for (const doc of await ctx.db.query(table).collect()) await ctx.db.delete(doc._id);
    }
    for (const s of await ctx.db.query("season").collect()) await ctx.db.patch(s._id, { endedAt: undefined });
    // Contract v4: balances back to 0. Offers stay.
    for (const p of await ctx.db.query("players").collect()) await ctx.db.patch(p._id, { points: 0 });
    return null;
  },
});

/** Demo tools: "Add 500 points". Ledger reason "Demo points". */
export const grantPoints = mutation({
  args: { playerId: v.id("players"), amount: v.number() },
  handler: async (ctx, { playerId, amount }): Promise<{ balance: number }> => {
    if (!(await ctx.db.get(playerId))) throw new ConvexError("That player no longer exists. Join again.");
    return { balance: await addPoints(ctx, playerId, amount, "Demo points") };
  },
});

// B9: three demo players, each holding a venue shop. Colours come from playerColors in src/theme.ts.
const DEMO_PLAYERS = [
  { deviceId: "demo#Sam", name: "Sam", color: "#FF4D5E", flag: "first to the boba", shop: "Happy Cow Creamery & Tea", sideM: 130 },
  { deviceId: "demo#Maya", name: "Maya", color: "#9B5CFF", flag: "my block now", shop: "Neighbor Bakehouse", sideM: 150 },
  { deviceId: "demo#Leo", name: "Leo", color: "#FF8A3D", flag: "run faster", shop: "Piccino Coffee Bar", sideM: 130 },
] as const;
const DEMO_POINTS = 400;

/**
 * Makes the map look lived-in for the demo. Every block goes through captureWalk, the same path as
 * walks.submit, so strengths, shop holds and steal events follow the real rules. Idempotent: a demo
 * player who already exists is skipped. Returns the demo players created now and the cells on the map.
 */
export const demoSeed = mutation({
  args: {},
  handler: async (ctx): Promise<{ players: number; cells: number }> => {
    const existingShops = await ctx.db.query("shops").collect();
    await upsertShops(ctx, (venueShops as ShopSeed[]).filter((s) => !existingShops.some((x) => x.name === s.name)));

    const now = Date.now();
    let players = 0;
    for (const d of DEMO_PLAYERS) {
      if (await ctx.db.query("players").withIndex("by_deviceId", (q) => q.eq("deviceId", d.deviceId)).unique()) continue;
      const shop = (await ctx.db.query("shops").collect()).find((s) => s.name === d.shop);
      if (!shop) continue; // a shop skipped by seeding (same block as another) cannot be walked around
      const playerId = await ctx.db.insert("players", { deviceId: d.deviceId, name: d.name, color: d.color, flag: d.flag });
      const player = (await ctx.db.get(playerId))!;
      await captureWalk(ctx, player, squareLoop({ lat: shop.lat, lng: shop.lng }, d.sideM, now), now);
      await addPoints(ctx, playerId, DEMO_POINTS, "Demo points", now);
      players++;
    }
    return { players, cells: (await ctx.db.query("cells").collect()).length };
  },
});

/** Ops only (internal, not callable from the app): remove one player and everything that points at them. */
export const deletePlayer = internalMutation({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }): Promise<{ deleted: boolean; rows: number }> => {
    const player = await ctx.db.query("players").withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId)).unique();
    if (!player) return { deleted: false, rows: 0 };
    const id = player._id;
    const docs = [
      ...(await ctx.db.query("cells").withIndex("by_ownerId", (q) => q.eq("ownerId", id)).collect()),
      ...(await ctx.db.query("walks").withIndex("by_playerId", (q) => q.eq("playerId", id)).collect()),
      ...(await ctx.db.query("ledger").withIndex("by_playerId", (q) => q.eq("playerId", id)).collect()),
      ...(await ctx.db.query("vouchers").withIndex("by_playerId", (q) => q.eq("playerId", id)).collect()),
      ...(await ctx.db.query("rewards").withIndex("by_playerId", (q) => q.eq("playerId", id)).collect()),
      ...(await ctx.db.query("shopHolds").collect()).filter((h) => h.playerId === id),
      ...(await ctx.db.query("events").collect()).filter((e) => e.byPlayerId === id || e.fromPlayerId === id),
    ];
    for (const d of docs) await ctx.db.delete(d._id);
    await ctx.db.delete(id);
    return { deleted: true, rows: docs.length };
  },
});

// Ops: a believable walk history for one player, through the real captureWalk path. Loops stay away from
// every shop block; one of today's loops overlaps the west edge of Leo's Piccino area to take 1-2 plain blocks.
const DAY = 24 * 60 * 60 * 1000;
const M_LAT = 1 / 111320;
const M_LNG = 1 / (111320 * Math.cos((VENUE.lat * Math.PI) / 180));
const at = (northM: number, eastM: number, from = VENUE) => ({ lat: from.lat + northM * M_LAT, lng: from.lng + eastM * M_LNG });
const HISTORY: { agoMs: number; center: { lat: number; lng: number }; sideM: number }[] = [
  { agoMs: 6 * DAY + 2 * 3600_000, center: at(450, 0), sideM: 100 },
  { agoMs: 5 * DAY + 5 * 3600_000, center: at(450, 300), sideM: 160 },
  { agoMs: 4 * DAY + 1 * 3600_000, center: at(750, 150), sideM: 120 },
  { agoMs: 3 * DAY + 4 * 3600_000, center: at(-300, 450), sideM: 200 },
  { agoMs: 2 * DAY + 6 * 3600_000, center: at(750, -250), sideM: 90 },
  { agoMs: 2 * DAY + 2 * 3600_000, center: at(1050, 100), sideM: 225 },
  { agoMs: 1 * DAY + 3 * 3600_000, center: at(-350, 150), sideM: 140 },
];

export const backfillHistory = internalMutation({
  args: { deviceId: v.string(), stealFromShop: v.optional(v.string()) },
  handler: async (ctx, { deviceId, stealFromShop }): Promise<{ walks: number; stolen: number; skipped?: string }> => {
    const player = await ctx.db.query("players").withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId)).unique();
    if (!player) return { walks: 0, stolen: 0, skipped: "no such player" };
    if (await ctx.db.query("walks").withIndex("by_playerId", (q) => q.eq("playerId", player._id)).first()) {
      return { walks: 0, stolen: 0, skipped: "player already has walks" };
    }
    const now = Date.now();
    let walks = 0;
    let stolen = 0;
    for (const h of HISTORY) {
      const when = now - h.agoMs;
      const r = await captureWalk(ctx, (await ctx.db.get(player._id))!, squareLoop(h.center, h.sideM, when), when);
      if (r.status === "captured") walks++;
    }
    // Today 1: a quiet loop. Today 2: west of the steal shop, overlapping only the edge of its holder's area.
    const steal = (await ctx.db.query("shops").collect()).find((s) => s.name === (stealFromShop ?? "Piccino Coffee Bar"));
    const today = [
      { when: now - 4 * 3600_000, center: at(450, -300), sideM: 180 },
      ...(steal ? [{ when: now - 50 * 60_000, center: at(0, -100, { lat: steal.lat, lng: steal.lng }), sideM: 150 }] : []),
    ];
    for (const d of today) {
      const r = await captureWalk(ctx, (await ctx.db.get(player._id))!, squareLoop(d.center, d.sideM, d.when), d.when);
      if (r.status === "captured") walks++;
      stolen += r.stolen;
    }
    return { walks, stolen };
  },
});
