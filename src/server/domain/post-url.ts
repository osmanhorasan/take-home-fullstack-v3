export const PLATFORMS = ["tiktok", "instagram", "youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];

const TIKTOK =
  /^https?:\/\/((www|vm)\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/i;
const INSTAGRAM =
  /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels)\/[\w-]+/i;
const YOUTUBE =
  /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=[\w-]+|shorts\/[\w-]+)|youtu\.be\/[\w-]+)/i;

export function platformFromPostUrl(url: string): Platform | null {
  const trimmed = url.trim();
  if (TIKTOK.test(trimmed)) return "tiktok";
  if (INSTAGRAM.test(trimmed)) return "instagram";
  if (YOUTUBE.test(trimmed)) return "youtube";
  return null;
}

export function isUrlAllowedForCampaign(url: string, campaignPlatforms: Platform[]): Platform | null {
  const platform = platformFromPostUrl(url);
  if (!platform) return null;
  if (!campaignPlatforms.includes(platform)) return null;
  return platform;
}
