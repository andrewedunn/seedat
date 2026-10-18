// ABOUTME: Tests the shared definition of an open permit against real BLDS status values.
// ABOUTME: PERMIT_OPEN_SQL mirrors these rules; keep the two in step when either changes.
import { describe, expect, it } from "vitest";
import { isPermitOpen } from "../src/status";

describe("isPermitOpen", () => {
  it.each([
    [{ status_mapped: "Permit Issued", status: "Permit Issued" }, true],
    [{ status_mapped: "In Review", status: "Returned for revision" }, true],
    [{ status_mapped: "Inspection Phase" }, true],
    [{ status_mapped: "Permit Finaled", status: "Permit Finaled" }, false],
    [{ status_mapped: "Permit Cancelled", status: "VOIDED - Duplicate Permit" }, false],
    [{ status_mapped: "Occupancy" }, false],
    [{ status_mapped: "Other", status: "Expired" }, false],
    [{ status_mapped: "Permit Issued", is_closed: 1 }, false],
    // March 2025 bulk administrative closure: status "Closed", mapped to "Other", with a completion date.
    [{ status_mapped: "Other", status: "Closed" }, false],
    [{ status_mapped: "Permit Issued", status: "Permit Issued", completed_date: "2025-03-13" }, false],
  ])("%o -> %s", (p, open) => expect(isPermitOpen(p)).toBe(open));
});

describe("isEventPermit", () => {
  it("recognises event permits by their type code", async () => {
    const { isEventPermit } = await import("../src/status");
    expect(isEventPermit("18-12345-SPMA")).toBe(true);
    expect(isEventPermit("19-00012-EFLO")).toBe(true);
    expect(isEventPermit("26-30446-RENO")).toBe(false);
    expect(isEventPermit("26-25881-VCGEN")).toBe(false);
  });
});
