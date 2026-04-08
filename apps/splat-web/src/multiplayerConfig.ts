export interface BrowserLocationLike {
  origin: string;
  protocol: string;
  hostname: string;
}

export interface BrowserMultiplayerConfig {
  syncServerHttpUrl: string;
  syncServerWebSocketUrl: string;
  joinBaseUrl: string;
}

export function createBrowserMultiplayerConfig(
  location: BrowserLocationLike,
): BrowserMultiplayerConfig {
  const httpProtocol = location.protocol === "https:" ? "https:" : "http:";
  const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
  const apiOrigin = `${httpProtocol}//${location.hostname}:3030`;
  const websocketOrigin = `${wsProtocol}//${location.hostname}:3030`;

  return {
    syncServerHttpUrl: `${apiOrigin}/api`,
    syncServerWebSocketUrl: websocketOrigin,
    joinBaseUrl: location.origin,
  };
}
