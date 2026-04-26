import { buttonStories } from "./buttonStories";
import { dialogStories } from "./dialogStories";
import { gridStories } from "./gridStories";
import { iconButtonStories } from "./iconButtonStories";
import type { HarnessStory, HarnessStoryGroup } from "./types";

export type { HarnessStory, HarnessStoryGroup } from "./types";

export const storyGroups: HarnessStoryGroup[] = [
  {
    id: "buttons",
    title: "Buttons",
    stories: [...iconButtonStories, ...buttonStories],
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
];

export const stories: HarnessStory[] = storyGroups.flatMap((group) => group.stories);
