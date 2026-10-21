import { getPortalMetadata } from "@smalldraw/shared";

export function updatePortalMetadata(pathname: string) {
  const { title, elements } = getPortalMetadata(pathname);
  document.title = title;
  for (const element of document.head.querySelectorAll(
    '[data-portal-metadata], meta[name="description"]',
  ))
    element.remove();
  for (const { tag, attributes, text } of elements) {
    const element = document.createElement(tag);
    element.setAttribute("data-portal-metadata", "");
    for (const [name, value] of Object.entries(attributes))
      element.setAttribute(name, value);
    if (text) element.textContent = text;
    document.head.append(element);
  }
}
