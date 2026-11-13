'use client';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { Icon } from './Icon';

// A UNIER team pick: a clip from a trusted channel. Nothing loads from YouTube until the person taps play:
// the still picture comes through UNIER's own server, and the player is YouTube's privacy-enhanced one.
export function ClipSlide({ youtubeId, source, active }: { youtubeId: string; source: string; active: boolean }) {
  const { t } = useT();
  const [playing, setPlaying] = useState(false);
  useEffect(() => { if (!active) setPlaying(false); }, [active]);   // scrolling away stops the clip
  const thumb = `/api/clip/${youtubeId}`;
  return (
    <div className="clip" style={{ ['--thumb' as string]: `url(${thumb})` }}>
      <p className="clip-head"><span className="clip-team">{t('clip.team')}</span> <span>{t('clip.from', { source })}</span></p>
      <div className="clip-box">
        {playing ? (
          <iframe src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&playsinline=1&rel=0`} title={t('clip.from', { source })}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
        ) : (
          <button className="clip-play" onClick={() => setPlaying(true)} aria-label={`${t('clip.play')}: ${t('clip.from', { source })}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
            <span className="clip-btn" aria-hidden="true"><Icon name="play" /></span>
            <span className="clip-note">{t('clip.note')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
