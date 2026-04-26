export interface HarnessStory {
  id: string;
  title: string;
  description: string;
  mount: (container: HTMLElement) => void;
}

export interface HarnessStoryGroup {
  id: string;
  title: string;
  stories: HarnessStory[];
}
