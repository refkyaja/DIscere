import React, { useMemo, useState, useEffect, useId } from 'react';
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
      {/* Lengan Diangkat Saat Selebrasi / Juara */}
      {up && (
        <path
          d="M20 52L8 28M60 52L72 28"
          stroke="#ffd9a8"
          strokeWidth="8"
          strokeLinecap="round"
        />
      )}

      {/* Bayangan & Karung Goni */}
      <ellipse cx="40" cy="96" rx="22" ry="4" fill="rgba(0,0,0,0.2)" />
      <path
        d="M14 58L22 94Q40 100 58 94L66 58Z"
        fill="#c98a4b"
        stroke="#6b4423"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M20 66Q40 74 60 66" stroke="#6b4423" strokeWidth="2.5" fill="none" />
      <circle cx="40" cy="82" r="6" fill="#e9b778" stroke="#6b4423" strokeWidth="2" />

      {/* Baju Peserta / Tim */}
      <rect
        x="18"
        y="48"
        width="44"
        height="18"
        rx="9"
        fill={shirtColor}
        stroke="#2b2a4a"
        strokeWidth="3"
      />

      {/* Kepala & Ikat Kepala Merah-Putih */}
      <circle cx="40" cy="28" r="22" fill="#ffd9a8" stroke="#2b2a4a" strokeWidth="3" />
      <path
        d="M18 22Q40 4 62 22L62 29Q40 17 18 29Z"
        fill="#ffffff"
        stroke="#2b2a4a"
        strokeWidth="3"
      />
      <path d="M18 22Q40 4 62 22L62 25Q40 12 18 25Z" fill="#e2312d" />

      {/* Ekspresi Wajah */}
      {sad ? (
        <>
          <path
            d="M29 33l6 6M35 33l-6 6M45 33l6 6M51 33l-6 6"
            stroke="#2b2a4a"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M32 47Q40 40 48 47"
            stroke="#2b2a4a"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx="32" cy="36" r="2.6" fill="#2b2a4a" />
          <circle cx="48" cy="36" r="2.6" fill="#2b2a4a" />
          <path
            d="M32 43Q40 51 48 43Z"
            fill="#c2332f"
            stroke="#2b2a4a"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </>
      )}

      {/* Mahkota Emas Pemenang */}
      {crown && (
        <path
          d="M26 8L28 -4L35 3L40 -8L45 3L52 -4L54 8Z"
          fill="#ffb81c"
          stroke="#2b2a4a"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      )}

      {/* Medali Perak Juara 2 */}
      {medal && (
        <>
          <circle cx="40" cy="64" r="7" fill="#cfd6e4" stroke="#2b2a4a" strokeWidth="2" />
          <text
            x="40"
            y="68"
            fontSize="10"
            fontWeight="800"
            textAnchor="middle"
            fill="#2b2a4a"
            fontFamily="Baloo 2, sans-serif"
          >
            2
          </text>
        </>
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

const CROWD_SHIRTS = [
  '#e2312d',
  '#1d8fe0',
  '#ffb81c',
  '#7a3fd0',
  '#1f9d55',
  '#ff7a59',
  '#2bb6a8',
];
const CROWD_SKINS = ['#ffd9a8', '#e8b27d', '#c58c5a', '#f3c99b'];
const CROWD_HAIRS = ['#2b2a4a', '#4a2c17', '#111111', '#6b3b1e'];

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
  const reactId = useId().replace(/:/g, '');
  const townPatternId = `bk-town-pat-${reactId}`;

  const spectators = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        idx: i,
        width: 34 + ((i * 7) % 13),
        shirt: CROWD_SHIRTS[i % CROWD_SHIRTS.length],
        skin: CROWD_SKINS[(i * 3) % CROWD_SKINS.length],
        hair: CROWD_HAIRS[(i * 5) % CROWD_HAIRS.length],
        delay: (((i * 37) % 15) / 10).toFixed(2),
        hasFlag: i % 5 === 0,
      })),
    []
  );

  const buntings = useMemo(() => Array.from({ length: 48 }, (_, i) => i), []);

  const statusClass =
    statusTone === 'live' ? 'bk-chip live' : statusTone === 'done' ? 'bk-chip blue' : 'bk-chip blue';

  return (
    <section className="bk-stage">
      {/* Langit + Matahari + Awan + Pemandangan Kota/Desa + Penonton + Bunting + Tembok */}
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
                <span className="hidden md:inline-block bk-chip green">{subtitle}</span>
              )}
              <span className={statusClass}>{statusLabel}</span>
              <span className="bk-chip yellow">Target {targetJarak} m</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="hidden sm:inline-block text-xs font-extrabold text-[#6b6a85] px-1">
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
        <div className="bk-cloud" style={{ width: 110, top: 78, left: '30%' }} />
        <div
          className="bk-cloud"
          style={{ width: 90, top: 96, left: '62%', animationDuration: '98s' }}
        />
        <div
          className="bk-cloud"
          style={{ width: 120, top: 72, left: '84%', animationDuration: '115s' }}
        />

        {/* Latar Perkampungan + Gedung Kota + Bendera + Bukit + Pepohonan (Pattern Tiling Penuh 100%) */}
        <svg className="bk-town" height="150" aria-hidden="true">
          <defs>
            <pattern id={townPatternId} width="600" height="150" patternUnits="userSpaceOnUse">
              {/* Rumah Kiri (2 lantai) */}
              <rect
                x="60"
                y="35"
                width="60"
                height="110"
                fill="#ddcdb7"
                stroke="#7b6f5c"
                strokeWidth="2"
              />
              <path d="M55 35h70l-35-22z" fill="#d4452f" />
              <g fill="#fff6c2">
                <rect x="72" y="52" width="9" height="11" />
                <rect x="98" y="52" width="9" height="11" />
                <rect x="72" y="76" width="9" height="11" />
                <rect x="98" y="76" width="9" height="11" />
              </g>

              {/* Rumah Tengah Lebar */}
              <rect
                x="330"
                y="62"
                width="70"
                height="90"
                fill="#ddcdb7"
                stroke="#7b6f5c"
                strokeWidth="2"
              />
              <path d="M325 62h80l-40-20z" fill="#d4452f" />
              <g fill="#fff6c2">
                <rect x="344" y="78" width="9" height="11" />
                <rect x="376" y="78" width="9" height="11" />
              </g>

              {/* Siluet Gedung Kota */}
              <rect x="220" y="55" width="20" height="95" fill="#8e949c" />
              <rect x="250" y="72" width="20" height="78" fill="#a2a8b0" />

              {/* Tiang & Bendera Merah-Putih */}
              <path d="M560 20V140" stroke="#7b6f5c" strokeWidth="3" />
              <rect x="560" y="22" width="34" height="11" fill="#e2312d" />
              <rect x="560" y="33" width="34" height="11" fill="#ffffff" />

              {/* Bukit Hijau Bergelombang */}
              <path d="M0 150V100Q150 70 300 100T600 100V150Z" fill="#9fd685" />

              {/* Pepohonan */}
              <rect x="478" y="95" width="8" height="40" fill="#6b4423" />
              <circle cx="482" cy="80" r="26" fill="#2f8f3f" />
              <rect x="16" y="105" width="7" height="35" fill="#6b4423" />
              <circle cx="20" cy="92" r="18" fill="#2f8f3f" />
            </pattern>
          </defs>
          <rect width="100%" height="150" fill={`url(#${townPatternId})`} />
        </svg>

        {/* Penonton Bersorak dengan Tangan Terangkat & Bendera Mini */}
        <div className={`bk-crowd ${crowdCheer ? 'cheer' : ''}`} aria-hidden="true">
          {spectators.map((sp) => (
            <svg
              key={sp.idx}
              className="bk-spec"
              width={sp.width}
              viewBox="0 -16 40 76"
              style={{ animationDelay: `-${sp.delay}s` }}
            >
              <path
                d="M9 40L3 16M31 40L37 16"
                stroke={sp.skin}
                strokeWidth="5"
                strokeLinecap="round"
              />
              {sp.hasFlag && (
                <>
                  <path d="M37 16V-12" stroke="#6b4423" strokeWidth="2" />
                  <path d="M37 -12h12v5h-12z" fill="#e2312d" />
                  <path d="M37 -7h12v5h-12z" fill="#ffffff" stroke="#dddddd" strokeWidth="0.5" />
                </>
              )}
              <rect x="8" y="30" width="24" height="30" rx="8" fill={sp.shirt} />
              <circle cx="20" cy="19" r="10" fill={sp.skin} />
              <path d="M10 18Q20 4 30 18Q20 11 10 18Z" fill={sp.hair} />
              <ellipse cx="20" cy="23" rx="3" ry="2.4" fill="#8a2a2a" />
            </svg>
          ))}
        </div>

        {/* Bendera Segitiga Merah-Putih + Tembok MERDEKA!! */}
        <div className="bk-bunt" aria-hidden="true">
          {buntings.map((idx) => (
            <div key={idx} className={`bk-bunt-tri ${idx % 2 === 1 ? 'w' : ''}`} />
          ))}
        </div>
        <div className="bk-wall">
          <span className="bk-merdeka">MERDEKA!!</span>
        </div>
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
              <div className="bk-lh">
                <span className="bk-chip2" style={{ background: lane.warna }}>
                  {lane.nama}
                  <b className="bk-chip2-m">{Math.round(lane.meter)} m</b>
                </span>

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

