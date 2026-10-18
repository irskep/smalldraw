import { el, setChildren } from "redom";
import { $accountSync, retryAccountSync } from "../documents/accountWorkspace";

/** Only problems need a persistent place in the drawing UI. */
export class AccountSyncNotice {
  readonly el = el("div", { role: "status" });
  private unsubscribe?: () => void;
  onmount() {
    this.unsubscribe = $accountSync.subscribe(({ error }) => {
      this.el.hidden = !error;
      setChildren(
        this.el,
        error
          ? [
              el("span", error),
              el(
                "button.ds-button",
                { type: "button", onclick: retryAccountSync },
                "Try again",
              ),
            ]
          : [],
      );
    });
  }
  onunmount() {
    this.unsubscribe?.();
  }
}
