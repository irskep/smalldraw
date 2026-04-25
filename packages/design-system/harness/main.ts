import { el } from "redom";
import "../src/styles.css";
import { stories } from "./stories/index";

function getStoryIdFromHash(): string {
  const storyId = window.location.hash.replace(/^#/, "").trim();
  return storyId.length > 0 ? storyId : stories[0]?.id ?? "";
}

const app = el("main.ds-harness") as HTMLElement;
const nav = el("aside.ds-harness__nav") as HTMLElement;
const storyList = el("div.ds-harness__story-list") as HTMLDivElement;
const stage = el("section.ds-harness__stage") as HTMLElement;
const title = el("h1.ds-harness__story-title") as HTMLHeadingElement;
const description = el("p.ds-harness__story-description") as HTMLParagraphElement;
const canvas = el("div.ds-harness__canvas") as HTMLDivElement;

stage.append(title, description, canvas);
app.append(el("div.ds-harness__shell", nav, stage));
nav.append(storyList);
document.body.append(app);

function renderNav(activeStoryId: string): void {
  storyList.replaceChildren();
  for (const story of stories) {
    const link = el(
      "button.ds-harness__story-link",
      {
        type: "button",
        "data-story-id": story.id,
      },
      story.title,
    ) as HTMLButtonElement;
    link.classList.toggle("is-active", story.id === activeStoryId);
    link.addEventListener("click", () => {
      window.location.hash = story.id;
    });
    storyList.append(link);
  }
}

function renderActiveStory(): void {
  const activeStoryId = getStoryIdFromHash();
  const activeStory = stories.find((story) => story.id === activeStoryId) ?? stories[0];
  if (!activeStory) {
    title.textContent = "No stories";
    description.textContent = "";
    canvas.replaceChildren();
    return;
  }
  title.textContent = activeStory.title;
  description.textContent = activeStory.description;
  activeStory.mount(canvas);
  renderNav(activeStory.id);
}

window.addEventListener("hashchange", () => {
  renderActiveStory();
});

renderActiveStory();
