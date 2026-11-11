interface PortalLedgeProps {
  showProps?: boolean;
}

/**
 * Dudukan kapur kayu (chalk ledge) di bagian bawah papan tulis,
 * dilengkapi properti kelas: tumpukan kapur, penghapus kayu, penggaris segitiga, dan spidol.
 */
export function PortalLedge({ showProps = true }: PortalLedgeProps) {
  return (
    <div className="portal-ledge" aria-hidden="true">
      <svg className="portal-ledge-bg" viewBox="0 0 1440 80" preserveAspectRatio="none">
        <path d="M0 34C240 6 480 62 720 34S1200 6 1440 34V80H0z" fill="#a6783c" />
        <path d="M0 56C260 34 520 80 760 56S1220 36 1440 58V80H0z" fill="#8d6444" />
      </svg>

      {showProps && (
        <div className="portal-ledge-props">
          {/* Kiri: Tumpukan kapur klasik + kapur kuning/putih + remah kapur */}
          <div className="portal-ledge-chalk-cluster">
            <div className="portal-chalks">
              <i style={{ width: '84px', background: '#7a9c85' }} />
              <i style={{ width: '70px', background: '#7a9c85' }} />
              <i style={{ width: '92px', background: '#7a9c85' }} />
            </div>
            <div className="portal-chalk-extras">
              <span className="portal-chalk-stick portal-chalk-white" />
              <span className="portal-chalk-stick portal-chalk-yellow" />
              <span className="portal-chalk-crumb" style={{ left: '54px', bottom: '2px' }} />
              <span className="portal-chalk-crumb" style={{ left: '66px', bottom: '6px' }} />
            </div>
          </div>

          {/* Kiri-Tengah: Penghapus papan tulis kayu + kapur merah muda */}
          <div className="portal-prop-eraser">
            <span className="portal-chalk-stick portal-chalk-coral" />
            <div className="portal-eraser-body">
              <div className="portal-eraser-wood">
                <span className="portal-eraser-groove" />
              </div>
              <div className="portal-eraser-felt" />
            </div>
            <span className="portal-chalk-crumb" style={{ left: '-8px', bottom: '2px' }} />
            <span className="portal-chalk-crumb" style={{ right: '-6px', bottom: '1px' }} />
          </div>

          {/* Tengah-Kanan: Penggaris segitiga kayu + kapur biru */}
          <div className="portal-prop-ruler">
            <svg width="86" height="44" viewBox="0 0 86 44" fill="none">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M4 41L79 41L21 5L4 41ZM17 34L54 34L24 15L17 34Z"
                fill="#dfb165"
                stroke="#7c5221"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M12 41V37M18 41V38M24 41V37M30 41V38M36 41V37M42 41V38M48 41V37M54 41V38M60 41V37M66 41V38M72 41V37"
                stroke="#7c5221"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            <span className="portal-chalk-stick portal-chalk-sky" />
          </div>

          {/* Kanan: Dua spidol papan (hitam & merah) + kapur pendek */}
          <div className="portal-prop-markers">
            <span className="portal-chalk-stick portal-chalk-cream-nub" />
            <div className="portal-marker portal-marker-black">
              <span className="portal-marker-plug" />
              <span className="portal-marker-barrel" />
              <span className="portal-marker-cap">
                <span className="portal-marker-clip" />
              </span>
            </div>
            <div className="portal-marker portal-marker-red">
              <span className="portal-marker-cap">
                <span className="portal-marker-clip" />
              </span>
              <span className="portal-marker-barrel" />
              <span className="portal-marker-plug" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

