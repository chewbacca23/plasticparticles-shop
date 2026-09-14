import { galleryMedia, mediaExists } from './media.ts';

export type ShotInput = {
  id: string;
  title: string;
  photo?: string | null;
  caption?: string | null;
  pubDate: Date;
  draft?: boolean;
};

export type RideInput = {
  id: string;
  headline: string;
  cover?: string | null;
  gallery?: readonly (string | null | undefined)[];
  pubDate?: Date | string | null;
  draft?: boolean;
};

export type FeedEntry = {
  id: string;
  photo: string;
  caption: string;
  date: Date;
  href: string | null;
};

/**
 * Ride photos without their own shot date sit under this so a new Shot
 * published in the editor always lands at the top of Now.
 */
export const RIDE_PHOTO_DATE = new Date('2026-08-01T00:00:00.000Z');

function captionFor(shot: ShotInput): string {
  const caption = shot.caption?.trim();
  if (caption) return caption;
  return shot.title.trim();
}

/**
 * Newest shots first. Ride photos fill any gaps so Now is never empty just
 * because Henrik has not posted a Shot yet. The same file is never shown twice.
 */
export function collectFeed(shots: readonly ShotInput[], rides: readonly RideInput[] = []): FeedEntry[] {
  const items: FeedEntry[] = [];
  const seen = new Set<string>();

  for (const shot of shots) {
    if (shot.draft) continue;
    if (!mediaExists(shot.photo)) continue;
    const photo = shot.photo as string;
    if (seen.has(photo)) continue;
    seen.add(photo);
    items.push({
      id: `shot:${shot.id}`,
      photo,
      caption: captionFor(shot),
      date: shot.pubDate,
      href: null,
    });
  }

  for (const ride of rides) {
    if (ride.draft) continue;
    const photos = galleryMedia(ride.cover, ride.gallery ?? []);
    for (const [index, photo] of photos.entries()) {
      if (seen.has(photo)) continue;
      seen.add(photo);
      items.push({
        id: `ride:${ride.id}:${index}`,
        photo,
        caption: ride.headline,
        date: ride.pubDate ? new Date(ride.pubDate) : RIDE_PHOTO_DATE,
        href: `/stories/${ride.id}`,
      });
    }
  }

  return items.sort((a, b) => {
    const byDate = b.date.valueOf() - a.date.valueOf();
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  });
}
