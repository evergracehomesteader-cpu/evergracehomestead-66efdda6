export const APP_VERSION = "0.1.0";
export const APP_LAST_UPDATED = "2026-05-30T20:00:00Z";
export const APP_PUBLISHED_URL = "https://evergracehomestead.lovable.app";

export type ChangelogEntry = {
  version: string;
  date: string;
  changes: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.1.0",
    date: "2026-05-30",
    changes: [
      "Initial versioned release",
      "Fixed sticky mobile side menu (auto-closes on navigation & outside tap)",
      "Added app version, last updated, and published URL display",
      "Added Changelog and App Updates maintenance page",
      "Security hardening: private photo buckets, disabled self-signup",
    ],
  },
];
