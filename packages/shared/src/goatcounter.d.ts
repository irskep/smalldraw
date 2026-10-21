/** GoatCounter's count.js browser API: https://www.goatcounter.com/help/js */
export interface GoatCounterCountOptions {
  path?: string;
  title?: string;
  referrer?: string;
  event?: boolean;
  no_session?: boolean;
}

export interface GoatCounterSettings {
  no_onload?: boolean;
  no_events?: boolean;
  allow_local?: boolean;
  allow_frame?: boolean;
  endpoint?: string;
}

export interface GoatCounterData {
  p: string | null;
  r: string;
  t: string;
  e: boolean;
  q: string;
  [key: string]: unknown;
}

export interface GoatCounterApi extends GoatCounterSettings {
  /** count.js adds location.search here, separately from the supplied path. */
  get_data(options?: GoatCounterCountOptions): GoatCounterData;
  count(options?: GoatCounterCountOptions): void;
  url(options?: GoatCounterCountOptions): string;
  filter(): string | false;
  bind_events(): void;
  get_query(name: string): string | undefined;
}

declare global {
  interface Window {
    /** Settings may exist before the async script installs its methods. */
    goatcounter?: Partial<GoatCounterApi>;
  }
}
