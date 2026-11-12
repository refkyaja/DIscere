import assert from 'assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { hitungGeometriTiangPanjat } from '../client/src/pages/siswa/panjatPinangVisualMath.js';

(globalThis as unknown as { React: typeof React }).React = React;

function evalCharBoxInWorld(
  viewportHeightPx: number,
  worldHeightPct: number,
  topTrackPx: number,
  bottomTrackPx: number,
  charHeightPx: number,
  safePosisi: number,
  revealFromBottomPct: number,
  cameraTranslateYPct: number
) {
  const worldPx = (worldHeightPct / 100) * viewportHeightPx;
  const trackPx = worldPx - topTrackPx - bottomTrackPx;
  const u = safePosisi / 100;
  const charBottomInTrackPx = u * (trackPx - charHeightPx);
  const charBottomInWorldPx = bottomTrackPx + charBottomInTrackPx;
  const charTopInWorldPx = charBottomInWorldPx + charHeightPx;
  const revealTopInWorldPx = (revealFromBottomPct / 100) * worldPx;

  // World is anchored bottom: 0; positive translateY(%) shifts world downward by +shiftPx
  // Viewport covers world y in [camBottomWorldPx .. camBottomWorldPx + viewportHeightPx]
  const camBottomWorldPx = (cameraTranslateYPct / 100) * worldPx;
  const camTopWorldPx = camBottomWorldPx + viewportHeightPx;

  return {
    worldPx,
    charBottomInWorldPx,
    charTopInWorldPx,
    revealTopInWorldPx,
    camBottomWorldPx,
    camTopWorldPx,
    charBottomInViewportPx: charBottomInWorldPx - camBottomWorldPx,
    charTopInViewportPx: charTopInWorldPx - camBottomWorldPx,
  };
}

function testGeometryCheckpoints() {
  console.log('1. Menguji invariants geometri & kamera (0%, 25%, 50%, 75%, 99%, 100%, slip)...');

  const checkpoints = [0, 25, 50, 75, 99, 100] as const;

  const fullViewports = [275, 320, 400];
  for (const vpHeight of fullViewports) {
    let prevReveal = -1;
    let prevCamShift = -1;

    for (const p of checkpoints) {
      const g = hitungGeometriTiangPanjat({ posisi: p, compact: false });
      const box = evalCharBoxInWorld(
        vpHeight,
        g.worldHeightPct,
        56,
        24,
        g.charHeightPx,
        g.safePosisi,
        g.revealFromBottomPct,
        g.cameraTranslateYPct
      );

      // Karakter harus selalu berada pada permukaan tiang yang terlihat (reveal >= kepala karakter)
      assert.ok(
        box.revealTopInWorldPx >= box.charTopInWorldPx,
        `Full vp=${vpHeight} p=${p}%: ujung tiang terlihat (${box.revealTopInWorldPx.toFixed(1)}px) harus >= kepala karakter (${box.charTopInWorldPx.toFixed(1)}px)`
      );

      // Karakter harus selalu terlihat penuh di dalam viewport kamera tanpa terpotong atas/bawah
      assert.ok(
        box.charBottomInViewportPx >= 0 && box.charTopInViewportPx <= vpHeight + 0.5,
        `Full vp=${vpHeight} p=${p}%: karakter [${box.charBottomInViewportPx.toFixed(1)}..${box.charTopInViewportPx.toFixed(1)}] harus muat dalam viewport [0..${vpHeight}]`
      );

      if (p === 0) {
        assert.strictEqual(g.isPuncak, false);
        assert.strictEqual(g.cameraTranslateYPct, 0, 'Kamera harus mulai dari dasar 0%');
        assert.ok(
          g.revealFromBottomPct <= 30,
          `Pada 0%, hanya bagian bawah tiang yang terlihat (dapat ${g.revealFromBottomPct}%)`
        );
      } else if (p < 100) {
        assert.strictEqual(g.isPuncak, false);
        assert.ok(g.revealFromBottomPct >= prevReveal, `Reveal harus naik pada ${p}%`);
        assert.ok(g.cameraTranslateYPct >= prevCamShift, `Kamera harus naik pada ${p}%`);
      } else {
        assert.strictEqual(g.isPuncak, true);
        assert.strictEqual(g.worldHeightPct, 100, 'Pada 100%, seluruh tiang ditarik penuh ke viewport');
        assert.strictEqual(g.cameraTranslateYPct, 0);
        assert.strictEqual(g.revealFromBottomPct, 100);
        assert.strictEqual(g.topClipPct, 0);
      }

      if (p <= 75) {
        // Bagian hadiah / roda puncak di top 56px (~91-94%+ dunia) belum terlihat penuh saat <= 75%
        const summitWheelStartPx = box.worldPx - 56;
        assert.ok(
          box.revealTopInWorldPx <= summitWheelStartPx + 1,
          `Full vp=${vpHeight} p=${p}%: roda hadiah puncak belum terbuka (${box.revealTopInWorldPx.toFixed(1)} <= ${summitWheelStartPx.toFixed(1)})`
        );
      }

      if (p === 99) {
        assert.strictEqual(g.revealFromBottomPct, 100, 'Pada 99%, hadiah puncak sudah terlihat');
        assert.strictEqual(g.cameraProgress, 1, 'Pada 99%, kamera fokus ke puncak');
      }

      prevReveal = g.revealFromBottomPct;
      prevCamShift = g.cameraTranslateYPct;
    }
  }

  // Cek mode compact (176px)
  for (const p of checkpoints) {
    const g = hitungGeometriTiangPanjat({ posisi: p, compact: true });
    const box = evalCharBoxInWorld(
      176,
      g.worldHeightPct,
      30,
      10,
      g.charHeightPx,
      g.safePosisi,
      g.revealFromBottomPct,
      g.cameraTranslateYPct
    );
    assert.ok(
      box.revealTopInWorldPx >= box.charTopInWorldPx,
      `Compact p=${p}%: ujung tiang (${box.revealTopInWorldPx.toFixed(1)}px) >= kepala (${box.charTopInWorldPx.toFixed(1)}px)`
    );
    assert.ok(
      box.charBottomInViewportPx >= 0 && box.charTopInViewportPx <= 176 + 0.5,
      `Compact p=${p}%: karakter harus berada di dalam viewport [0..176]`
    );
  }

  // Skenario tergelincir: 75% -> 60% dan 50% -> 35%
  const g75 = hitungGeometriTiangPanjat({ posisi: 75 });
  const g60 = hitungGeometriTiangPanjat({ posisi: 60 });
  assert.ok(g60.revealFromBottomPct < g75.revealFromBottomPct, 'Slip 75->60 menurunkan reveal tiang');
  assert.ok(g60.cameraTranslateYPct < g75.cameraTranslateYPct, 'Slip 75->60 menurunkan kamera');
  assert.ok(g60.safePosisi === 60, 'Nilai posisi 60% dijaga tanpa diubah');

  const g50 = hitungGeometriTiangPanjat({ posisi: 50 });
  const g35 = hitungGeometriTiangPanjat({ posisi: 35 });
  assert.ok(g35.revealFromBottomPct < g50.revealFromBottomPct, 'Slip 50->35 menurunkan reveal tiang');
  assert.ok(g35.cameraTranslateYPct < g50.cameraTranslateYPct, 'Slip 50->35 menurunkan kamera');

  console.log('   OK Semua invariants geometri 0..100% + slip valid pada mobile/tablet/desktop/compact!');
}

async function testRenderedMarkupAndTransitions() {
  const { default: TiangPinangVisual } = await import(
    '../client/src/pages/siswa/TiangPinangVisual.js'
  );
  console.log('2. Menguji render DOM TiangPinangVisual pada 0%, 25%, 50%, 75%, 99%, 100%, & slip...');

  const scenarios = [
    { label: '0%', posisi: 0, delta: undefined, expectedAnim: null },
    { label: '25% naik', posisi: 25, delta: 10, expectedAnim: 'panjat-anim-climb' },
    { label: '50% naik', posisi: 50, delta: 15, expectedAnim: 'panjat-anim-climb' },
    { label: '75% slip -> 65%', posisi: 65, delta: -10, expectedAnim: 'panjat-anim-slip' },
    { label: '99% hampir puncak', posisi: 99, delta: 10, expectedAnim: 'panjat-anim-climb' },
    { label: '100% puncak menang', posisi: 100, delta: 10, expectedAnim: 'panjat-anim-summit' },
  ];

  for (const compact of [false, true]) {
    for (const sc of scenarios) {
      const html = renderToStaticMarkup(
        React.createElement(TiangPinangVisual, {
          posisi: sc.posisi,
          namaPemain: 'Bintang Uji',
          lastDelta: sc.delta,
          compact,
          status: sc.posisi >= 100 ? 'selesai' : 'bermain',
          efekAktif: {
            tiangLicin: sc.label.includes('slip'),
            perisaiKulitPisang: sc.posisi === 50,
            peganganKuat: sc.posisi === 99,
          },
        })
      );

      // Pastikan hanya ada tepat 1 batang tiang utama yang tidak di-recreate
      const poleRodCount = (html.match(/data-panjat-pole-rod="true"/g) || []).length;
      assert.strictEqual(poleRodCount, 1, `${sc.label} (compact=${compact}): harus punya tepat 1 elemen batang tiang`);

      // Pastikan clipping & camera transform & reduced-motion tersedia
      assert.ok(html.includes('clip-path:inset('), `${sc.label}: harus memakai clip-path`);
      assert.ok(html.includes('translate3d(0,'), `${sc.label}: harus memakai translate3d kamera`);
      assert.ok(html.includes('motion-reduce:transition-none'), `${sc.label}: harus menghormati prefers-reduced-motion`);

      if (sc.expectedAnim) {
        assert.ok(
          html.includes(sc.expectedAnim),
          `${sc.label} (compact=${compact}): harus mengandung animasi ${sc.expectedAnim}`
        );
      }

      if (sc.delta !== undefined) {
        const expectedBadge = sc.delta > 0 ? `+${sc.delta}%` : `${sc.delta}%`;
        assert.ok(html.includes(expectedBadge), `${sc.label}: harus tampilkan delta ${expectedBadge}`);
      }
    }
  }

  console.log('   OK Seluruh snapshot DOM TiangPinangVisual lolos!');
}

async function main() {
  testGeometryCheckpoints();
  await testRenderedMarkupAndTransitions();
  console.log('\nSEMUA VERIFIKASI PROGRESSIVE POLE REVEAL PANJAT PINANG LOLOS.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

