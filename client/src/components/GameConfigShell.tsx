import React from 'react';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  Play,
} from 'lucide-react';
import { PortalLedge } from './PortalLedge';

/** Mengambil pesan kesalahan yang aman dibaca pengguna dari nilai error bertipe unknown. */
export function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'pesan' in err) {
    const pesan = (err as { pesan?: unknown }).pesan;
    if (typeof pesan === 'string' && pesan.trim().length > 0) {
      return pesan;
    }
  }
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message;
  }
  return fallback;
}

interface GameConfigPageShellProps {
  loading: boolean;
  loadingText: string;
  title: string;
  subtitle: string;
  onBack: () => void;
  errorMessage: string | null;
  templateTitle?: string | null;
  isOfficialTemplate?: boolean;
  questionCount?: number;
  extraTags?: React.ReactNode;
  missingTemplateMessage?: string;
  children: React.ReactNode;
}

/** kerangka halaman konfigurasi game bernuansa papan tulis kapur agar seragam di semua game. */
export function GameConfigPageShell({
  loading,
  loadingText,
  title,
  subtitle,
  onBack,
  errorMessage,
  templateTitle,
  isOfficialTemplate = false,
  questionCount = 0,
  extraTags,
  missingTemplateMessage = 'Tidak dapat memuat pengaturan karena materi kuis belum tersedia.',
  children,
}: GameConfigPageShellProps) {
  if (loading) {
    return (
      <div className="portal-bg relative">
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#f2c230] mb-3" />
          <p className="portal-cv text-2xl text-[#f4ecd8]">{loadingText}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-bg relative">
      {/* Filter SVG tekstur kapur tulis kasar khusus judul materi */}
      <svg aria-hidden="true" width="0" height="0" className="absolute pointer-events-none">
        <defs>
          <filter
            id="discere-chalk-title"
            x="-5%"
            y="-15%"
            width="110%"
            height="130%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              seed="7"
              result="grain"
            />
            <feColorMatrix
              in="grain"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.0 0 0 0 -0.16"
              result="alphaGrain"
            />
            <feTurbulence
              type="turbulence"
              baseFrequency="0.055"
              numOctaves="2"
              seed="11"
              result="brushEdge"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="brushEdge"
              scale="2.2"
              xChannelSelector="R"
              yChannelSelector="G"
              result="roughLetters"
            />
            <feComposite in="roughLetters" in2="alphaGrain" operator="in" />
          </filter>
        </defs>
      </svg>

      <div className="max-w-6xl mx-auto w-full p-6 md:p-10 space-y-6 flex-1">
        {/* Header Bar Papan Tulis Kapur */}
        <div className="portal-head flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 pr-2">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="shrink-0 self-start pt-1">
            <button type="button" onClick={onBack} className="portal-btn ghost sm">
              <ArrowLeft className="w-4 h-4" /> Kembali
            </button>
          </div>
        </div>

        {/* Judul Materi Kuis Terpilih */}
        {templateTitle && (
          <div className="flex flex-col items-center text-center gap-3 pb-2">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#cfd9c3] inline-flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#f2c230]" /> Materi Kuis Terpilih
              </span>
              {isOfficialTemplate && (
                <span className="portal-tag xs yellow">Resmi Admin</span>
              )}
            </div>

            <h2
              className="text-5xl sm:text-6xl md:text-[72px] text-white leading-[1.12] tracking-wide break-words max-w-full"
              style={{
                fontFamily: "'Permanent Marker', 'Caveat Brush', cursive",
                filter: 'url(#discere-chalk-title)',
              }}
            >
              {templateTitle}
            </h2>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
              <span className="portal-tag yellow">{questionCount} Soal Tersedia</span>
              <span className="portal-tag green">Acak Berulang</span>
              {extraTags}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="portal-banner error">
            <AlertTriangle className="w-5 h-5 shrink-0 text-[#ffdcd9]" />
            <div className="flex-1">
              <p className="font-bold">{errorMessage}</p>
            </div>
          </div>
        )}

        {!templateTitle ? (
          <div className="portal-card p-8 text-center space-y-4">
            <p className="text-sm font-bold text-[#6b7d6c]">{missingTemplateMessage}</p>
            <button type="button" onClick={onBack} className="portal-btn red">
              <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Materi
            </button>
          </div>
        ) : (
          children
        )}
      </div>

      <PortalLedge />
    </div>
  );
}

interface GameConfigSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function GameConfigSection({ title, description, children }: GameConfigSectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="portal-cv text-2xl sm:text-3xl text-[#f4ecd8]">{title}</h2>
        <p className="text-xs text-[#cfd9c3] mt-0.5">{description}</p>
      </div>
      {children}
    </section>
  );
}

export interface GameModeFeature {
  icon: React.ReactNode;
  label: string;
}

interface GameModeCardProps {
  selected: boolean;
  variant: 'green' | 'red';
  disabled?: boolean;
  onClick?: () => void;
  badgeIcon: React.ReactNode;
  badgeLabel: string;
  rightBadge?: React.ReactNode;
  title: string;
  description: string;
  features: GameModeFeature[];
}

export function GameModeCard({
  selected,
  variant,
  disabled = false,
  onClick,
  badgeIcon,
  badgeLabel,
  rightBadge,
  title,
  description,
  features,
}: GameModeCardProps) {
  const isGreen = variant === 'green';

  let cardCls = 'portal-card border-[#e0d5b8] ';
  if (disabled) {
    cardCls += 'opacity-65 cursor-not-allowed';
  } else if (selected) {
    cardCls = isGreen
      ? 'bg-[#163a2b] text-[#f4ecd8] border-[#f2c230] shadow-[0_6px_0_rgba(0,0,0,0.3)] -translate-y-0.5 cursor-pointer'
      : 'bg-gradient-to-br from-[#c8362f] to-[#a92a24] text-[#f4ecd8] border-[#f2c230] shadow-[0_6px_0_rgba(0,0,0,0.3)] -translate-y-0.5 cursor-pointer';
  } else {
    cardCls += isGreen
      ? 'hover:border-[#f2c230] cursor-pointer'
      : 'hover:border-[#c8362f]/60 cursor-pointer';
  }

  let badgeCls = 'portal-tag uppercase tracking-wide ';
  if (isGreen) {
    badgeCls += 'yellow';
  } else {
    badgeCls += selected ? 'bg-[#f4ecd8] text-[#c8362f]' : 'red';
  }

  const descCls = selected
    ? isGreen
      ? 'text-[#cfd9c3]'
      : 'text-[#f4ecd8]/90'
    : 'text-[#6b7d6c]';

  const footerCls = selected
    ? isGreen
      ? 'border-[#f4ecd8]/20 text-[#f4ecd8]'
      : 'border-[#f4ecd8]/25 text-[#f4ecd8]'
    : 'border-[#e0d5b8] text-[#1d3b2e]';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`rounded-[24px] p-6 text-left transition-all flex flex-col justify-between gap-4 border-2 ${cardCls}`}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className={badgeCls}>
            {badgeIcon} {badgeLabel}
          </span>
          {selected ? (
            <CheckCircle2 className="w-6 h-6 text-[#f2c230]" />
          ) : (
            rightBadge || null
          )}
        </div>
        <h3 className="portal-cv text-2xl sm:text-[26px] leading-tight">{title}</h3>
        <p className={`text-xs leading-relaxed ${descCls}`}>{description}</p>
      </div>

      <div className={`grid grid-cols-2 gap-2 text-[11px] font-bold pt-3 border-t-2 border-dashed ${footerCls}`}>
        {features.map((feat, idx) => (
          <span key={idx} className="flex items-center gap-1.5">
            {feat.icon} {feat.label}
          </span>
        ))}
      </div>
    </button>
  );
}

interface GameConfigCardHeaderProps {
  icon: React.ReactNode;
  title: string;
  tagLabel: string;
  tagColor?: 'yellow' | 'green' | 'red';
}

export function GameConfigCardHeader({
  icon,
  title,
  tagLabel,
  tagColor = 'yellow',
}: GameConfigCardHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2 pb-3 border-b-2 border-dashed border-[#e0d5b8]">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="portal-cv text-2xl text-[#1d3b2e]">{title}</h3>
      </div>
      <span className={`portal-tag ${tagColor} font-mono`}>{tagLabel}</span>
    </div>
  );
}

interface GameConfigFooterProps {
  modeSummary?: string;
  canSubmit: boolean;
  submitting: boolean;
  isSolo: boolean;
  submitLabel: string;
  submittingLabel?: string;
}

export function GameConfigFooter({
  canSubmit,
  submitting,
  isSolo,
  submitLabel,
  submittingLabel = 'Mempersiapkan Sesi...',
}: GameConfigFooterProps) {
  return (
    <div className="pt-3 border-t-2 border-dashed border-[#e0d5b8] flex flex-col sm:flex-row items-center justify-end gap-3">
      <button
        type="submit"
        disabled={!canSubmit}
        className={`portal-btn w-full sm:w-auto justify-center ${
          isSolo ? 'red' : ''
        } ${
          !canSubmit
            ? 'opacity-50 cursor-not-allowed'
            : !isSolo
            ? '!bg-[#1d3b2e] !text-[#f4ecd8] hover:!bg-[#254b3b]'
            : ''
        }`}
      >
        <Play className="w-4 h-4 fill-current" />
        {submitting ? submittingLabel : submitLabel}
      </button>
    </div>
  );
}

