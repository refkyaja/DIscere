import React, { useMemo, useState, useEffect } from 'react';
import { Volume2, VolumeX, ArrowLeft, Pause, Play, StopCircle } from 'lucide-react';
import './balapKarungFestival.css';

export interface BalapSackSvgProps {
  shirtColor?: string;
  up?: boolean;
  crown?: boolean;
  medal?: boolean;
  sad?: boolean;
  className?: string;
}

export function BalapSackSvg({
  shirtColor = '#e2312d',
  up = false,
  crown = false,
  medal = false,
  sad = false,
  className = 'bk-runner-svg',
}: BalapSackSvgProps) {
  return (
    <svg viewBox="0 -12 80 112" className={className} aria-hidden="true">
      {/* Mahkota Emas Pemenang */}
      {crown && (
        <polygon
          points="24,14 27,2 34,9 40,0 46,9 53,2 56,14"
          fill="#ffb81c"
          stroke="#b87800"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}

      {/* Lengan Diangkat Saat Selebrasi / Juara */}
      {up ? (
        <>
          <line
            x1="27"
            y1="44"
            x2="13"
            y2="25"
            stroke="#ffd9a8"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <line
            x1="53"
            y1="44"
            x2="67"
            y2="25"
            stroke="#ffd9a8"
            strokeWidth="7"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <line
            x1="26"
            y1="44"
            x2="20"
            y2="56"
            stroke="#ffd9a8"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <line
            x1="54"
            y1="44"
            x2="60"
            y2="56"
            stroke="#ffd9a8"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </>
      )}

      {/* Baju Peserta / Tim */}
      <ellipse
        cx="40"
        cy="47"
        rx="16"
        ry="14"
        fill={shirtColor}
        stroke="#2b2a4a"
        strokeWidth="2.2"
      />

      {/* Karung Goni + Tambalan */}
      <path
        d="M21 50 Q18 82 24 94 Q40 99 56 94 Q62 82 59 50 Q40 55 21 50 Z"
        fill="#c98a4b"
        stroke="#6b4423"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M22 52 Q40 57 58 52"
        fill="none"
        stroke="#8d5c2b"
        strokeWidth="2.2"
        strokeDasharray="4 3"
      />
      <rect
        x="33"
        y="65"
        width="16"
        height="13"
        rx="2.5"
        transform="rotate(-7 41 71)"
        fill="#e9b778"
        stroke="#8d5c2b"
        strokeWidth="1.6"
      />
      <line x1="25" y1="60" x2="29" y2="75" stroke="#9e6632" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="54" y1="62" x2="51" y2="80" stroke="#9e6632" strokeWidth="1.4" strokeLinecap="round" />

      {/* Kepala & Ikat Kepala Merah-Putih */}
      <circle
        cx="40"
        cy="25"
        r="14"
        fill="#ffd9a8"
        stroke="#6b4423"
        strokeWidth="2.2"
      />
      {/* Rambut singkat */}
      <path
        d="M27 21 Q33 10 41 11 Q50 11 53 20 Q46 16 39 17 Q32 16 27 21 Z"
        fill="#3b2f2f"
      />
      {/* Ikat kepala Merah-Putih */}
      <path d="M27 18 Q40 15 53 18 L53 21 Q40 18 27 21 Z" fill="#e2312d" />
      <path d="M27 21 Q40 18 53 21 L53 23.5 Q40 20.5 27 23.5 Z" fill="#ffffff" />

      {/* Ekspresi Wajah */}
      {sad ? (
        <>
          <path d="M33 25 L37 29 M37 25 L33 29" stroke="#2b2a4a" strokeWidth="2.1" strokeLinecap="round" />
          <path d="M43 25 L47 29 M47 25 L43 29" stroke="#2b2a4a" strokeWidth="2.1" strokeLinecap="round" />
          <path d="M35 34 Q40 30 45 34" fill="none" stroke="#2b2a4a" strokeWidth="2.1" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="35" cy="26.5" r="2.1" fill="#2b2a4a" />
          <circle cx="45" cy="26.5" r="2.1" fill="#2b2a4a" />
          <circle cx="31.5" cy="30" r="2" fill="#f79f95" opacity="0.7" />
          <circle cx="48.5" cy="30" r="2" fill="#f79f95" opacity="0.7" />
          <path d="M35.5 31 Q40 35.5 44.5 31" fill="none" stroke="#2b2a4a" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {/* Medali Perak Juara 2 */}
      {medal && (
        <g transform="translate(40,56)">
          <circle cx="0" cy="0" r="8" fill="#d7e0eb" stroke="#64748b" strokeWidth="2" />
          <text
            x="0"
            y="3.5"
            textAnchor="middle"
            fontSize="10"
            fontWeight="900"
            fill="#1e293b"
            fontFamily="Baloo 2, sans-serif"
          >
            2
          </text>
        </g>
      )}
    </svg>
  );
}

export interface BalapLaneMemberDot {
  id: string;
  nama: string;
  pulse?: 'ok' | 'no' | null;
}

export interface BalapLaneItem {
  id: string;
  nama: string;
  warna: string;
  shirtColor: string;
  meter: number;
  meterRaw?: number;
  targetJarak: number;
  isWinner?: boolean;
  isRunnerUp?: boolean;
  isRunning?: boolean;
  isJumping?: boolean;
  isHurt?: boolean;
  sayBubble?: string | null;
  deltaBadge?: number | null;
  members?: BalapLaneMemberDot[];
}

export interface BalapKarungStadiumProps {
  title?: string;
  subtitle?: string;
  statusLabel: string;
  statusTone?: 'idle' | 'live' | 'done';
  targetJarak: number;
  ruleSummary: string;
  lanes: BalapLaneItem[];
  crowdCheer?: boolean;
  compactLanes?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onBack?: () => void;
  backLabel?: string;
  isPaused?: boolean;
  onTogglePause?: () => void;
  onStop?: () => void;
}

const SPECTATOR_COLORS = [
  ['#e2312d', '#ffb81c'],
  ['#1d8fe0', '#ffd23f'],
  ['#1f9d55', '#ffffff'],
  ['#7a3fd0', '#ff8a65'],
  ['#f97316', '#38bdf8'],
  ['#ec4899', '#fde047'],
];

export function BalapKarungStadium({
  title = 'Balap Karung Kuis',
  subtitle,
  statusLabel,
  statusTone = 'idle',
  targetJarak,
  ruleSummary,
  lanes,
  crowdCheer = false,
  compactLanes = false,
  isMuted,
  onToggleMute,
  onBack,
  backLabel = 'Kembali',
  isPaused,
  onTogglePause,
  onStop,
}: BalapKarungStadiumProps) {
  const spectators = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        idx: i,
        shirt: SPECTATOR_COLORS[i % SPECTATOR_COLORS.length][0],
        accent: SPECTATOR_COLORS[i % SPECTATOR_COLORS.length][1],
        delay: ((i * 137) % 1000) / 1000,
        hasFlag: i % 3 === 0,
      })),
    []
  );

  const buntings = useMemo(() => Array.from({ length: 30 }, (_, i) => i), []);

  const statusClass =
    statusTone === 'live' ? 'bk-chip live' : statusTone === 'done' ? 'bk-chip blue' : 'bk-chip';

  return (
    <section className="bk-stage">
      {/* Langit + Matahari + Awan + Pemandangan Desa */}
      <div className="bk-sky">
        {/* Top Floating HUD */}
        <div className="bk-top">
          <div className="bk-top-bar">
            <div className="bk-brand">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1.5 rounded-xl bg-[#fff3d6] border border-[#f0dfb4] text-[#2b2a4a] hover:bg-[#fde9b8] transition-colors cursor-pointer"
                  title={backLabel}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{backLabel}</span>
                </button>
              )}
              <span className="bk-h font-extrabold text-lg sm:text-xl text-[#2b2a4a] tracking-tight">
                {title}
              </span>
              {subtitle && (
                <span className="hidden md:inline-block bk-chip red">{subtitle}</span>
              )}
              <span className={statusClass}>{statusLabel}</span>
              <span className="bk-chip">Target {targetJarak} m</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="hidden sm:inline-block text-xs font-extrabold text-[#6b6a85] bg-[#fff3d6]/80 px-2.5 py-1 rounded-full border border-[#f0dfb4]">
                {ruleSummary}
              </span>

              {onTogglePause && (
                <button
                  type="button"
                  onClick={onTogglePause}
                  className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1.5 rounded-xl bg-[#fff3d6] border border-[#f0dfb4] text-[#2b2a4a] hover:bg-[#fde9b8] cursor-pointer"
                >
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  <span>{isPaused ? 'Lanjut' : 'Jeda'}</span>
                </button>
              )}

              {onStop && (
                <button
                  type="button"
                  onClick={onStop}
                  className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1.5 rounded-xl bg-[#fdecec] border border-[#f4b6b6] text-[#b81f1c] hover:bg-[#fbd5d5] cursor-pointer"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  <span>Akhiri</span>
                </button>
              )}

              {onToggleMute && (
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="p-1.5 rounded-xl bg-[#fff3d6] border border-[#f0dfb4] text-[#2b2a4a] hover:bg-[#fde9b8] cursor-pointer"
                  title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bk-sun" />
        <div
          className="bk-cloud"
          style={{ width: 92, height: 28, top: 22, left: '8%', animationDuration: '44s' }}
        />
        <div
          className="bk-cloud"
          style={{ width: 68, height: 22, top: 44, left: '36%', animationDuration: '58s', animationDelay: '-18s' }}
        />
        <div
          className="bk-cloud"
          style={{ width: 108, height: 30, top: 18, left: '68%', animationDuration: '50s', animationDelay: '-30s' }}
        />

        {/* Latar Perkampungan + Pepohonan + Bendera Merah-Putih */}
        <svg className="bk-town" viewBox="0 0 1200 150" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 150 L0 105 Q180 65 360 100 T760 95 T1200 102 L1200 150 Z" fill="#9fd685" />
          {[40, 230, 480, 690, 910, 1090].map((x, idx) => (
            <g key={x} transform={`translate(${x}, ${idx % 2 === 0 ? 52 : 60})`}>
              <rect x="6" y="34" width="66" height="44" fill="#ddcdb7" stroke="#bfa98e" strokeWidth="2" />
              <polygon points="0,36 39,10 78,36" fill="#d4452f" />
              <rect x="16" y="46" width="14" height="14" rx="2" fill="#fff6c2" />
              <rect x="46" y="46" width="16" height="32" rx="2" fill="#9e6b43" />
              <circle cx="96" cy="54" r="18" fill="#2f8f3f" />
              <circle cx="110" cy="58" r="14" fill="#3da44d" />
              <rect x="93" y="68" width="6" height="16" fill="#7c5230" />
            </g>
          ))}
          {/* Tiang Bendera Merah-Putih */}
          <g transform="translate(600, 18)">
            <rect x="0" y="0" width="4" height="96" fill="#6b7280" />
            <rect x="4" y="4" width="42" height="14" fill="#e2312d" />
            <rect x="4" y="18" width="42" height="14" fill="#ffffff" />
          </g>
        </svg>

        {/* Penonton Bersorak */}
        <div className={`bk-crowd ${crowdCheer ? 'cheer' : ''}`}>
          {spectators.map((sp) => (
            <svg
              key={sp.idx}
              className="bk-spec"
              viewBox="0 0 28 50"
              style={{ animationDelay: `${sp.delay}s` }}
              aria-hidden="true"
            >
              <circle cx="14" cy="14" r="7" fill="#ffd9a8" stroke="#6b4423" strokeWidth="1.5" />
              <path d="M7 11 Q14 4 21 11 Z" fill="#2b2a4a" />
              <rect x="6" y="22" width="16" height="22" rx="6" fill={sp.shirt} stroke="#2b2a4a" strokeWidth="1.5" />
              {sp.hasFlag && (
                <>
                  <line x1="23" y1="6" x2="23" y2="30" stroke="#7c5230" strokeWidth="1.6" />
                  <rect x="23" y="6" width="10" height="4" fill="#e2312d" />
                  <rect x="23" y="10" width="10" height="4" fill="#ffffff" />
                </>
              )}
              <circle cx="14" cy="29" r="3" fill={sp.accent} opacity="0.85" />
            </svg>
          ))}
        </div>
      </div>

      {/* Bendera Segitiga Merah-Putih + Tembok MERDEKA!! */}
      <div className="bk-bunt">
        {buntings.map((idx) => (
          <div key={idx} className={`bk-bunt-tri ${idx % 2 === 1 ? 'w' : ''}`} />
        ))}
      </div>
      <div className="bk-wall">
        <span className="bk-merdeka">MERDEKA!! • DIRGAHAYU • 17 AGUSTUS</span>
      </div>

      {/* Lintasan Balap Karung */}
      <div className="bk-track">
        <div className="bk-mk50">
          <span className="bk-mk50-tag">50%</span>
        </div>
        <div className="bk-finish">
          <span className="bk-finish-tag">FINISH</span>
        </div>

        {lanes.map((lane) => {
          const val = Math.min(lane.targetJarak, Math.max(0, lane.meterRaw ?? lane.meter));
          const frac = lane.targetJarak > 0 ? val / lane.targetJarak : 0;
          const leftExpr = `calc(3% + (94% - var(--rw)) * ${frac.toFixed(4)})`;
          const runnerClass = [
            'bk-runner',
            lane.isRunning ? 'run' : '',
            lane.isJumping ? 'jump' : '',
            lane.isHurt ? 'hurt' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={lane.id}
              className={`bk-lane ${compactLanes ? 'compact' : ''} ${lane.isWinner ? 'win' : ''}`}
            >
              <div className="bk-lane-info">
                <span className="bk-lane-dot" style={{ background: lane.warna }} />
                <span className="bk-lane-name">{lane.nama}</span>
                <span className="bk-lane-meter">{Math.round(lane.meter)} m</span>

                {lane.members && lane.members.length > 0 && (
                  <div className="bk-mem-dots" aria-label={`Anggota ${lane.nama}`}>
                    {lane.members.map((m) => (
                      <span
                        key={m.id}
                        title={m.nama}
                        className={`bk-m ${m.pulse === 'ok' ? 'ok' : m.pulse === 'no' ? 'no' : ''}`}
                        style={{ background: lane.warna }}
                      >
                        {(m.nama.trim()[0] || '?').toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className={runnerClass} style={{ left: leftExpr }}>
                {lane.sayBubble && <div className="bk-say">{lane.sayBubble}</div>}
                {!lane.sayBubble && lane.deltaBadge !== null && lane.deltaBadge !== undefined && lane.deltaBadge !== 0 && (
                  <div className={`bk-delta ${lane.deltaBadge > 0 ? 'up' : 'down'}`}>
                    {lane.deltaBadge > 0 ? `+${lane.deltaBadge} m` : `${lane.deltaBadge} m`}
                  </div>
                )}
                <BalapSackSvg
                  shirtColor={lane.shirtColor}
                  up={Boolean(lane.isWinner)}
                  crown={Boolean(lane.isWinner)}
                  medal={Boolean(lane.isRunnerUp)}
                  sad={Boolean(lane.isHurt)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bk-grass" />
      <div className="bk-river" />
    </section>
  );
}

/* ============================================================================
 * Komponen Heatmap Analisis Per-Soal x Per-Siswa (Dipakai di Host End & Riwayat)
 * ============================================================================ */

export interface HeatmapQuestionInfo {
  questionId: string;
  nomorSoal: number;
  teks: string;
  opsiList: Array<{ key: string; teks: string }>;
  jawabanBenarKode: string;
  jawabanBenarTeks: string;
  penjelasan: string | null;
  firstCorrectCount: number;
  firstSeenCount: number;
  persenBenar: number | null;
}

export interface HeatmapCell {
  questionId: string;
  ok: boolean | null;
  jawabanKey: string | null;
  jawabanTeks: string | null;
  timedOut: boolean;
  percobaanCount: number;
}

export interface HeatmapTeamGroup {
  timId: string;
  namaTim: string;
  warna: string;
  rows: Array<{
    pesertaId: string;
    nama: string;
    benarPertamaCount: number;
    dilihatCount: number;
    cells: HeatmapCell[];
  }>;
}

export interface AnalisisHeatmapData {
  questions: HeatmapQuestionInfo[];
  teams: HeatmapTeamGroup[];
  hardestQuestionId: string | null;
  defaultQuestionId: string | null;
}

export function BalapHeatmapMatrix({ heatmap }: { heatmap: AnalisisHeatmapData }) {
  const [selectedQId, setSelectedQId] = useState<string>(
    heatmap.defaultQuestionId || heatmap.questions[0]?.questionId || ''
  );

  useEffect(() => {
    setSelectedQId(heatmap.defaultQuestionId || heatmap.questions[0]?.questionId || '');
  }, [heatmap.defaultQuestionId, heatmap.questions]);

  const selectedQ =
    heatmap.questions.find((q) => q.questionId === selectedQId) || heatmap.questions[0];
  const selectedIdx = heatmap.questions.findIndex((q) => q.questionId === selectedQ?.questionId);

  if (!heatmap.questions || heatmap.questions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="bk-h text-xl font-extrabold text-[#2b2a4a]">
            Analisis Soal &amp; Jawaban Siswa
          </h3>
          <p className="text-xs font-bold text-[#6b6a85]">
            Klik nomor soal atau sel ✓ / ✗ untuk melihat detail jawaban pertama setiap siswa.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold text-[#6b6a85]">
          <span className="inline-flex items-center gap-1">
            <span className="bk-cell ok !w-5 !h-5 !text-[11px]">✓</span> Benar
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="bk-cell no !w-5 !h-5 !text-[11px]">✗</span> Salah
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="bk-cell na !w-5 !h-5 !text-[11px]">·</span> Belum dapat soal
          </span>
        </div>
      </div>

      {/* Tabel Matriks Heatmap */}
      <div className="bk-hm-wrap">
        <table className="bk-hm">
          <thead>
            <tr>
              <th className="nm">Nama Siswa</th>
              {heatmap.questions.map((q, idx) => (
                <th key={q.questionId}>
                  <button
                    type="button"
                    onClick={() => setSelectedQId(q.questionId)}
                    className={`bk-qbtn ${q.questionId === selectedQ?.questionId ? 'on' : ''}`}
                    title={`Soal ${idx + 1}: ${q.teks}`}
                  >
                    {idx + 1}
                  </button>
                </th>
              ))}
              <th>Benar</th>
            </tr>
          </thead>

          <tbody>
            {heatmap.teams.map((grp) => (
              <React.Fragment key={grp.timId}>
                <tr className="bk-hm-th">
                  <td colSpan={heatmap.questions.length + 2}>
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle"
                      style={{ background: grp.warna }}
                    />
                    {grp.namaTim} ({grp.rows.length} siswa)
                  </td>
                </tr>
                {grp.rows.length === 0 ? (
                  <tr>
                    <td colSpan={heatmap.questions.length + 2} className="text-xs italic text-[#6b6a85] py-2">
                      Belum ada anggota di tim ini
                    </td>
                  </tr>
                ) : (
                  grp.rows.map((row) => (
                    <tr key={row.pesertaId}>
                      <td className="nm font-bold text-[#2b2a4a]">{row.nama}</td>
                      {row.cells.map((cell) => (
                        <td key={cell.questionId}>
                          <button
                            type="button"
                            onClick={() => setSelectedQId(cell.questionId)}
                            className={`bk-cell ${
                              cell.ok === true ? 'ok' : cell.ok === false ? 'no' : 'na'
                            }`}
                            title={
                              cell.ok === null
                                ? 'Belum mendapat soal ini'
                                : cell.timedOut
                                ? 'Waktu habis'
                                : `Jawab: ${cell.jawabanTeks || cell.jawabanKey || '-'}`
                            }
                          >
                            {cell.ok === true ? '✓' : cell.ok === false ? '✗' : '·'}
                          </button>
                        </td>
                      ))}
                      <td className="font-extrabold text-[#2b2a4a] tabular-nums">
                        {row.benarPertamaCount}/{row.dilihatCount}
                      </td>
                    </tr>
                  ))
                )}
              </React.Fragment>
            ))}

            {/* Baris Persentase Benar Per Soal */}
            <tr className="bg-[#fffdf6] font-extrabold">
              <td className="nm text-xs uppercase tracking-wide text-[#6b6a85]">% Benar</td>
              {heatmap.questions.map((q) => (
                <td
                  key={q.questionId}
                  className={`text-xs font-extrabold ${
                    q.persenBenar === null
                      ? 'text-[#9e9cb3]'
                      : q.persenBenar >= 70
                      ? 'text-[#1f9d55]'
                      : q.persenBenar >= 40
                      ? 'text-[#c48300]'
                      : 'text-[#d63b3b]'
                  }`}
                >
                  {q.persenBenar === null ? '—' : `${q.persenBenar}%`}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Panel Drilldown Soal Terpilih */}
      {selectedQ && (
        <div className="rounded-2xl border-2 border-[#f0dfb4] bg-[#fffaf0] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bk-chip blue">Soal {selectedIdx + 1}</span>
            {heatmap.hardestQuestionId === selectedQ.questionId && (
              <span className="bk-chip red">Paling banyak salah</span>
            )}
            {selectedQ.persenBenar !== null && (
              <span className="bk-chip">
                {selectedQ.firstCorrectCount}/{selectedQ.firstSeenCount} benar pertama (
                {selectedQ.persenBenar}%)
              </span>
            )}
          </div>

          <h4 className="bk-h text-lg sm:text-xl font-extrabold text-[#2b2a4a] leading-snug">
            {selectedQ.teks}
          </h4>

          <div className="flex flex-wrap gap-2">
            {selectedQ.opsiList.map((op) => {
              const isKunci = op.key === selectedQ.jawabanBenarKode;
              return (
                <span
                  key={op.key}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border-2 ${
                    isKunci
                      ? 'bg-[#e9f9ef] border-[#1f9d55] text-[#136837]'
                      : 'bg-white border-[#f0dfb4] text-[#6b6a85]'
                  }`}
                >
                  <span className="font-mono">{op.key}.</span>
                  <span>{isKunci ? `✓ ${op.teks}` : op.teks}</span>
                </span>
              );
            })}
          </div>

          <p className="text-[11px] font-bold text-[#6b6a85] italic">
            Siswa mendapat soal secara acak, jadi mungkin ada yang belum atau sudah beberapa kali mendapat soal ini. Penilaian di tabel dihitung dari jawaban pertama mereka.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {heatmap.teams.map((grp) => (
              <div
                key={grp.timId}
                className="rounded-2xl bg-white border-2 p-3 space-y-2"
                style={{ borderColor: `${grp.warna}55` }}
              >
                <div className="flex items-center gap-2 pb-1.5 border-b border-[#f5ead0]">
                  <span className="w-3 h-3 rounded-full" style={{ background: grp.warna }} />
                  <span className="bk-h font-extrabold text-sm text-[#2b2a4a]">{grp.namaTim}</span>
                </div>
                {grp.rows.length === 0 ? (
                  <p className="text-xs text-[#6b6a85] italic">Tidak ada anggota.</p>
                ) : (
                  <div className="space-y-1.5">
                    {grp.rows.map((row) => {
                      const cell = row.cells.find((c) => c.questionId === selectedQ.questionId);
                      const seen = Boolean(cell && cell.ok !== null);
                      return (
                        <div
                          key={row.pesertaId}
                          className="flex items-start justify-between gap-2 text-xs bg-[#fffdf6] rounded-xl px-2.5 py-1.5 border border-[#f0dfb4]"
                        >
                          <div className="min-w-0">
                            <div className="font-extrabold text-[#2b2a4a] truncate">{row.nama}</div>
                            {!seen ? (
                              <div className="text-[11px] text-[#6b6a85]">Belum mendapat soal ini</div>
                            ) : cell?.ok ? (
                              <div className="text-[11px] text-[#1f9d55] font-bold">
                                ✓ Benar ({cell.jawabanKey})
                              </div>
                            ) : (
                              <div className="text-[11px] text-[#d63b3b] font-bold">
                                ✗{' '}
                                {cell?.timedOut
                                  ? 'Waktu habis'
                                  : `Jawab: ${cell?.jawabanTeks || cell?.jawabanKey || '-'}`}
                              </div>
                            )}
                            {cell && cell.percobaanCount > 1 && (
                              <div className="text-[10px] font-bold text-[#c48300]">
                                ⟳ muncul lagi {cell.percobaanCount - 1}× (nilai dari jawaban pertama)
                              </div>
                            )}
                          </div>
                          <span
                            className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                              !seen
                                ? 'bg-[#f4f3f8] text-[#6b6a85]'
                                : cell?.ok
                                ? 'bg-[#e6f8ed] text-[#1f9d55]'
                                : 'bg-[#fdecec] text-[#d63b3b]'
                            }`}
                          >
                            {!seen ? '—' : cell?.ok ? '✓ Benar' : '✗ Salah'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

