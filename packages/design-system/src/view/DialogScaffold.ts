import "./DialogChrome.css";
import "./DialogScaffold.css";

import { setChildren } from "redom";
import type { ReDomLike } from "./ReDomLike";
import { Text } from "./Text";
import { toReDomChildren, type ReDomChild } from "./redomChildren";

const DIALOG_CLOSE_ANIMATION_MS = 220;

function applyClassTokens(
  element: HTMLElement,
  baseClass: string,
  nextClasses: string,
  previousClasses: string[],
): string[] {
  for (const className of previousClasses) {
    element.classList.remove(className);
  }
  const classes = nextClasses
    .split(/\s+/)
    .filter(Boolean)
    .filter((className) => className !== baseClass);
  for (const className of classes) {
    element.classList.add(className);
  }
  return classes;
}

export class DialogScaffold implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;

  #dialog: HTMLDialogElement;
  #surface: HTMLDivElement;
  #header: HTMLDivElement;
  #headerBar: HTMLDivElement;
  #leading: HTMLDivElement;
  #heading: HTMLDivElement;
  #title: Text<"h2">;
  #subtitle: Text<"p">;
  #trailing: HTMLDivElement;
  #body: HTMLDivElement;
  #footer: HTMLDivElement;
  #closeTimer: ReturnType<typeof setTimeout> | null = null;
  #isClosing = false;
  #dismissAction: (() => void) | null = null;
  #surfaceClasses: string[] = [];
  #dialogClasses: string[] = [];
  #pendingShow = false;

  constructor() {
    this.#leading = document.createElement("div");
    this.#leading.className = "ds-dialog-scaffold__leading";
    this.#trailing = document.createElement("div");
    this.#trailing.className = "ds-dialog-scaffold__trailing";
    this.#title = new Text({
      tag: "h2",
      kind: "title",
      className: "ds-dialog-scaffold__title",
    });
    this.#subtitle = new Text({
      tag: "p",
      kind: "body",
      tone: "secondary",
      className: "ds-dialog-scaffold__subtitle",
    });
    this.#heading = document.createElement("div");
    this.#heading.className = "ds-dialog-scaffold__heading";
    this.#heading.append(this.#title.el, this.#subtitle.el);
    this.#headerBar = document.createElement("div");
    this.#headerBar.className = "ds-dialog-scaffold__header-bar";
    this.#headerBar.append(this.#leading, this.#heading, this.#trailing);
    this.#header = document.createElement("div");
    this.#header.className = "ds-dialog-scaffold__header";
    this.#header.append(this.#headerBar);
    this.#body = document.createElement("div");
    this.#body.className = "ds-dialog-scaffold__body";
    this.#footer = document.createElement("div");
    this.#footer.className = "ds-dialog-scaffold__footer";
    this.#surface = document.createElement("div");
    this.#surface.className = "ds-dialog-surface ds-dialog-scaffold__surface";
    this.#surface.append(this.#header, this.#body, this.#footer);
    this.#dialog = document.createElement("dialog");
    this.#dialog.className = "ds-dialog ds-dialog-scaffold";
    this.#dialog.append(this.#surface);
    this.el = document.createElement("div");
    this.el.className = "ds-dialog-host ds-dialog-scaffold-host";
    this.el.append(this.#dialog);

    this.#subtitle.el.hidden = true;
    this.#leading.hidden = true;
    this.#trailing.hidden = true;
    this.#header.hidden = true;
    this.#footer.hidden = true;

    this.#dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.#dismissAction?.();
    });
    this.#dialog.addEventListener("click", (event) => {
      if (event.target === this.#dialog) {
        this.#dismissAction?.();
      }
    });
  }

  get dialogElement(): HTMLDialogElement {
    return this.#dialog;
  }

  setDialogClassName(className: string): void {
    this.#dialogClasses = applyClassTokens(
      this.#dialog,
      "ds-dialog",
      className,
      this.#dialogClasses,
    );
  }

  setSurfaceClassName(className: string): void {
    this.#surfaceClasses = applyClassTokens(
      this.#surface,
      "ds-dialog-surface",
      className,
      this.#surfaceClasses,
    );
  }

  setTitle(title: string): void {
    this.#title.setText(title);
    this.#syncHeaderVisibility();
  }

  setSubtitle(subtitle: string | null): void {
    const hasSubtitle = subtitle !== null && subtitle.trim().length > 0;
    this.#subtitle.setText(subtitle ?? "");
    this.#subtitle.el.hidden = !hasSubtitle;
    this.#syncHeaderVisibility();
  }

  setTitleAlignment(alignment: "start" | "center"): void {
    this.#heading.dataset.align = alignment;
  }

  setLeading(children: ReDomChild | readonly ReDomChild[] | null): void {
    const nextChildren = toReDomChildren(children);
    setChildren(this.#leading, nextChildren);
    this.#leading.hidden = nextChildren.length === 0;
    this.#syncHeaderVisibility();
  }

  setTrailing(children: ReDomChild | readonly ReDomChild[] | null): void {
    const nextChildren = toReDomChildren(children);
    setChildren(this.#trailing, nextChildren);
    this.#trailing.hidden = nextChildren.length === 0;
    this.#syncHeaderVisibility();
  }

  setBody(children: ReDomChild | readonly ReDomChild[]): void {
    setChildren(this.#body, toReDomChildren(children));
  }

  setBodyScrollable(scrollable: boolean): void {
    this.#body.dataset.scrollable = scrollable ? "true" : "false";
  }

  setFooter(children: ReDomChild | readonly ReDomChild[] | null): void {
    const nextChildren = toReDomChildren(children);
    setChildren(this.#footer, nextChildren);
    this.#footer.hidden = nextChildren.length === 0;
  }

  setFooterAlignment(alignment: "start" | "end"): void {
    this.#footer.dataset.align = alignment;
  }

  setOnDismiss(handler: (() => void) | null): void {
    this.#dismissAction = handler;
  }

  show(): void {
    if (!this.#dialog.isConnected) {
      this.#pendingShow = true;
      return;
    }
    if (typeof this.#dialog.showModal !== "function") {
      this.#dialog.setAttribute("open", "");
      this.#dialog.classList.remove("is-closing");
      this.#isClosing = false;
      return;
    }
    if (!this.#dialog.open) {
      this.#dialog.showModal();
    }
    this.#dialog.classList.remove("is-closing");
    this.#isClosing = false;
  }

  onmount(): void {
    if (!this.#pendingShow) {
      return;
    }
    this.#pendingShow = false;
    this.show();
  }

  async close(options?: { animated?: boolean }): Promise<void> {
    this.#pendingShow = false;
    if (!this.#dialog.open) {
      return;
    }
    if (!options?.animated) {
      if (typeof this.#dialog.close === "function") {
        this.#dialog.close();
      } else {
        this.#dialog.removeAttribute("open");
      }
      return;
    }
    if (this.#isClosing) {
      return;
    }
    this.#isClosing = true;
    this.#dialog.classList.add("is-closing");
    await new Promise<void>((resolve) => {
      const onDone = () => {
        if (this.#closeTimer !== null) {
          clearTimeout(this.#closeTimer);
          this.#closeTimer = null;
        }
        this.#dialog.removeEventListener("animationend", onDone);
        resolve();
      };
      this.#closeTimer = setTimeout(onDone, DIALOG_CLOSE_ANIMATION_MS);
      this.#dialog.addEventListener("animationend", onDone);
    });
    this.#dialog.classList.remove("is-closing");
    if (typeof this.#dialog.close === "function") {
      this.#dialog.close();
    } else {
      this.#dialog.removeAttribute("open");
    }
    this.#isClosing = false;
  }

  onunmount(): void {
    if (this.#closeTimer !== null) {
      clearTimeout(this.#closeTimer);
      this.#closeTimer = null;
    }
    this.#dialog.classList.remove("is-closing");
    this.#isClosing = false;
    this.#pendingShow = false;
    if (this.#dialog.open) {
      if (typeof this.#dialog.close === "function") {
        this.#dialog.close();
      } else {
        this.#dialog.removeAttribute("open");
      }
    }
  }

  #syncHeaderVisibility(): void {
    const hasTitle = this.#title.el.textContent?.trim().length;
    const hasSubtitle = !this.#subtitle.el.hidden;
    const hasLeading = !this.#leading.hidden;
    const hasTrailing = !this.#trailing.hidden;
    this.#header.hidden = !hasTitle && !hasSubtitle && !hasLeading && !hasTrailing;
  }
}

export function createDialogScaffold(): DialogScaffold {
  return new DialogScaffold();
}
