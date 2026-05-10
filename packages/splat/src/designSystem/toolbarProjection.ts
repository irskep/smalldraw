import type {
  PagedButtonGridLargeLayout,
  SplatToolItem,
} from "@smalldraw/design-system";
import type {
  KidsToolConfig,
  KidsToolFamilyConfig,
  ToolbarItem,
} from "../tools/kidsTools";
import {
  resolveNearestStrokeWidthOption,
  TOOLBAR_STROKE_WIDTH_OPTIONS,
} from "../ui/toolbarPresentation";
import type { ToolbarUiState } from "../ui/stores/toolbarUiStore";

export type VariantGridPresentation = {
  largeLayout: PagedButtonGridLargeLayout;
  paginateInLarge: boolean;
  buttonLayout: "small" | "large";
};

export type FamilyPresentation = {
  variantItems: SplatToolItem[];
  variantGridPresentation: VariantGridPresentation;
};

export type ToolPresentation = {
  activeSidebarItemId: string;
  familyId: string;
};

export type ToolbarPresentationState = {
  activeToolId: string;
  activeSidebarItemId: string;
  familyPresentation: FamilyPresentation;
  selectedStrokeWidth: number;
};

export type ToolbarProjectionModel = {
  fallbackToolId: string;
  fallbackFamilyId: string;
  toolById: Map<string, KidsToolConfig>;
  familyPresentationById: Map<string, FamilyPresentation>;
  toolPresentationById: Map<string, ToolPresentation>;
  toolItems: SplatToolItem[];
};

const DEFAULT_VARIANT_GRID_PRESENTATION: VariantGridPresentation = {
  largeLayout: "single-row",
  paginateInLarge: false,
  buttonLayout: "large",
};

export function createToolbarProjectionModel(options: {
  tools: KidsToolConfig[];
  families: KidsToolFamilyConfig[];
  sidebarItems: ToolbarItem[];
}): ToolbarProjectionModel {
  const toolById = new Map(options.tools.map((tool) => [tool.id, tool] as const));
  const fallbackFamilyId = options.families[0]?.id ?? "";
  const fallbackToolId =
    options.tools[0]?.id ?? options.families[0]?.defaultToolId ?? "";

  return {
    fallbackToolId,
    fallbackFamilyId,
    toolById,
    familyPresentationById: createFamilyPresentationById(
      options.families,
      toolById,
    ),
    toolPresentationById: createToolPresentationById(
      options.sidebarItems,
      options.families,
      toolById,
    ),
    toolItems: createToolItems(options.sidebarItems, options.families, toolById),
  };
}

export function resolveToolbarPresentationState(options: {
  state: ToolbarUiState;
  model: ToolbarProjectionModel;
}): ToolbarPresentationState {
  const activeToolId = resolveActiveToolId(
    options.state.activeToolId,
    options.model,
  );
  const activeFamilyId = resolveToolPresentation(activeToolId, options.model)
    .familyId;
  return {
    activeToolId,
    activeSidebarItemId: resolveToolPresentation(activeToolId, options.model)
      .activeSidebarItemId,
    familyPresentation: resolveFamilyPresentation(activeFamilyId, options.model),
    selectedStrokeWidth: resolveNearestStrokeWidthOption(
      options.state.strokeWidth,
      TOOLBAR_STROKE_WIDTH_OPTIONS,
    ),
  };
}

export function resolveFamilyPresentation(
  familyId: string,
  model: ToolbarProjectionModel,
): FamilyPresentation {
  return (
    model.familyPresentationById.get(familyId) ??
    model.familyPresentationById.get(model.fallbackFamilyId) ?? {
      variantItems: [],
      variantGridPresentation: DEFAULT_VARIANT_GRID_PRESENTATION,
    }
  );
}

export function resolveToolPresentation(
  toolId: string,
  model: ToolbarProjectionModel,
): ToolPresentation {
  return (
    model.toolPresentationById.get(toolId) ?? {
      activeSidebarItemId: `family:${model.fallbackFamilyId}`,
      familyId: model.fallbackFamilyId,
    }
  );
}

export function resolveActiveToolId(
  activeToolId: string,
  model: ToolbarProjectionModel,
): string {
  return model.toolById.has(activeToolId) ? activeToolId : model.fallbackToolId;
}

function createToolItems(
  sidebarItems: ToolbarItem[],
  families: KidsToolFamilyConfig[],
  toolById: ReadonlyMap<string, KidsToolConfig>,
): SplatToolItem[] {
  return sidebarItems.flatMap<SplatToolItem>((item) => {
    if (item.kind === "family") {
      const family = families.find((entry) => entry.id === item.familyId);
      if (!family) {
        return [];
      }
      return [
        {
          id: `family:${family.id}`,
          label: family.label,
          icon: family.icon,
          attributes: {
            "data-tool-family": family.id,
            title: family.label,
          },
        },
      ];
    }
    const tool = toolById.get(item.toolId);
    if (!tool) {
      return [];
    }
    return [
      {
        id: `tool:${tool.id}`,
        label: tool.label,
        icon: tool.icon,
        attributes: {
          "data-tool-id": tool.id,
          "data-tool-family": tool.familyId,
          title: tool.label,
        },
      },
    ];
  });
}

function createFamilyPresentationById(
  families: KidsToolFamilyConfig[],
  toolById: ReadonlyMap<string, KidsToolConfig>,
): Map<string, FamilyPresentation> {
  return new Map(
    families.map((family) => [
      family.id,
      {
        variantItems: family.toolIds.flatMap((toolId) => {
          const tool = toolById.get(toolId);
          if (!tool) {
            return [];
          }
          return [
            {
              id: tool.id,
              label: tool.label,
              icon: tool.icon,
              attributes: {
                "data-tool-variant": tool.id,
                "data-tool-family": tool.familyId,
                title: tool.label,
              },
            },
          ] as const;
        }),
        variantGridPresentation: family.variantGrid
          ? {
              largeLayout: family.variantGrid.largeLayout,
              paginateInLarge: family.variantGrid.paginateInLarge ?? false,
              buttonLayout: family.variantGrid.buttonLayout ?? "large",
            }
          : DEFAULT_VARIANT_GRID_PRESENTATION,
      },
    ]),
  );
}

function createToolPresentationById(
  sidebarItems: ToolbarItem[],
  families: KidsToolFamilyConfig[],
  toolById: ReadonlyMap<string, KidsToolConfig>,
): Map<string, ToolPresentation> {
  const familyById = new Map(families.map((family) => [family.id, family] as const));
  const presentationByToolId = new Map<string, ToolPresentation>();

  for (const item of sidebarItems) {
    if (item.kind === "family") {
      const family = familyById.get(item.familyId);
      if (!family) {
        continue;
      }
      for (const toolId of family.toolIds) {
        if (!presentationByToolId.has(toolId)) {
          presentationByToolId.set(toolId, {
            activeSidebarItemId: `family:${family.id}`,
            familyId: family.id,
          });
        }
      }
      continue;
    }
    const tool = toolById.get(item.toolId);
    if (!tool) {
      continue;
    }
    presentationByToolId.set(tool.id, {
      activeSidebarItemId: `tool:${tool.id}`,
      familyId: tool.familyId,
    });
  }

  return presentationByToolId;
}
