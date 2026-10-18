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
  ])("%o -> %s", (p, open) => expect(isPermitOpen(p)).toBe(open));
});
