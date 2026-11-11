import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { Loader2 } from 'lucide-react';
import { AuthProvider, RequireRole } from './lib/auth';
import { ToastProvider } from './components';

const Landing = lazy(() => import('./pages/publik/Landing'));
const Daftar = lazy(() => import('./pages/publik/Daftar'));
const Masuk = lazy(() => import('./pages/publik/Masuk'));
const Dokumentasi = lazy(() => import('./pages/publik/Dokumentasi'));
const MainSiswa = lazy(() => import('./pages/siswa/Main'));
const PapanTulis = lazy(() => import('./pages/papan/PapanTulis'));
const DaftarPapan = lazy(() => import('./pages/papan/DaftarPapan'));
const KolaborasiPublik = lazy(() => import('./pages/papan/KolaborasiPublik'));

const DashboardGuru = lazy(() => import('./pages/guru/Dashboard'));
const TemplateForm = lazy(() => import('./pages/guru/TemplateForm'));
const PilihModeKerupuk = lazy(() => import('./pages/guru/PilihModeKerupuk'));
const PilihModeBalapKarung = lazy(() => import('./pages/guru/PilihModeBalapKarung'));
const LayarHost = lazy(() => import('./pages/game/LayarHost'));
const HasilSolo = lazy(() => import('./pages/game/HasilSolo'));
const DashboardAdmin = lazy(() => import('./pages/admin/Statistik'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f3e6] text-[#1d3b2e]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#c8362f]" aria-hidden="true" />
        <p className="text-sm font-semibold text-[#6b7d6c]">Memuat halaman...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              {/* Rute Publik */}
              <Route path="/" element={<Landing />} />
              <Route path="/daftar" element={<Daftar />} />
              <Route path="/masuk" element={<Masuk />} />
              <Route path="/dokumentasi" element={<Dokumentasi />} />
              <Route path="/join" element={<MainSiswa />} />
              <Route path="/main" element={<MainSiswa />} />
              <Route path="/b/:token" element={<KolaborasiPublik />} />

              {/* Rute Terlindungi Guru */}
              <Route element={<RequireRole allowedRole="guru" />}>
                <Route path="/guru" element={<DashboardGuru />} />
                <Route path="/guru/makan-kerupuk" element={<PilihModeKerupuk />} />
                <Route path="/guru/balap-karung" element={<PilihModeBalapKarung />} />
                <Route path="/guru/template/baru" element={<TemplateForm />} />
                <Route path="/guru/template/:id/ubah" element={<TemplateForm />} />
                <Route path="/guru/sesi/:id" element={<LayarHost />} />
                <Route path="/guru/sesi/:id/hasil" element={<HasilSolo />} />
                <Route path="/papan" element={<DaftarPapan />} />
                <Route path="/papan/:id" element={<PapanTulis />} />
              </Route>

              {/* Rute Terlindungi Admin */}
              <Route element={<RequireRole allowedRole="admin" />}>
                <Route path="/admin" element={<DashboardAdmin />} />
              </Route>

              {/* Halaman 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
