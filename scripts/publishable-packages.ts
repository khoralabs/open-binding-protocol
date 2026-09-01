/**
 * Ordered publishable packages for unified releases (dependency order).
 */
export type PublishablePackage = {
  name: string;
  dir: string;
};

export const PUBLISH_ORDER: PublishablePackage[] = [
  { name: "@khoralabs/obp-core", dir: "packages/core" },
  { name: "@khoralabs/obp-algebra", dir: "packages/algebra" },
  { name: "@khoralabs/obp-nbc", dir: "packages/nbc" },
  { name: "@khoralabs/obp-wire", dir: "packages/wire" },
  { name: "@khoralabs/obp-react", dir: "packages/react" },
];

export function isSemver(version: string): boolean {
  return /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version);
}
