const STORAGE_KEY = 'islandstore_passport';

export const REWARDS = {
  ISLAND_HAT: 'hat_tophat',
  SPACE_TRACK: 'track_starlight',
  FINALE: 'finale_master',
};

function blank() {
  return { discovered: [], rewards: [], seenCount: 0 };
}

export function loadPassport() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        discovered: Array.isArray(parsed.discovered) ? parsed.discovered : [],
        rewards: Array.isArray(parsed.rewards) ? parsed.rewards : [],
        seenCount: Number(parsed.seenCount) || 0,
      };
    }
  } catch { /* ignore */ }
  return blank();
}

export function savePassport(passport) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(passport)); } catch { /* ignore */ }
  return passport;
}

export function isDiscovered(passport, productId) {
  return !!(passport && passport.discovered && passport.discovered.includes(productId));
}

export function withDiscovery(passport, productId) {
  if (isDiscovered(passport, productId)) return passport;
  return {
    ...passport,
    discovered: [...(passport.discovered || []), productId],
  };
}

export function withReward(passport, rewardId) {
  if (isRewardUnlocked(passport, rewardId)) return passport;
  return {
    ...passport,
    rewards: [...(passport.rewards || []), rewardId],
  };
}

export function isRewardUnlocked(passport, rewardId) {
  return !!(passport && passport.rewards && passport.rewards.includes(rewardId));
}

export function countDiscovered(passport, products) {
  if (!passport || !products || !products.length) return 0;
  return products.filter(p => isDiscovered(passport, p.id)).length;
}

export function withSeen(passport) {
  return {
    ...passport,
    seenCount: (passport.discovered || []).length,
  };
}

export function hasUnseenStamps(passport) {
  if (!passport) return false;
  return (passport.discovered || []).length > (passport.seenCount || 0);
}
