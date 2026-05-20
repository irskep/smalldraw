import "./DocumentAccessState.css";

import { el } from "redom";
import { Button } from "./Button";
import type { ReDomLike } from "./ReDomLike";
import { Text } from "./Text";

export interface DocumentAccessStateModel {
  title: string;
  description: string;
  message: string;
  loginUrl?: string;
  signupUrl?: string;
  retryLabel?: string;
  resetLabel?: string;
}

export class DocumentAccessState implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;

  #title: Text<"h1">;
  #description: Text<"p">;
  #message: HTMLPreElement;
  #loginLink: HTMLAnchorElement;
  #signupLink: HTMLAnchorElement;
  #retryButton: Button;
  #resetButton: Button;
  #utilityActions: HTMLDivElement;
  #authActions: HTMLDivElement;

  constructor(model: DocumentAccessStateModel) {
    this.#title = new Text({
      tag: "h1",
      kind: "title",
      className: "ds-document-access-state__title",
    });
    this.#description = new Text({
      tag: "p",
      kind: "body",
      tone: "secondary",
      className: "ds-document-access-state__description",
    });
    this.#message = el(
      "pre.ds-document-access-state__message",
    ) as HTMLPreElement;
    this.#loginLink = this.#createAuthLink(
      "Log In",
      "ds-document-access-state__auth-link--login ds-document-access-state__auth-link--primary",
    );
    this.#signupLink = this.#createAuthLink(
      "Sign Up",
      "ds-document-access-state__auth-link--signup ds-document-access-state__auth-link--neutral",
    );
    this.#retryButton = new Button({
      label: model.retryLabel ?? "Retry",
      tone: "neutral",
      className: "ds-document-access-state__retry-button",
    });
    this.#resetButton = new Button({
      label: model.resetLabel ?? "Reset Local Session",
      tone: "danger",
      className: "ds-document-access-state__reset-button",
    });

    const copy = el(
      "div.ds-document-access-state__copy",
      this.#title,
      this.#description,
    ) as HTMLDivElement;

    this.#utilityActions = el(
      "div.ds-document-access-state__action-group.ds-document-access-state__action-group--utility",
      this.#retryButton.el,
      this.#resetButton.el,
    ) as HTMLDivElement;
    this.#authActions = el(
      "div.ds-document-access-state__action-group.ds-document-access-state__action-group--auth",
      this.#signupLink,
      this.#loginLink,
    ) as HTMLDivElement;
    const actions = el(
      "div.ds-document-access-state__actions",
      this.#utilityActions,
      this.#authActions,
    ) as HTMLDivElement;

    this.el = el(
      "div.ds-document-access-state",
      copy,
      this.#message,
      actions,
    ) as HTMLDivElement;

    this.setModel(model);
  }

  setModel(model: DocumentAccessStateModel): void {
    this.#title.setText(model.title);
    this.#description.setText(model.description);
    this.#message.textContent = model.message;
    this.#setAuthLink(this.#loginLink, model.loginUrl);
    this.#setAuthLink(this.#signupLink, model.signupUrl);
    this.#retryButton.setLabel(model.retryLabel ?? "Retry");
    this.#resetButton.setLabel(model.resetLabel ?? "Reset Local Session");
  }

  setOnRetry(handler: (() => void) | null): void {
    this.#retryButton.setOnPress(handler ? () => handler() : null);
  }

  setOnReset(handler: (() => void) | null): void {
    this.#resetButton.setOnPress(handler ? () => handler() : null);
  }

  #createAuthLink(label: string, className: string): HTMLAnchorElement {
    const link = el(
      `a.ds-document-access-state__auth-link.${className.split(" ").join(".")}`,
      label,
    ) as HTMLAnchorElement;
    link.hidden = true;
    return link;
  }

  #setAuthLink(link: HTMLAnchorElement, href?: string): void {
    if (!href) {
      link.hidden = true;
      link.removeAttribute("href");
      return;
    }
    link.hidden = false;
    link.href = href;
  }
}

export function createDocumentAccessState(
  model: DocumentAccessStateModel,
): DocumentAccessState {
  return new DocumentAccessState(model);
}
