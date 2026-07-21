// Aperçu live d'un meme (#1/#11) — reproduit fidèlement le rendu de l'overlay
// client dans un cadre 16/9. Position/taille/texte/couleur/opacité en direct.
import { Music } from 'lucide-react';

const ANCHORS = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];

// Fraction de la largeur du cadre utilisée pour la police (miroir de overlay.js).
function fontFrac(len) {
  return len < 20 ? 0.11 : len < 60 ? 0.075 : len < 120 ? 0.055 : 0.045;
}

export default function MemePreview({ opts = {}, text = '', previewUrl = null, fileType = '' }) {
  const anchor = ANCHORS.includes(opts.anchor) ? opts.anchor : 'center';
  const scale = Math.min(1, Math.max(0.1, Number(opts.scale) || 0.5));
  const margin = 3; // % du cadre
  const wPct = scale * 100;
  const hPct = scale * 100; // cadre et stage tous deux 16/9 → même fraction dans les 2 axes

  let left;
  if (anchor.includes('left')) left = margin;
  else if (anchor.includes('right')) left = 100 - wPct - margin;
  else left = (100 - wPct) / 2;
  let top;
  if (anchor.includes('top')) top = margin;
  else if (anchor.includes('bottom')) top = 100 - hPct - margin;
  else top = (100 - hPct) / 2;

  const isImg = fileType.startsWith('image');
  const isVideo = fileType.startsWith('video');
  const isAudio = fileType.startsWith('audio');
  const hasMedia = previewUrl && (isImg || isVideo || isAudio);
  const textColor = /^#[0-9a-fA-F]{6}$/.test(opts.textColor || '') ? opts.textColor : '#ffffff';
  const textPos = ['top', 'center', 'bottom'].includes(opts.textPos) ? opts.textPos : 'bottom';
  const fontSize = `${fontFrac((text || '').length) * 100}cqw`;

  const textEl = text ? (
    <div style={{
      position: 'absolute', left: 0, right: 0, padding: '4%',
      top: textPos === 'top' ? 0 : textPos === 'center' ? '50%' : 'auto',
      bottom: textPos === 'bottom' ? 0 : 'auto',
      transform: textPos === 'center' ? 'translateY(-50%)' : 'none',
      textAlign: 'center', color: textColor, fontWeight: 800, lineHeight: 1.1,
      fontSize, textShadow: '0 0 0.15em #000, 0.03em 0.03em 0.05em #000', wordBreak: 'break-word',
    }}>{text}</div>
  ) : null;

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-border bg-black"
      style={{ aspectRatio: '16 / 9', backgroundImage: 'repeating-conic-gradient(#1a1a1f 0% 25%, #141418 0% 50%)', backgroundSize: '24px 24px' }}>
      <div style={{
        position: 'absolute', left: `${left}%`, top: `${top}%`, width: `${wPct}%`,
        aspectRatio: '16 / 9', containerType: 'size', opacity: Math.min(1, Math.max(0.1, Number(opts.opacity) ?? 0.95)),
        borderRadius: '6%', overflow: 'hidden',
      }}>
        {hasMedia && isImg && <img src={previewUrl} alt="" className="w-full h-full object-contain bg-black" />}
        {hasMedia && isVideo && <video src={previewUrl} className="w-full h-full object-contain bg-black" muted loop autoPlay playsInline />}
        {(hasMedia && isAudio) || (!hasMedia && !text) ? (
          <div className="w-full h-full grid place-items-center bg-gradient-to-br from-accent/30 to-surface-2">
            <Music className="text-white/80" style={{ width: '30%', height: '30%' }} />
          </div>
        ) : null}
        {!hasMedia && text ? (
          <div className="w-full h-full bg-gradient-to-br from-accent/25 to-surface-2" />
        ) : null}
        {textEl}
      </div>
    </div>
  );
}
