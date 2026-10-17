// ABOUTME: Tests for the address normalizer, using real messy strings from New Orleans permit, STR and code data.
// ABOUTME: Each case documents a pattern the matcher must handle (see docs/address-matching.md).
import { describe, expect, it } from "vitest";
import { normalizeStreet, parseAddress } from "../src/normalize";

describe("normalizeStreet", () => {
  it.each([
    ["Gravier Street", "GRAVIER ST"],
    ["Gravier St", "GRAVIER ST"],
    ["GRAVIER ST.", "GRAVIER ST"],
    ["Saint Charles Avenue", "SAINT CHARLES AVE"],
    ["St Charles Ave", "SAINT CHARLES AVE"],
    ["St. Claude Av", "SAINT CLAUDE AVE"],
    ["Ste Anne St", "SAINT ANNE ST"],
    ["North Villeré Street", "N VILLERE ST"],
    ["N Villere St", "N VILLERE ST"],
    ["Sài Gòn Drive", "SAI GON DR"],
    ["North d'Orgenois Street", "N DORGENOIS ST"],
    ["N Dorgenois St", "N DORGENOIS ST"],
    ["Second Street", "SECOND ST"],
    ["2nd St", "SECOND ST"],
    ["22nd Street", "TWENTY SECOND ST"],
    ["Martin Luther King, Jr. Boulevard", "MARTIN LUTHER KING JR BLVD"],
    ["Dr Martin Luther King Jr Blvd", "MARTIN LUTHER KING JR BLVD"],
    ["Gen Taylor St", "GENERAL TAYLOR ST"],
    ["South Norman C Francis Parkway", "S NORMAN C FRANCIS PKWY"],
    ["S Jefferson Davis Pkwy", "S JEFFERSON DAVIS PKWY"],
    ["Interstate 10 Service Road North", "INTERSTATE 10 SERVICE RD N"],
    ["Rev. John Raphael, Jr. Way", "REV JOHN RAPHAEL JR WAY"],
    ["O'Keefe Avenue", "OKEEFE AVE"],
    ["Trianon Plz", "TRIANON PLZ"],
    ["Avenue A", "AVENUE A"],
    ["St Ann", "SAINT ANN"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeStreet(input)).toBe(expected);
  });
});

describe("parseAddress", () => {
  it("parses a plain address", () => {
    expect(parseAddress("3210 Gravier Street")).toEqual({ numbers: [3210], suffix: null, street: "GRAVIER ST", unit: null, notes: [] });
  });

  it("strips city, state and zip after a comma", () => {
    expect(parseAddress("1125 Tennessee St, New Orleans, LA 70117")?.street).toBe("TENNESSEE ST");
  });

  it("splits units in their many spellings", () => {
    expect(parseAddress("2115 Saint Thomas St Apt 409")).toMatchObject({ numbers: [2115], street: "SAINT THOMAS ST", unit: "409" });
    expect(parseAddress("4223 Prytania St -Apt 2B")).toMatchObject({ street: "PRYTANIA ST", unit: "2B" });
    expect(parseAddress("3570 Holiday Dr Ste 2")).toMatchObject({ street: "HOLIDAY DR", unit: "2" });
    expect(parseAddress("7014 Lake Kenilworth Dr Apt U106")).toMatchObject({ street: "LAKE KENILWORTH DR", unit: "U106" });
    expect(parseAddress("1068 Magazine St, Unit 6")).toMatchObject({ street: "MAGAZINE ST", unit: "6" });
    expect(parseAddress("812 Royal St # 3")).toMatchObject({ street: "ROYAL ST", unit: "3" });
  });

  it("keeps bracketed notes out of the street", () => {
    expect(parseAddress("2601 Gentilly Blvd [Dillard U Bookstore]")).toMatchObject({ numbers: [2601], street: "GENTILLY BLVD", notes: ["Dillard U Bookstore"] });
  });

  it("expands ranges written in full, abbreviated, and with slashes", () => {
    expect(parseAddress("4100-4102 Hollygrove St")?.numbers).toEqual([4100, 4102]);
    expect(parseAddress("5415-5417 Elysian Fields Ave")?.numbers).toEqual([5415, 5417]);
    expect(parseAddress("1234-36 Saint Claude Ave")?.numbers).toEqual([1234, 1236]);
    expect(parseAddress("1620/22 Gentilly Blvd")?.numbers).toEqual([1620, 1622]);
    expect(parseAddress("3505/3507 Urquhart St")?.numbers).toEqual([3505, 3507]);
  });

  it("collects every number in a comma list on the same street", () => {
    expect(parseAddress("8632 Cohn St, 8634 Cohn St, 8636 Cohn St")).toMatchObject({ numbers: [8632, 8634, 8636], street: "COHN ST" });
    expect(parseAddress("1125 Tennessee St, 1125 Tennessee Street")).toMatchObject({ numbers: [1125], street: "TENNESSEE ST" });
  });

  it("keeps half and letter suffixes", () => {
    expect(parseAddress("1234 1/2 Burgundy St")).toMatchObject({ numbers: [1234], suffix: "1/2", street: "BURGUNDY ST" });
    expect(parseAddress("5620-C Read Blvd")).toMatchObject({ numbers: [5620], suffix: "C", street: "READ BLVD" });
    expect(parseAddress("1234A Dauphine St")).toMatchObject({ numbers: [1234], suffix: "A", street: "DAUPHINE ST" });
  });

  it("returns null for things that are not a single address", () => {
    expect(parseAddress("")).toBeNull();
    expect(parseAddress("Clouet St and Marais St")).toBeNull();
    expect(parseAddress("Lesseps (Burgundy to Rampart)")).toBeNull();
    expect(parseAddress("LA Hwy 406")).toBeNull();
  });

  it("parses 'Near' addresses but flags them", () => {
    expect(parseAddress("Near 6401 St Claude Ave")).toMatchObject({ numbers: [6401], street: "SAINT CLAUDE AVE", notes: ["near"] });
  });

  it("treats NOPD block addresses as a hundred-block", () => {
    expect(parseAddress("011XX Gravier St")).toMatchObject({ numbers: [1100], street: "GRAVIER ST", notes: ["block"] });
  });
});
