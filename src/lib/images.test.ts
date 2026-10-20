import { describe, expect, it } from "vitest";
import { imageWidthPercent, imageViewerWidth } from "./images";

describe("画像表示幅", () => {
  it("原本幅1300pxを基準に、画面幅を超えず、画像を引き伸ばさない", () => {
    expect(imageWidthPercent(1300)).toBe(100);
    expect(imageWidthPercent(650)).toBe(50);
    expect(imageWidthPercent(300)).toBeCloseTo(23.0769, 3);
    expect(imageWidthPercent(1600)).toBe(100);
  });

  it("拡大表示は実幅÷2px", () => {
    expect(imageViewerWidth(640)).toBe(320);
  });
});
