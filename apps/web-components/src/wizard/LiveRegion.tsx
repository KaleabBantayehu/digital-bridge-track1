import React, { useCallback, useState } from 'react';

export interface Announcement {
  text: string;
  /** Incremented on every announce so identical messages are spoken again. */
  seq: number;
}

/** One live region per widget. Always mounted; only its text content changes (WCAG 4.1.3). */
export const LiveRegion: React.FC<{ announcement: Announcement }> = ({ announcement }) => (
  <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
    {announcement.text}
    {/* Invisible toggle forces screen readers to re-read a repeated message. */}
    {announcement.seq % 2 === 1 ? '​' : ''}
  </div>
);

export function useAnnouncer() {
  const [announcement, setAnnouncement] = useState<Announcement>({ text: '', seq: 0 });
  const announce = useCallback((text: string) => setAnnouncement((prev) => ({ text, seq: prev.seq + 1 })), []);
  return { announcement, announce };
}

export type Announce = (text: string) => void;
