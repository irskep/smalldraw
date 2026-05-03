import { el } from "redom";
import "../src/styles.css";
import "./stories/ResizeHandle.css";
import { stories, storyGroups } from "./stories/index";
import type { HarnessStory, HarnessStoryGroup } from "./stories/index";

function getTestStoryId(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("test-story")?.trim() ?? "";
}

function getActiveGroupIdFromHash(): string {
  const groupId = window.location.hash.replace(/^#/, "").trim();
  return groupId.length > 0 ? groupId : storyGroups[0]?.id ?? "";
}

function findStoryById(storyId: string): HarnessStory | undefined {
  return stories.find((story) => story.id === storyId);
}

function findGroupById(groupId: string): HarnessStoryGroup | undefined {
  return storyGroups.find((group) => group.id === groupId);
}

function renderTestStory(story: HarnessStory): HTMLElement {
  const app = el("main.ds-harness.ds-harness--test") as HTMLElement;
  const stage = el("section.ds-harness__stage") as HTMLElement;
  const title = el("h1.ds-harness__story-title", story.title) as HTMLHeadingElement;
  const description = el(
    "p.ds-harness__story-description",
    story.description,
  ) as HTMLParagraphElement;
  const canvas = el("div.ds-harness__canvas") as HTMLDivElement;

  story.mount(canvas);
  stage.append(title, description, canvas);
  app.append(stage);
  return app;
}

function renderGroupStory(story: HarnessStory): HTMLElement {
  const card = el("section.ds-harness__story-card") as HTMLElement;
  const title = el("h2.ds-harness__story-card-title", story.title) as HTMLHeadingElement;
  const description = el(
    "p.ds-harness__story-description",
    story.description,
  ) as HTMLParagraphElement;
  const canvas = el("div.ds-harness__canvas") as HTMLDivElement;

  story.mount(canvas);
  card.append(title, description, canvas);
  return card;
}

function renderGroupedHarness(activeGroup: HarnessStoryGroup): HTMLElement {
  const app = el("main.ds-harness") as HTMLElement;
  const shell = el("div.ds-harness__shell") as HTMLDivElement;
  const sidebar = el("aside.ds-harness__sidebar") as HTMLElement;
  const sidebarTitle = el("h1.ds-harness__sidebar-title", "Stories") as HTMLHeadingElement;
  const groupList = el("nav.ds-harness__group-list", {
    "aria-label": "Story groups",
  }) as HTMLElement;
  const stage = el("section.ds-harness__stage") as HTMLElement;
  const groupTitle = el(
    "h1.ds-harness__story-title",
    activeGroup.title,
  ) as HTMLHeadingElement;
  const storyStack = el("div.ds-harness__story-stack-list") as HTMLDivElement;

  for (const group of storyGroups) {
    const link = el(
      "button.ds-harness__group-link",
      {
        type: "button",
        "data-group-id": group.id,
      },
      group.title,
    ) as HTMLButtonElement;
    link.classList.toggle("is-active", group.id === activeGroup.id);
    link.addEventListener("click", () => {
      window.location.hash = group.id;
    });
    groupList.append(link);
  }

  for (const story of activeGroup.stories) {
    storyStack.append(renderGroupStory(story));
  }

  sidebar.append(sidebarTitle, groupList);
  stage.append(groupTitle, storyStack);
  shell.append(sidebar, stage);
  app.append(shell);
  return app;
}

function render(): void {
  const testStoryId = getTestStoryId();
  const story = testStoryId ? findStoryById(testStoryId) : null;
  const root =
    story ??
    findGroupById(getActiveGroupIdFromHash()) ??
    storyGroups[0];

  document.body.replaceChildren();

  if ("mount" in root) {
    document.body.append(renderTestStory(root));
    return;
  }

  document.body.append(renderGroupedHarness(root));
}

window.addEventListener("hashchange", render);
window.addEventListener("popstate", render);

render();
