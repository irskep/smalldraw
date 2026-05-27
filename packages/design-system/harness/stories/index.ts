import { buttonStories } from "./buttonStories";
import { contextStories } from "./contextStories";
import { dialogStories } from "./dialogStories";
import { gridStories } from "./gridStories";
import { iconButtonStories } from "./iconButtonStories";
import { menuStories } from "./menuStories";
import { pickerStories } from "./pickerStories";
import { referenceStories } from "./referenceStories";
import { resizeHandleStories } from "./resizeHandleStories";
import { stateStories } from "./stateStories";
import type { HarnessStory, HarnessStoryGroup } from "./types";
import { typographyStories } from "./typographyStories";

export type { HarnessStory, HarnessStoryGroup } from "./types";

export const storyGroups: HarnessStoryGroup[] = [
  {
    id: "reference",
    title: "Reference",
    stories: referenceStories,
  },
  {
    id: "contexts",
    title: "Contexts",
    stories: contextStories,
  },
  {
    id: "buttons",
    title: "Buttons",
    stories: [...iconButtonStories, ...buttonStories],
  },
  {
    id: "typography",
    title: "Typography",
    stories: typographyStories,
  },
  {
    id: "grids",
    title: "Grids",
    stories: gridStories,
  },
  {
    id: "dialogs",
    title: "Dialogs",
    stories: dialogStories,
  },
  {
    id: "states",
    title: "States",
    stories: stateStories,
  },
  {
    id: "menus",
    title: "Menus",
    stories: [...menuStories, ...pickerStories],
  },
  {
    id: "harness",
    title: "Harness",
    stories: resizeHandleStories,
  },
];

export const stories: HarnessStory[] = storyGroups.flatMap(
  (group) => group.stories,
);
