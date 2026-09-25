import { describe, it, expect } from "vitest";
import { groupSubaccounts } from "../subaccount-order";

const ids = (r: ReturnType<typeof groupSubaccounts>) => r.map((x) => `${x.isChild ? "-" : ""}${x.item.id}`);

describe("groupSubaccounts", () => {
  it("pega cada subcuenta debajo de su principal, respetando el orden", () => {
    const items = [
      { id: "a" },
      { id: "b" },
      { id: "a1", parentId: "a" },
      { id: "c" },
      { id: "a2", parentId: "a" },
      { id: "b1", parentId: "b" },
    ];
    expect(ids(groupSubaccounts(items))).toEqual(["a", "-a1", "-a2", "b", "-b1", "c"]);
  });

  it("una subcuenta sin su principal en la lista queda como de primer nivel", () => {
    const items = [{ id: "x1", parentId: "x" }, { id: "y" }];
    expect(ids(groupSubaccounts(items))).toEqual(["x1", "y"]);
  });
});
