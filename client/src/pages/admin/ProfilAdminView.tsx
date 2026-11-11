import React, { useState, useEffect } from 'react';
import { useAuth, User } from '../../lib/auth';
import { apiRequest } from '../../lib/api';
import {
  User as UserIcon,
  Shield,
  Mail,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface ProfilAdminViewProps {
  stats?: {
    totalGuru?: number;
    totalTemplateResmi?: number;
    totalSesi?: number;
  };
}

export function ProfilAdminView({}: ProfilAdminViewProps) {
  const { user, refreshUser } = useAuth();

  // Form Profil state
  const [nama, setNama] = useState('');
  const [savingProfil, setSavingProfil] = useState(false);
  const [pesanProfil, setPesanProfil] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null);

  // Form Ganti Kata Sandi state
  const [sandiLama, setSandiLama] = useState('');
  const [sandiBaru, setSandiBaru] = useState('');
  const [konfirmasiSandi, setKonfirmasiSandi] = useState('');
  const [savingSandi, setSavingSandi] = useState(false);
  const [pesanSandi, setPesanSandi] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null);

  useEffect(() => {
    if (user) {
      setNama(user.nama || '');
    }
  }, [user]);

  const handleSimpanProfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setPesanProfil(null);

    if (nama.trim().length < 2) {
      setPesanProfil({ tipe: 'error', teks: 'Nama lengkap administrator minimal 2 karakter.' });
      return;
    }

    setSavingProfil(true);
    try {
      await apiRequest<{ pesan: string; user: User }>('/auth/profil', {
        method: 'PUT',
        body: JSON.stringify({
          nama: nama.trim(),
        }),
      });

      await refreshUser();
      setPesanProfil({ tipe: 'sukses', teks: 'Data profil administrator berhasil diperbarui.' });
    } catch (err: unknown) {
      const error = err as { pesan?: string };
      setPesanProfil({ tipe: 'error', teks: error.pesan || 'Gagal memperbarui profil.' });
    } finally {
      setSavingProfil(false);
    }
  };

  const handleSimpanKataSandi = async (e: React.FormEvent) => {
    e.preventDefault();
    setPesanSandi(null);

    if (!sandiLama) {
      setPesanSandi({ tipe: 'error', teks: 'Kata sandi saat ini wajib diisi.' });
      return;
    }
    if (sandiBaru.length < 8) {
      setPesanSandi({ tipe: 'error', teks: 'Kata sandi baru minimal 8 karakter.' });
      return;
    }
    if (sandiBaru !== konfirmasiSandi) {
      setPesanSandi({ tipe: 'error', teks: 'Konfirmasi kata sandi baru tidak cocok.' });
      return;
    }

    setSavingSandi(true);
    try {
      const res = await apiRequest<{ pesan: string }>('/auth/kata-sandi', {
        method: 'PUT',
        body: JSON.stringify({
          kataSandiLama: sandiLama,
          kataSandiBaru: sandiBaru,
        }),
      });

      setPesanSandi({ tipe: 'sukses', teks: res.pesan || 'Kata sandi berhasil diperbarui.' });
      setSandiLama('');
      setSandiBaru('');
      setKonfirmasiSandi('');
    } catch (err: unknown) {
      const error = err as { pesan?: string };
      setPesanSandi({ tipe: 'error', teks: error.pesan || 'Gagal memperbarui kata sandi.' });
    } finally {
      setSavingSandi(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-start">
      {/* Kolom Kiri: Form Informasi Akun Admin */}
      <div className="portal-card p-6 space-y-5">
            <div className="flex items-center gap-4 pb-4 border-b border-[#e0d5b8]">
              <div className="w-16 h-16 rounded-2xl bg-[#1f4a37] text-[#f4ecd8] flex items-center justify-center font-bold text-2xl border-2 border-[#a6783c] shadow-inner shrink-0">
                <Shield className="w-8 h-8 text-[#f2c230]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="portal-cv text-2xl text-[#1d3b2e]">
                    {user?.nama || 'Administrator'}
                  </h3>
                  <span className="portal-tag blue font-bold">Admin Platform</span>
                </div>
                <p className="text-xs text-[#6b7d6c] font-medium flex items-center gap-1.5 mt-1">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span>{user?.email}</span>
                  <span>•</span>
                  <span>Hak Akses Penuh Tata Kelola</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleSimpanProfil} className="space-y-4">
              <h4 className="text-sm font-bold text-[#1d3b2e] uppercase tracking-wider">
                Pengaturan Akun Administrator
              </h4>

              {pesanProfil && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    pesanProfil.tipe === 'sukses'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {pesanProfil.tipe === 'sukses' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  )}
                  <span>{pesanProfil.teks}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1d3b2e] uppercase tracking-wider mb-1.5">
                    Nama Administrator
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-[#6b7d6c] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      className="portal-input has-icon !pl-11"
                      style={{ paddingLeft: '42px' }}
                      placeholder="Nama lengkap administrator"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1d3b2e] uppercase tracking-wider mb-1.5">
                    Peran / Role Akun
                  </label>
                  <div className="relative">
                    <Shield className="w-4 h-4 text-[#6b7d6c] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value="Administrator Sistem"
                      disabled
                      className="portal-input has-icon !pl-11 opacity-75 cursor-not-allowed bg-[#efe6d0]"
                      style={{ paddingLeft: '42px' }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1d3b2e] uppercase tracking-wider mb-1.5">
                  Alamat Email (Identitas Masuk)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#6b7d6c] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="portal-input has-icon !pl-11 opacity-75 cursor-not-allowed bg-[#efe6d0]"
                    style={{ paddingLeft: '42px' }}
                  />
                </div>
                <span className="text-[11px] text-[#6b7d6c] mt-1 block">
                  Alamat email digunakan sebagai identitas masuk permanen dan tidak dapat diubah.
                </span>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfil}
                  className="portal-btn red sm"
                >
                  {savingProfil ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Perubahan Data</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Kartu Ganti Kata Sandi */}
          <div className="portal-card p-6 space-y-4">
            <div className="pb-3 border-b border-[#e0d5b8]">
              <h4 className="text-sm font-bold text-[#1d3b2e] uppercase tracking-wider flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#c8362f]" />
                <span>Keamanan Kata Sandi</span>
              </h4>
              <p className="text-xs text-[#6b7d6c] mt-0.5">
                Perbarui kata sandi akun administrator secara berkala untuk menjaga integritas sistem.
              </p>
            </div>

            {pesanSandi && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  pesanSandi.tipe === 'sukses'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {pesanSandi.tipe === 'sukses' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                )}
                <span>{pesanSandi.teks}</span>
              </div>
            )}

            <form onSubmit={handleSimpanKataSandi} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1d3b2e] uppercase tracking-wider mb-1.5">
                  Kata Sandi Saat Ini
                </label>
                <input
                  type="password"
                  value={sandiLama}
                  onChange={(e) => setSandiLama(e.target.value)}
                  className="portal-input"
                  placeholder="Masukkan kata sandi saat ini"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-[#1d3b2e] uppercase tracking-wider mb-1.5 min-h-[2rem] flex items-end">
                    Kata Sandi Baru
                  </label>
                  <input
                    type="password"
                    value={sandiBaru}
                    onChange={(e) => setSandiBaru(e.target.value)}
                    className="portal-input"
                    placeholder="Minimal 8 karakter"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1d3b2e] uppercase tracking-wider mb-1.5 min-h-[2rem] flex items-end">
                    Konfirmasi Kata Sandi
                  </label>
                  <input
                    type="password"
                    value={konfirmasiSandi}
                    onChange={(e) => setKonfirmasiSandi(e.target.value)}
                    className="portal-input"
                    placeholder="Ulangi kata sandi baru"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingSandi}
                  className="portal-btn red sm"
                >
                  {savingSandi ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memperbarui...</span>
                    </>
                  ) : (
                    <span>Perbarui Kata Sandi</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
  );
}

