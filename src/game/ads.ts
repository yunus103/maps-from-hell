// The single place to plug in a rewarded ad (continue screen). Resolve false when the ad was skipped or failed.
// For now the continue is free.
export function showRewardedAd(): Promise<boolean> {
  return Promise.resolve(true);
}
