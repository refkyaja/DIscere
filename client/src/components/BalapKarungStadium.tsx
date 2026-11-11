import React, { useState, useEffect } from 'react';
import { FestivalStadiumShell } from './FestivalStadiumShell';
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
  return (
    <FestivalStadiumShell
      title={title}
      subtitle={subtitle}
      statusLabel={statusLabel}
      statusTone={statusTone}
      targetLabel={`Target ${targetJarak} m`}
      ruleSummary={ruleSummary}
      crowdCheer={crowdCheer}
      isMuted={isMuted}
      onToggleMute={onToggleMute}
      onBack={onBack}
      backLabel={backLabel}
      isPaused={isPaused}
      onTogglePause={onTogglePause}
      onStop={onStop}
    >
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
    </FestivalStadiumShell>
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

