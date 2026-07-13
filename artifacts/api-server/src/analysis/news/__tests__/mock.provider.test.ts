import { describe, it, expect } from "vitest";
import { MockNewsProvider } from "../mock.provider.js";

describe("MockNewsProvider", () => {
  it("only returns events within the requested time range", async () => {
    const provider = new MockNewsProvider();
    const from = new Date("2026-07-13T00:00:00Z");
    const to = new Date("2026-07-20T00:00:00Z");
    const events = await provider.getEvents({ from, to });

    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.scheduledTime.getTime()).toBeGreaterThanOrEqual(from.getTime());
      expect(e.scheduledTime.getTime()).toBeLessThanOrEqual(to.getTime());
    }
  });

  it("returns events sorted by scheduledTime ascending", async () => {
    const provider = new MockNewsProvider();
    const events = await provider.getEvents({
      from: new Date("2026-07-01T00:00:00Z"),
      to: new Date("2026-08-01T00:00:00Z"),
    });
    for (let i = 1; i < events.length; i++) {
      expect(events[i].scheduledTime.getTime()).toBeGreaterThanOrEqual(events[i - 1].scheduledTime.getTime());
    }
  });

  it("filters by currency when requested", async () => {
    const provider = new MockNewsProvider();
    const events = await provider.getEvents({
      currencies: ["JPY"],
      from: new Date("2026-07-01T00:00:00Z"),
      to: new Date("2026-08-01T00:00:00Z"),
    });
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) expect(e.currency).toBe("JPY");
  });

  it("never sets `actual` for events scheduled in the future", async () => {
    const provider = new MockNewsProvider();
    const from = new Date();
    const to = new Date(from.getTime() + 30 * 86_400_000);
    const events = await provider.getEvents({ from, to });
    const future = events.filter((e) => e.scheduledTime.getTime() > Date.now());
    expect(future.length).toBeGreaterThan(0);
    for (const e of future) expect(e.actual).toBeNull();
  });

  it("is deterministic for the same query window", async () => {
    const provider = new MockNewsProvider();
    const params = { from: new Date("2026-07-13T00:00:00Z"), to: new Date("2026-07-20T00:00:00Z") };
    const first = await provider.getEvents(params);
    const second = await provider.getEvents(params);
    expect(first.map((e) => ({ ...e, scheduledTime: e.scheduledTime.toISOString() }))).toEqual(
      second.map((e) => ({ ...e, scheduledTime: e.scheduledTime.toISOString() })),
    );
  });

  it("returns an empty array for a currency with no templates", async () => {
    const provider = new MockNewsProvider();
    const events = await provider.getEvents({
      currencies: ["ZZZ"],
      from: new Date("2026-07-01T00:00:00Z"),
      to: new Date("2026-08-01T00:00:00Z"),
    });
    expect(events).toEqual([]);
  });
});
