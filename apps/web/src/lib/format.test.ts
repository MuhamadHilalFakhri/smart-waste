import { describe, expect, it } from "vitest";
import { transitions, statuses } from "@smart-waste/api-client";
describe("workflow presentation", () => {
  it("keeps terminal states terminal", () => {
    expect(transitions.completed).toEqual([]);
    expect(transitions.rejected).toEqual([]);
  });
  it("labels every workflow status", () => {
    for (const status of Object.keys(transitions))
      expect(statuses).toHaveProperty(status);
  });
});
