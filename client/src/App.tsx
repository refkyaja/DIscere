import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider, RequireRole } from './lib/auth';
import { ToastProvider } from './components';

import Landing from './pages/publik/Landing';
import Daftar from './pages/publik/Daftar';
import Masuk from './pages/publik/Masuk';
import MainSiswa from './pages/siswa/Main';
import PapanTulis from './pages/papan/PapanTulis';
import DaftarPapan from './pages/papan/DaftarPapan';
import KolaborasiPublik from './pages/papan/KolaborasiPublik';

import DashboardGuru from './pages/guru/Dashboard';
import TemplateForm from './pages/guru/TemplateForm';
import PilihModeKerupuk from './pages/guru/PilihModeKerupuk';
import LayarHost from './pages/game/LayarHost';
import HasilSolo from './pages/game/HasilSolo';
import DashboardAdmin from './pages/admin/Statistik';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Rute Publik */}
            <Route path="/" element={<Landing />} />
            <Route path="/daftar" element={<Daftar />} />
            <Route path="/masuk" element={<Masuk />} />
            <Route path="/join" element={<MainSiswa />} />
            <Route path="/main" element={<MainSiswa />} />
            <Route path="/b/:token" element={<KolaborasiPublik />} />

            {/* Rute Terlindungi Guru */}
            <Route element={<RequireRole allowedRole="guru" />}>
              <Route path="/guru" element={<DashboardGuru />} />
              <Route path="/guru/makan-kerupuk" element={<PilihModeKerupuk />} />
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
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
