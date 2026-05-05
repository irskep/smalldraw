import { describe, expect, test } from "bun:test";
import {
  resolveSplatContextResponsiveState,
  SplatContextResponsiveController,
} from "../src/view/SplatContextResponsiveController";

describe("SplatContextResponsiveController", () => {
  test("resolves responsive state from bounds", () => {
    expect(resolveSplatContextResponsiveState(960, 640)).toEqual({
      layout: "desktop",
      showMobileShare: true,
    });
    expect(resolveSplatContextResponsiveState(384, 640)).toEqual({
      layout: "mobile-standard",
      showMobileShare: false,
    });
    expect(resolveSplatContextResponsiveState(640, 320)).toEqual({
      layout: "mobile-landscape-short",
      showMobileShare: true,
    });
  });

  test("starts in desktop and requests rebuild when entering mobile", () => {
    const controller = new SplatContextResponsiveController({
      layout: "desktop",
      showMobileShare: true,
    });

    const update = controller.update(384, 640);

    expect(update.effect).toBe("rebuild");
    expect(update.layout).toBe("mobile-standard");
    expect(update.showMobileShare).toBeFalse();
  });

  test("patches between mobile layouts without rebuild", () => {
    const controller = new SplatContextResponsiveController({
      layout: "mobile-standard",
      showMobileShare: false,
    });

    const update = controller.update(640, 320);

    expect(update.effect).toBe("patch-mobile-layout");
    expect(update.layout).toBe("mobile-landscape-short");
    expect(update.showMobileShare).toBeTrue();
  });

  test("syncs only when staying in the same layout", () => {
    const controller = new SplatContextResponsiveController({
      layout: "mobile-standard",
      showMobileShare: false,
    });

    const update = controller.update(420, 640);

    expect(update.effect).toBe("sync-only");
    expect(update.layout).toBe("mobile-standard");
    expect(update.showMobileShare).toBeFalse();
  });

  test("uses the mobile share threshold independently of layout transitions", () => {
    const controller = new SplatContextResponsiveController({
      layout: "mobile-standard",
      showMobileShare: false,
    });

    const hiddenUpdate = controller.update(479, 640);
    const visibleUpdate = controller.update(480, 640);

    expect(hiddenUpdate.showMobileShare).toBeFalse();
    expect(visibleUpdate.showMobileShare).toBeTrue();
    expect(visibleUpdate.effect).toBe("sync-only");
  });

  test("requests rebuild when returning to desktop", () => {
    const controller = new SplatContextResponsiveController({
      layout: "mobile-landscape-short",
      showMobileShare: true,
    });

    const update = controller.update(960, 640);

    expect(update.effect).toBe("rebuild");
    expect(update.layout).toBe("desktop");
    expect(update.showMobileShare).toBeTrue();
  });

  test("syncs only when only share visibility changes", () => {
    const controller = new SplatContextResponsiveController({
      layout: "mobile-standard",
      showMobileShare: true,
    });

    const update = controller.update(420, 640);

    expect(update.effect).toBe("sync-only");
    expect(update.layout).toBe("mobile-standard");
    expect(update.showMobileShare).toBeFalse();
  });
});
