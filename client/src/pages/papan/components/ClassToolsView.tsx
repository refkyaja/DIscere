import React, { useState } from 'react';

export interface ScoreItem {
  id: string;
  name: string;
  points: number;
}

export interface PollingOption {
  text: string;
  votes: number;
}

export interface ClassToolsViewProps {
  onPasteToBoard: (text: string) => void;
  onToast: (msg: string) => void;
  timerSeconds: number;
  timerTotal: number;
  isTimerRunning: boolean;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onResetTimer: () => void;
  onChangeTimerTotal: (sec: number) => void;
}

// Ikon-ikon SVG Murni (Tanpa Emoji)
const Icons = {
  Timer: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2M5 3L2 6M22 6l-3-3M10 2h4" />
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  Pause: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  ),
  Reset: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  ),
  Dice: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <circle cx="16" cy="8" r="1.5" fill="currentColor" />
      <circle cx="8" cy="16" r="1.5" fill="currentColor" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Poll: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  ),
  Trophy: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4a2 2 0 0 1-2-2V5h4M18 9h2a2 2 0 0 0 2-2V5h-4" />
      <path d="M4 5h16v6a6 6 0 0 1-12 0V5z" />
      <path d="M12 17v4M8 21h8" />
    </svg>
  ),
  Paste: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" />
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Minus: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  ChevronDown: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
};

export const ClassToolsView: React.FC<ClassToolsViewProps> = ({
  onPasteToBoard,
  onToast,
  timerSeconds,
  timerTotal,
  isTimerRunning,
  onStartTimer,
  onPauseTimer,
  onResetTimer,
  onChangeTimerTotal,
}) => {
  // Accordion Section States (Tertutup secara default pas awal)
  const [openSections, setOpenSections] = useState({
    timer: false,
    randomizer: false,
    polling: false,
    scoreboard: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev [key] }));
  };

  // --- 1. STATE ACAK NAMA & KELOMPOK ---
  const [namesText, setNamesText] = useState('');
  const [noRepeat, setNoRepeat] = useState(true);
  const [usedNames, setUsedNames] = useState<string[]>([]);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [groupCount, setGroupCount] = useState(3);
  const [generatedGroups, setGeneratedGroups] = useState<string[][]>([]);

  const handlePickRandomName = () => {
    const allNames = namesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (allNames.length === 0) {
      onToast('Daftar nama masih kosong');
      return;
    }

    const pool = noRepeat ? allNames.filter((n) => !usedNames.includes(n)) : allNames;

    if (pool.length === 0) {
      onToast('Semua nama sudah terpilih. Silakan reset riwayat.');
      return;
    }

    setIsShuffling(true);
    let ticks = 0;
    const interval = setInterval(() => {
      const temp = pool[Math.floor(Math.random() * pool.length)];
      setPickedName(temp);
      ticks++;
      if (ticks >= 14) {
        clearInterval(interval);
        const winner = pool[Math.floor(Math.random() * pool.length)];
        setPickedName(winner);
        setIsShuffling(false);
        if (noRepeat) {
          setUsedNames((prev) => [...prev, winner]);
        }
      }
    }, 70);
  };

  const handleResetRandomizer = () => {
    setUsedNames([]);
    setPickedName(null);
    setGeneratedGroups([]);
    onToast('Riwayat acak nama di-reset');
  };

  const handleSplitGroups = () => {
    const allNames = namesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (allNames.length < 2) {
      onToast('Masukkan minimal 2 nama siswa');
      return;
    }

    const n = Math.max(2, Math.min(10, groupCount, allNames.length));
    // Fisher-Yates shuffle
    const shuffled = [...allNames];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const groups: string[][] = Array.from({ length: n }, () => []);
    shuffled.forEach((name, i) => {
      groups[i % n].push(name);
    });

    setGeneratedGroups(groups);
    onToast(`Berhasil membagi ${n} kelompok`);
  };

  const handlePasteGroups = () => {
    if (generatedGroups.length === 0) return;
    const lines = ['PEMBAGIAN KELOMPOK BELAJAR', ''];
    generatedGroups.forEach((g, i) => {
      lines.push(`Kelompok ${i + 1}:`);
      lines.push(g.map((n) => ` • ${n}`).join('\n'));
      lines.push('');
    });
    onPasteToBoard(lines.join('\n'));
    onToast('Daftar kelompok ditempel ke papan');
  };

  // --- 2. STATE POLING KELAS ---
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['Ya, Mengerti', 'Masih Ragu']);
  const [isPollLive, setIsPollLive] = useState(false);
  const [pollVotes, setPollVotes] = useState<number[]>([0, 0]);

  const handleAddOption = () => {
    if (pollOptions.length < 5) {
      setPollOptions((prev) => [...prev, '']);
      setPollVotes((prev) => [...prev, 0]);
    }
  };

  const handleRemoveOption = () => {
    if (pollOptions.length > 2) {
      setPollOptions((prev) => prev.slice(0, prev.length - 1));
      setPollVotes((prev) => prev.slice(0, prev.length - 1));
    }
  };

  const handleStartPoll = () => {
    if (!pollQuestion.trim()) {
      onToast('Tulis pertanyaan poling terlebih dahulu');
      return;
    }
    const hasEmpty = pollOptions.some((o) => !o.trim());
    if (hasEmpty) {
      onToast('Lengkapi semua teks pilihan opsi');
      return;
    }
    setPollVotes(pollOptions.map(() => 0));
    setIsPollLive(true);
    onToast('Poling kelas dimulai');
  };

  const handleVote = (idx: number) => {
    setPollVotes((prev) => {
      const next = [...prev];
      next[idx] = (next[idx] || 0) + 1;
      return next;
    });
  };

  const handlePastePoll = () => {
    const totalVotes = pollVotes.reduce((a, b) => a + b, 0) || 1;
    const lines = [`HASIL POLING KELAS`, `Pertanyaan: ${pollQuestion}`, ''];
    pollOptions.forEach((opt, i) => {
      const v = pollVotes[i] || 0;
      const pct = Math.round((v / totalVotes) * 100);
      lines.push(`${String.fromCharCode(65 + i)}. ${opt}: ${v} suara (${pct}%)`);
    });
    lines.push('', `Total Respon: ${pollVotes.reduce((a, b) => a + b, 0)} suara`);
    onPasteToBoard(lines.join('\n'));
    onToast('Hasil poling ditempel ke papan');
  };

  // --- 3. STATE PAPAN SKOR ---
  const [scores, setScores] = useState<ScoreItem[]>([]);
  const [newTeamName, setNewTeamName] = useState('');

  const handleAddTeam = () => {
    const n = newTeamName.trim();
    if (!n) return;
    setScores((prev) => [...prev, { id: crypto.randomUUID(), name: n, points: 0 }]);
    setNewTeamName('');
  };

  const handleChangePoints = (id: string, delta: number) => {
    setScores((prev) =>
      prev.map((s) => (s.id === id ? { ...s, points: Math.max(0, s.points + delta) } : s))
    );
  };

  const handleDeleteTeam = (id: string) => {
    setScores((prev) => prev.filter((s) => s.id !== id));
  };

  const handleResetScores = () => {
    setScores((prev) => prev.map((s) => ({ ...s, points: 0 })));
    onToast('Skor di-reset');
  };

  const handlePasteScores = () => {
    if (scores.length === 0) return;
    const sorted = [...scores].sort((a, b) => b.points - a.points);
    const lines = ['KLASEMEN SKOR KELAS', ''];
    sorted.forEach((s, idx) => {
      lines.push(`${idx + 1}. ${s.name} : ${s.points} Poin`);
    });
    onPasteToBoard(lines.join('\n'));
    onToast('Papan skor ditempel ke papan');
  };

  const handleImportNamesFromScores = () => {
    if (scores.length === 0) {
      onToast('Papan skor masih kosong');
      return;
    }
    const teamNames = scores.map((s) => s.name).join('\n');
    setNamesText(teamNames);
    onToast('Nama berhasil diambil dari papan skor');
  };

  // Format Waktu mm:ss
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      id="kb"
      className="class-tools-container"
      style={{
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '12px 14px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* 1. SEKSI TIMER KELAS */}
      <div className="tool-card" style={{ flexShrink: 0, background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <button
          onClick={() => toggleSection('timer')}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'transparent', border: 'none', color: '#eef1fa', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#c084fc' }}><Icons.Timer /></span>
            <span>Timer Hitung Mundur</span>
          </span>
          <span style={{ transform: openSections.timer ? 'rotate(180deg)' : 'none', transition: '0.15s' }}>
            <Icons.ChevronDown />
          </span>
        </button>

        {openSections.timer && (
          <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 36,
                fontWeight: 900,
                letterSpacing: 2,
                color: timerSeconds <= 10 && timerSeconds > 0 ? '#f87171' : '#eef1fa',
                background: 'rgba(0,0,0,0.25)',
                padding: '6px 20px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {formatTime(timerSeconds)}
            </div>

            {/* Tombol Preset Menit */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[1, 3, 5, 10, 15].map((m) => (
                <button
                  key={m}
                  onClick={() => onChangeTimerTotal(m * 60)}
                  style={{
                    background: timerTotal === m * 60 ? '#9b17f5' : 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {m} mnt
                </button>
              ))}
            </div>

            {/* Kontrol Timer */}
            <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 2 }}>
              <button
                onClick={isTimerRunning ? onPauseTimer : onStartTimer}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: isTimerRunning ? '#eab308' : '#9b17f5',
                  color: isTimerRunning ? '#000' : '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {isTimerRunning ? <Icons.Pause /> : <Icons.Play />}
                <span>{isTimerRunning ? 'Jeda' : 'Mulai'}</span>
              </button>

              <button
                onClick={onResetTimer}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: 'rgba(255,255,255,0.08)',
                  color: '#eef1fa',
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 14px',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <Icons.Reset />
                <span>Reset</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. SEKSI ACAK NAMA & KELOMPOK */}
      <div className="tool-card" style={{ flexShrink: 0, background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <button
          onClick={() => toggleSection('randomizer')}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'transparent', border: 'none', color: '#eef1fa', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#38bdf8' }}><Icons.Dice /></span>
            <span>Acak Nama & Kelompok</span>
          </span>
          <span style={{ transform: openSections.randomizer ? 'rotate(180deg)' : 'none', transition: '0.15s' }}>
            <Icons.ChevronDown />
          </span>
        </button>

        {openSections.randomizer && (
          <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              rows={3}
              placeholder="Ketik satu nama per baris..."
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                color: '#fff',
                padding: '8px 10px',
                fontSize: 12,
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                onClick={handleImportNamesFromScores}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#94a3b8',
                  borderRadius: 8,
                  padding: '4px 8px',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Salin dari Skor
              </button>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={noRepeat}
                  onChange={(e) => setNoRepeat(e.target.checked)}
                />
                <span>Tanpa Pengulangan</span>
              </label>
            </div>

            {/* Display Pemenang Terpilih */}
            <div
              style={{
                textAlign: 'center',
                padding: '10px 12px',
                borderRadius: 10,
                background: pickedName ? 'rgba(56, 189, 248, 0.15)' : 'rgba(0,0,0,0.2)',
                border: pickedName ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.06)',
                minHeight: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 800, color: pickedName ? '#38bdf8' : '#64748b' }}>
                {pickedName || 'Klik tombol untuk mengundi'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handlePickRandomName}
                disabled={isShuffling}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: isShuffling ? 'not-allowed' : 'pointer',
                }}
              >
                <Icons.Dice />
                <span>{isShuffling ? 'Mengundi…' : 'Acak Nama'}</span>
              </button>

              <button
                onClick={handleResetRandomizer}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: '#eef1fa',
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Reset
              </button>
            </div>

            {usedNames.length > 0 && (
              <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
                Terpilih ({usedNames.length}): {usedNames.join(', ')}
              </div>
            )}

            {/* Sub-fitur Pembagian Kelompok */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>Bagi Kelompok:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    min={2}
                    max={10}
                    value={groupCount}
                    onChange={(e) => setGroupCount(Math.max(2, Math.min(10, +e.target.value || 2)))}
                    style={{
                      width: 44,
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 6,
                      color: '#fff',
                      textAlign: 'center',
                      padding: '3px 4px',
                      fontSize: 12,
                    }}
                  />
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Grup</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleSplitGroups}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    background: 'rgba(255,255,255,0.08)',
                    color: '#eef1fa',
                    border: 'none',
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Icons.Users />
                  <span>Bagi Kelompok</span>
                </button>

                {generatedGroups.length > 0 && (
                  <button
                    onClick={handlePasteGroups}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'rgba(155, 23, 245, 0.25)',
                      color: '#c084fc',
                      border: '1px solid #9b17f5',
                      borderRadius: 8,
                      padding: '6px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Icons.Paste />
                    <span>Tempel</span>
                  </button>
                )}
              </div>

              {generatedGroups.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
                  {generatedGroups.map((grp, idx) => (
                    <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: 6, fontSize: 11 }}>
                      <b style={{ color: '#38bdf8' }}>K{idx + 1}: </b>
                      <span style={{ color: '#cbd5e1' }}>{grp.join(', ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. SEKSI POLING KELAS */}
      <div className="tool-card" style={{ flexShrink: 0, background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <button
          onClick={() => toggleSection('polling')}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'transparent', border: 'none', color: '#eef1fa', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#10b981' }}><Icons.Poll /></span>
            <span>Poling Cepat Kelas</span>
          </span>
          <span style={{ transform: openSections.polling ? 'rotate(180deg)' : 'none', transition: '0.15s' }}>
            <Icons.ChevronDown />
          </span>
        </button>

        {openSections.polling && (
          <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!isPollLive ? (
              <>
                <input
                  type="text"
                  placeholder="Ketik pertanyaan poling..."
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#fff',
                    padding: '6px 10px',
                    fontSize: 12,
                    boxSizing: 'border-box',
                  }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', minWidth: 16 }}>
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      <input
                        type="text"
                        placeholder={`Pilihan ${String.fromCharCode(65 + idx)}`}
                        value={opt}
                        onChange={(e) => {
                          const next = [...pollOptions];
                          next[idx] = e.target.value;
                          setPollOptions(next);
                        }}
                        style={{
                          flex: 1,
                          background: 'rgba(0,0,0,0.25)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 6,
                          color: '#fff',
                          padding: '4px 8px',
                          fontSize: 11,
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {pollOptions.length < 5 && (
                      <button
                        onClick={handleAddOption}
                        style={{ background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                      >
                        + Opsi
                      </button>
                    )}
                    {pollOptions.length > 2 && (
                      <button
                        onClick={handleRemoveOption}
                        style={{ background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                      >
                        − Opsi
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleStartPoll}
                    style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                  >
                    Mulai Poling
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#eef1fa', marginBottom: 2 }}>
                  {pollQuestion}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pollOptions.map((opt, idx) => {
                    const votes = pollVotes[idx] || 0;
                    const totalVotes = pollVotes.reduce((a, b) => a + b, 0) || 1;
                    const pct = Math.round((votes / totalVotes) * 100);

                    return (
                      <button
                        key={idx}
                        onClick={() => handleVote(idx)}
                        style={{
                          position: 'relative',
                          overflow: 'hidden',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 8,
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          color: '#fff',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        {/* Progress Bar Background */}
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: `${pct}%`,
                            background: 'rgba(16, 185, 129, 0.25)',
                            transition: 'width 0.2s ease',
                          }}
                        />

                        <span style={{ position: 'relative', zIndex: 1, fontWeight: 700 }}>
                          {String.fromCharCode(65 + idx)}. {opt}
                        </span>

                        <span style={{ position: 'relative', zIndex: 1, fontSize: 11, fontWeight: 800, color: '#10b981' }}>
                          {votes} ({pct}%)
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button
                    onClick={() => setPollVotes(pollOptions.map(() => 0))}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: 'none', borderRadius: 8, padding: '6px', fontSize: 11, cursor: 'pointer' }}
                  >
                    Reset Suara
                  </button>

                  <button
                    onClick={() => setIsPollLive(false)}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: 'none', borderRadius: 8, padding: '6px', fontSize: 11, cursor: 'pointer' }}
                  >
                    Edit
                  </button>

                  <button
                    onClick={handlePastePoll}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid #10b981', borderRadius: 8, padding: '6px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    <Icons.Paste />
                    <span>Tempel</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 4. SEKSI PAPAN SKOR */}
      <div className="tool-card" style={{ flexShrink: 0, background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <button
          onClick={() => toggleSection('scoreboard')}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'transparent', border: 'none', color: '#eef1fa', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#eab308' }}><Icons.Trophy /></span>
            <span>Papan Skor Tim / Siswa</span>
          </span>
          <span style={{ transform: openSections.scoreboard ? 'rotate(180deg)' : 'none', transition: '0.15s' }}>
            <Icons.ChevronDown />
          </span>
        </button>

        {openSections.scoreboard && (
          <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="Nama tim atau siswa..."
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTeam();
                }}
                style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: '#fff',
                  padding: '6px 10px',
                  fontSize: 12,
                }}
              />
              <button
                onClick={handleAddTeam}
                style={{
                  background: '#eab308',
                  color: '#000',
                  border: 'none',
                  borderRadius: 8,
                  padding: '0 12px',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                + Tambah
              </button>
            </div>

            {/* List Skor */}
            {scores.length === 0 ? (
              <p style={{ fontSize: 11.5, color: '#64748b', textAlign: 'center', margin: '6px 0' }}>
                Belum ada tim atau peserta. Ketik nama di atas lalu klik Tambah.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                {[...scores]
                  .sort((a, b) => b.points - a.points)
                  .map((item, idx) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(0,0,0,0.2)',
                        padding: '4px 8px',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, overflow: 'hidden' }}>
                        <span style={{ fontWeight: 800, color: idx === 0 ? '#eab308' : '#94a3b8', fontSize: 11, minWidth: 16 }}>
                          #{idx + 1}
                        </span>
                        <span style={{ fontWeight: 700, color: '#eef1fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontWeight: 900, color: '#eab308', fontSize: 13, minWidth: 26, textAlign: 'center' }}>
                          {item.points}
                        </span>

                        <button
                          onClick={() => handleChangePoints(item.id, -1)}
                          style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                          title="Kurangi 1 poin"
                        >
                          <Icons.Minus />
                        </button>

                        <button
                          onClick={() => handleChangePoints(item.id, 1)}
                          style={{ width: 22, height: 22, borderRadius: 6, background: '#eab308', color: '#000', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                          title="Tambah 1 poin"
                        >
                          <Icons.Plus />
                        </button>

                        <button
                          onClick={() => handleDeleteTeam(item.id)}
                          style={{ width: 22, height: 22, borderRadius: 6, background: 'transparent', color: '#64748b', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', marginLeft: 2 }}
                          title="Hapus peserta"
                        >
                          <Icons.Trash />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                onClick={handleResetScores}
                style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: 'none', borderRadius: 8, padding: '6px', fontSize: 11, cursor: 'pointer' }}
              >
                Reset Skor
              </button>

              <button
                onClick={handlePasteScores}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'rgba(234, 179, 8, 0.18)', color: '#fbbf24', border: '1px solid #eab308', borderRadius: 8, padding: '6px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                <Icons.Paste />
                <span>Tempel</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassToolsView;

