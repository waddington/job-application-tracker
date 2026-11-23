import { describe, expect, it } from "vitest";

import { fold, foldedOptionsFilter, foldIncludes } from "./fold";

describe("fold", () => {
  it("drops case and accents, as the server's fold does", () => {
    expect(fold("José Müller")).toBe("jose muller");
    expect(fold("ÉCOLE")).toBe("ecole");
    expect(fold("Straße")).toBe("strasse");
    expect(fold("Øster")).toBe("øster"); // ø isn't a letter plus an accent
  });

  it("matches either way round", () => {
    expect(foldIncludes("José Álvarez", "jose alv")).toBe(true);
    expect(foldIncludes("Jose Alvarez", "José")).toBe(true);
    expect(foldIncludes("Jose Alvarez", "  ")).toBe(true);
    expect(foldIncludes("Jose Alvarez", "Maria")).toBe(false);
  });
});

describe("foldedOptionsFilter", () => {
  const options = [
    { value: "1", label: "José Álvarez" },
    { group: "Agencies", items: [{ value: "2", label: "Société Recruitment" }] },
    { value: "3", label: "Sam Patel" },
  ];

  it("finds accented options from unaccented typing, inside groups too", () => {
    expect(foldedOptionsFilter({ options, search: "jose", limit: 10 })).toEqual([
      options[0],
      { group: "Agencies", items: [] },
    ]);
    expect(foldedOptionsFilter({ options, search: "SOCIETE", limit: 10 })).toEqual([
      { group: "Agencies", items: [{ value: "2", label: "Société Recruitment" }] },
    ]);
  });

  it("stops at the limit", () => {
    expect(foldedOptionsFilter({ options, search: "", limit: 1 })).toEqual([options[0]]);
  });
});
