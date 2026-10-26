import { describe, expect, test } from "bun:test";

import {
  resolveSplatContextResponsiveState,
  SplatContextResponsiveController,
  settingsRailFitsWithoutShrinking,
} from "../src/view/SplatContextResponsiveController";

describe("SplatContextResponsiveController", () => {
  test("resolves responsive state from bounds", () => {
    expect(resolveSplatContextResponsiveState(960, 640)).toEqual({
      layout: "desktop",
      showMobileShare: true,
      showSettingsRail: false,
    });
    expect(resolveSplatContextResponsiveState(384, 640)).toEqual({
      layout: "mobile-standard",
      showMobileShare: false,
      showSettingsRail: false,
    });
    expect(resolveSplatContextResponsiveState(640, 320)).toEqual({
      layout: "mobile-landscape-short",
      showMobileShare: true,
      showSettingsRail: false,
    });
  });

  test("starts in desktop and requests rebuild when entering mobile", () => {
    const controller = new SplatContextResponsiveController({
      layout: "desktop",
      showMobileShare: true,
      showSettingsRail: false,
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
      showSettingsRail: false,
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
      showSettingsRail: false,
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
      showSettingsRail: false,
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
      showSettingsRail: false,
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
      showSettingsRail: false,
    });

    const update = controller.update(420, 640);

    expect(update.effect).toBe("sync-only");
    expect(update.layout).toBe("mobile-standard");
    expect(update.showMobileShare).toBeFalse();
  });
});

test("settings rail requires both enough width and height", () => {
  expect(
    resolveSplatContextResponsiveState(1024, 700).showSettingsRail,
  ).toBeTrue();
  expect(
    resolveSplatContextResponsiveState(1023, 700).showSettingsRail,
  ).toBeFalse();
  expect(
    resolveSplatContextResponsiveState(1024, 699).showSettingsRail,
  ).toBeFalse();
  const controller = new SplatContextResponsiveController();
  expect(controller.update(1280, 800).showSettingsRail).toBeTrue();
  expect(controller.update(1280, 699).showSettingsRail).toBeFalse();
});

const portraitFit = {
  documentWidth: 600,
  documentHeight: 900,
  availableWidth: 780,
  availableHeight: 540,
  railWidth: 112,
  railHeight: 470,
};
test("portrait pages expose spare horizontal space below the wide breakpoint", () => {
  expect(settingsRailFitsWithoutShrinking(portraitFit)).toBeTrue();
  expect(
    resolveSplatContextResponsiveState(900, 700, portraitFit).showSettingsRail,
  ).toBeTrue();
  expect(
    resolveSplatContextResponsiveState(900, 700, {
      ...portraitFit,
      documentWidth: 1200,
      documentHeight: 600,
    }).showSettingsRail,
  ).toBeFalse();
});
test("rail requires height and never shrinks the fitted page", () => {
  expect(
    settingsRailFitsWithoutShrinking({ ...portraitFit, availableHeight: 460 }),
  ).toBeFalse();
  expect(
    settingsRailFitsWithoutShrinking({ ...portraitFit, availableWidth: 472 }),
  ).toBeTrue();
  expect(
    settingsRailFitsWithoutShrinking({ ...portraitFit, availableWidth: 471 }),
  ).toBeFalse();
  expect(
    settingsRailFitsWithoutShrinking({ ...portraitFit, documentWidth: 0 }),
  ).toBeFalse();
});
test("small native drawings can also use spare space without being enlarged", () => {
  expect(
    settingsRailFitsWithoutShrinking({
      ...portraitFit,
      documentWidth: 300,
      documentHeight: 300,
    }),
  ).toBeTrue();
  expect(
    resolveSplatContextResponsiveState(390, 844, portraitFit).showSettingsRail,
  ).toBeFalse();
});
