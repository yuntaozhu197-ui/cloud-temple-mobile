export type AbbotAccessoryId = "heart-lotus" | "pine-jade" | "bamboo-sachet" | "ripple-fish" | "echo-bell" | "lotus-brooch" | "sutra-scroll" | "cloud-ruyi" | "home-lantern";
export type AbbotAccessory = { readonly id: AbbotAccessoryId; readonly title: string; readonly name: string; readonly description: string; readonly placement: "chest" | "waist"; readonly color: string };
export const ABBOT_ACCESSORIES: readonly AbbotAccessory[];
export function getAbbotAccessory(id: unknown): AbbotAccessory | undefined;
export function getAccessoryForTitle(title: string): AbbotAccessory | undefined;
