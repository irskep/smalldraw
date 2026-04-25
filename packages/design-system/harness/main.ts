import { el } from "redom";
import "../src/styles.css";
import { stories } from "./stories/index";

function getStoryIdFromHash(): string {
  const storyId = window.location.hash.replace(/^#/, "").trim();
  return storyId.length > 0 ? storyId : stories[0]?.id ?? "";
}

const app = el("main.ds-harness") as HTMLElement;
const picker = el("select.ds-harness__picker", {
  "aria-label": "Story",
}) as HTMLSelectElement;
const stage = el("section.ds-harness__stage") as HTMLElement;
const title = el("h1.ds-harness__story-title") as HTMLHeadingElement;
const description = el("p.ds-harness__story-description") as HTMLParagraphElement;
const canvas = el("div.ds-harness__canvas") as HTMLDivElement;

for (const story of stories) {
  picker.append(el("option", { value: story.id }, story.title));
}

picker.addEventListener("change", () => {
  window.location.hash = picker.value;
});

stage.append(title, description, canvas);
app.append(picker, stage);
document.body.append(app);

function renderActiveStory(): void {
  const activeStoryId = getStoryIdFromHash();
  const activeStory = stories.find((story) => story.id === activeStoryId) ?? stories[0];
  if (!activeStory) {
    title.textContent = "No stories";
    description.textContent = "";
    canvas.replaceChildren();
    return;
  }
  picker.value = activeStory.id;
  title.textContent = activeStory.title;
  description.textContent = activeStory.description;
  activeStory.mount(canvas);
}

window.addEventListener("hashchange", () => {
  renderActiveStory();
});

renderActiveStory();
