import { AlertTriangle, LogOut } from 'lucide-react';
import { Modal } from './Modal';

interface ModalKonfirmasiKeluarProps {
  isOpen: boolean;
  onClose: () => void;
  onKonfirmasiKeluar: () => void | Promise<void>;
  isSubmitting?: boolean;
  judulGame?: string;
}

export function ModalKonfirmasiKeluar({
  isOpen,
  onClose,
  onKonfirmasiKeluar,
  isSubmitting = false,
  judulGame,
}: ModalKonfirmasiKeluarProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Permainan Sedang Berlangsung!"
      maxWidth="sm"
    >
      <div className="space-y-4 text-[#1d3b2e]">
        <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <p className="font-extrabold text-amber-950 mb-1">
              {judulGame ? `Lomba ${judulGame} belum selesai` : 'Lomba sedang berjalan'}
            </p>
            <p>
              Apakah Anda yakin ingin keluar dari arena permainan? Jika Anda keluar sekarang, permainan akan otomatis dihentikan dan sesi ini akan diselesaikan untuk seluruh peserta.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-[#e0d5b8]">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#e0d5b8] bg-white hover:bg-[#f7f2e4] text-xs font-bold text-[#1d3b2e] cursor-pointer transition-colors disabled:opacity-60"
          >
            Lanjutkan Permainan
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onKonfirmasiKeluar}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#c8362f] hover:bg-[#b02d27] text-white text-xs font-bold cursor-pointer transition-colors shadow-sm disabled:opacity-60"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Menghentikan...' : 'Ya, Keluar & Hentikan'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default ModalKonfirmasiKeluar;
