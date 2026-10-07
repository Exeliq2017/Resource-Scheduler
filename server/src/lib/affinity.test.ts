import { describe, expect, it } from "vitest";
import { extractKeywords } from "./affinity.js";

describe("extractKeywords", () => {
  it("lowercases and splits on non-alphanumeric characters", () => {
    expect(extractKeywords("Motor Tuner Modifications - Livguard")).toEqual([
      "motor",
      "tuner",
      "modifications",
      "livguard",
    ]);
  });

  it("drops stopwords and short tokens", () => {
    expect(extractKeywords("Fix the API for new task")).toEqual(["fix", "api"]);
  });

  it("dedupes repeated keywords", () => {
    expect(extractKeywords("Testing testing Panasonic")).toEqual(["testing", "panasonic"]);
  });

  it("returns an empty array for an all-stopword name", () => {
    expect(extractKeywords("the new task")).toEqual([]);
  });
});
