import { buildDrawingAppUrl } from "@smalldraw/shared";

export interface SplatDocumentUrlSummary {
  docUrl: string;
  collaborative?: boolean;
  collabDocUrl?: string;
  accountAttached?: boolean;
}

export function buildSplatCurrentDocumentUrl(
  currentHref: string,
  summary: SplatDocumentUrlSummary | null,
): string {
  const currentUrl = new URL(currentHref);
  const accountSessionExpected =
    currentUrl.searchParams.get("account") === "1" ||
    currentUrl.searchParams.has("doc");
  const preserveAccount = (href: string): string => {
    const url = new URL(href);
    if (accountSessionExpected && !url.searchParams.has("doc")) {
      url.searchParams.set("account", "1");
    }
    return url.toString();
  };
  if (!summary) {
    return preserveAccount(buildDrawingAppUrl(currentHref));
  }

  if (summary.accountAttached && summary.collabDocUrl) {
    return buildDrawingAppUrl(currentHref, {
      type: "account",
      documentId: toDocumentId(summary.collabDocUrl),
    });
  }

  return preserveAccount(
    buildDrawingAppUrl(currentHref, {
      type: "local",
      docUrl: summary.docUrl,
    }),
  );
}

function toDocumentId(docUrl: string): string {
  return docUrl.startsWith("automerge:")
    ? docUrl.slice("automerge:".length)
    : docUrl;
}
