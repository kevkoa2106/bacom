/*!
 * Liquid Glass — framework-free live-backdrop refraction.
 *
 * The refraction field is a port of the fragment shader in liquid-glass-js
 * (https://github.com/dashersw/liquid-glass-js) — Copyright (c) 2025 Armagan
 * Amcalar, MIT. Permission is hereby granted, free of charge, to any person
 * obtaining a copy of that software to deal in it without restriction,
 * provided this notice travels with it; it is provided "as is", without
 * warranty of any kind. Keep this header on any copy or port.
 *
 * Ported from the liquid-glass skill's Angular directive. CSS supplies the
 * neutral tint, polished rim and non-Chromium frosted-glass fallback. This
 * script only refracts the live backdrop; it never snapshots the app/video.
 */
(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const PRESET = Object.freeze({
    edgeIntensity: 0.015, rimIntensity: 0.028, baseIntensity: 0.05,
    edgeDistance: 0.5, rimDistance: 1.7, baseDistance: 0.2,
    cornerBoost: 0.06, rippleEffect: 0.26, blurRadius: 2, warp: false,
  });
  const SUPERSAMPLE = 2;
  const MAX_MAP_EDGE = 1400;
  const BLUR_STD_PER_RADIUS = 0.35;
  const filters = new Map();
  const instances = new WeakMap();
  let defsRoot = null;

  function supported() {
    const brands = navigator.userAgentData?.brands;
    return brands
      ? brands.some(({ brand }) => /Chromium|Google Chrome|Microsoft Edge/i.test(brand))
      : /Chrome\//.test(navigator.userAgent);
  }

  function ensureDefs() {
    if (!defsRoot?.isConnected) {
      defsRoot = document.createElementNS(SVG_NS, 'svg');
      defsRoot.setAttribute('width', '0');
      defsRoot.setAttribute('height', '0');
      defsRoot.setAttribute('aria-hidden', 'true');
      defsRoot.style.cssText = 'position:absolute;pointer-events:none;overflow:visible';
      defsRoot.appendChild(document.createElementNS(SVG_NS, 'defs'));
      document.body.appendChild(defsRoot);
    }
    return defsRoot.firstElementChild;
  }

  function stableId(key) {
    // Two fixed FNV-1a passes make names independent of instance creation order.
    const hash = (text, seed) => {
      let value = seed;
      for (let i = 0; i < text.length; i++) {
        value = Math.imul(value ^ text.charCodeAt(i), 16777619);
      }
      return (value >>> 0).toString(16).padStart(8, '0');
    };
    return `bacom-liquid-glass-${hash(key, 2166136261)}${hash(key, 2246822519)}`;
  }

  const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));

  function bakeMap(w, h, radius, pageW, pageH, cfg) {
    const ss = Math.max(0.25, Math.min(SUPERSAMPLE, MAX_MAP_EDGE / Math.max(w, h)));
    const bw = Math.max(1, Math.round(w * ss));
    const bh = Math.max(1, Math.round(h * ss));
    const r = radius * ss;
    const minDim = Math.min(w, h);
    const dx = new Float32Array(bw * bh);
    const dy = new Float32Array(bw * bh);
    let maxAbs = 0;

    for (let py = 0; py < bh; py++) {
      for (let px = 0; px < bw; px++) {
        const cx = (px + 0.5) / bw;
        const cy = (py + 0.5) / bh;
        const tx = Math.abs(px + 0.5 - bw / 2) - (bw / 2 - r);
        const ty = Math.abs(py + 0.5 - bh / 2) - (bh / 2 - r);
        const outside = Math.hypot(Math.max(tx, 0), Math.max(ty, 0));
        const inside = Math.min(Math.max(tx, ty), 0);
        const distPx = Math.max(-(outside + inside - r), 0) / ss;
        const edgeFall = Math.exp(-distPx * cfg.edgeDistance);
        const rimFall = Math.exp(-distPx * cfg.rimDistance);
        const baseFall = 1 - Math.exp(-distPx * cfg.baseDistance);
        const total = (cfg.warp ? baseFall * cfg.baseIntensity : 0)
          + edgeFall * cfg.edgeIntensity + rimFall * cfg.rimIntensity;

        let nx = cx - 0.5;
        let ny = cy - 0.5;
        const len = Math.hypot(nx, ny);
        if (len > 0) { nx /= len; ny /= len; }
        const cornerNorm = Math.max(Math.min(cx, 1 - cx), Math.min(cy, 1 - cy)) * minDim;
        const corner = Math.exp(-cornerNorm * 0.3) * cfg.cornerBoost;
        const ripple = Math.sin((distPx / minDim) * 25) * cfg.rippleEffect * rimFall;
        const fx = (nx * (total + corner) - ny * ripple) * pageW;
        const fy = (ny * (total + corner) + nx * ripple) * pageH;
        const i = py * bw + px;
        dx[i] = fx;
        dy[i] = fy;
        maxAbs = Math.max(maxAbs, Math.abs(fx), Math.abs(fy));
      }
    }

    const scale = Math.max(maxAbs * 2, 1e-4);
    // Keep the reference's pre-subtracted 8-bit displacement decode bias.
    const bias = scale * (128 / 255 - 0.5);
    const canvas = document.createElement('canvas');
    canvas.width = bw;
    canvas.height = bh;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Liquid glass displacement map requires Canvas 2D.');
    const image = ctx.createImageData(bw, bh);
    for (let i = 0; i < bw * bh; i++) {
      image.data[i * 4] = clampByte(255 * (0.5 + (dx[i] - bias) / scale));
      image.data[i * 4 + 1] = clampByte(255 * (0.5 + (dy[i] - bias) / scale));
      image.data[i * 4 + 2] = 128;
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return { mapUrl: canvas.toDataURL('image/png'), scale };
  }

  function acquire(key, w, h, radius, pageW, pageH, cfg) {
    const cached = filters.get(key);
    if (cached?.node.isConnected) {
      cached.refs++;
      return cached;
    }
    if (cached) filters.delete(key);

    const { mapUrl, scale } = bakeMap(w, h, radius, pageW, pageH, cfg);
    const id = stableId(key);
    const node = document.createElementNS(SVG_NS, 'filter');
    node.id = id;
    const margin = scale / 2 + 3 * cfg.blurRadius * BLUR_STD_PER_RADIUS;
    const mx = margin / w * 100;
    const my = margin / h * 100;
    node.setAttribute('x', `${-mx}%`);
    node.setAttribute('y', `${-my}%`);
    node.setAttribute('width', `${100 + 2 * mx}%`);
    node.setAttribute('height', `${100 + 2 * my}%`);
    node.setAttribute('color-interpolation-filters', 'sRGB');

    const image = document.createElementNS(SVG_NS, 'feImage');
    image.setAttribute('href', mapUrl);
    image.setAttribute('x', '0');
    image.setAttribute('y', '0');
    image.setAttribute('width', String(w));
    image.setAttribute('height', String(h));
    image.setAttribute('preserveAspectRatio', 'none');
    image.setAttribute('result', 'map');

    const displacement = document.createElementNS(SVG_NS, 'feDisplacementMap');
    displacement.setAttribute('in', 'SourceGraphic');
    displacement.setAttribute('in2', 'map');
    displacement.setAttribute('scale', String(scale));
    displacement.setAttribute('xChannelSelector', 'R');
    displacement.setAttribute('yChannelSelector', 'G');
    displacement.setAttribute('result', 'displaced');

    const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
    blur.setAttribute('in', 'displaced');
    blur.setAttribute('stdDeviation', String(cfg.blurRadius * BLUR_STD_PER_RADIUS));
    node.append(image, displacement, blur);
    ensureDefs().appendChild(node);

    const decoded = new Image();
    decoded.src = mapUrl;
    const entry = { id, node, refs: 1, ready: decoded.decode() };
    filters.set(key, entry);
    return entry;
  }

  function release(key, entry) {
    if (!entry || --entry.refs > 0) return;
    // A detached defs tree may have caused a replacement with the same key.
    if (filters.get(key) === entry) filters.delete(key);
    entry.node.remove();
    if (!filters.size && defsRoot?.isConnected) {
      defsRoot.remove();
      defsRoot = null;
    }
  }

  function metrics(element) {
    // offsetWidth/Height exclude GSAP transforms and render-resolution scaling.
    const w = element.offsetWidth;
    const h = element.offsetHeight;
    const radiusText = getComputedStyle(element).borderTopLeftRadius;
    const value = parseFloat(radiusText) || 0;
    const radius = Math.max(0, Math.min(
      radiusText.trim().endsWith('%') ? value / 100 * Math.min(w, h) : value,
      Math.min(w, h) / 2,
    ));
    // The fixed composition stage is our page texture. A 4K output changes
    // the capture density, not the optical material's 1920×1080 CSS geometry.
    const stage = document.getElementById('main');
    const pageW = stage?.offsetWidth || window.innerWidth;
    const pageH = stage?.offsetHeight || window.innerHeight;
    const rawStrength = Number(element.dataset.glassStrength ?? 1);
    const strength = Number.isFinite(rawStrength) ? Math.max(0, Math.min(rawStrength, 4)) : 1;
    const rawBlur = Number(element.dataset.glassBlur ?? PRESET.blurRadius);
    const cfg = {
      ...PRESET,
      edgeIntensity: PRESET.edgeIntensity * strength,
      rimIntensity: PRESET.rimIntensity * strength,
      baseIntensity: PRESET.baseIntensity * strength,
      cornerBoost: PRESET.cornerBoost * strength,
      rippleEffect: PRESET.rippleEffect * strength,
      blurRadius: Number.isFinite(rawBlur) ? Math.max(0, Math.min(rawBlur, 20)) : PRESET.blurRadius,
      warp: element.dataset.glassWarp === 'true',
    };
    return { w, h, radius, pageW, pageH, cfg,
      key: [w, h, radius, pageW, pageH, JSON.stringify(cfg)].join('|') };
  }

  function createInstance(element) {
    const originalBackdrop = element.style.backdropFilter;
    const originalWebkit = element.style.webkitBackdropFilter;
    let currentKey = null;
    let currentEntry = null;
    const leases = new Map();
    let disposed = false;
    let scheduledFrame = 0;
    let activeReady = Promise.resolve();

    function releaseExcept(keep) {
      for (const [entry, key] of leases) {
        if (entry === keep) continue;
        release(key, entry);
        leases.delete(entry);
      }
    }

    function rebuild() {
      if (disposed || !element.isConnected) return Promise.resolve();
      const m = metrics(element);
      if (m.w < 2 || m.h < 2) return Promise.resolve();
      if (m.key === currentKey && currentEntry?.node.isConnected) return activeReady;
      let entry;
      try {
        entry = acquire(m.key, m.w, m.h, m.radius, m.pageW, m.pageH, m.cfg);
      } catch (error) {
        console.warn('Liquid glass retained its CSS frosting fallback:', error);
        return Promise.resolve();
      }
      currentKey = m.key;
      currentEntry = entry;
      if (leases.has(entry)) {
        // A rapid resize may return to an entry this instance still retains.
        // Balance acquire's extra reference rather than leasing it twice.
        release(m.key, entry);
      } else {
        leases.set(entry, m.key);
      }
      activeReady = entry.ready.then(() => {
        if (!disposed && currentEntry === entry && entry.node.isConnected) {
          element.style.backdropFilter = `url(#${entry.id})`;
          element.style.webkitBackdropFilter = `url(#${entry.id})`;
          element.dataset.glassReady = 'true';
          // Keep the old SVG filter alive until its replacement is decoded;
          // otherwise a real CSS resize would briefly leave an unresolved URL.
          releaseExcept(entry);
        }
      }).catch((error) => {
        if (!disposed && currentEntry === entry) {
          element.style.backdropFilter = originalBackdrop;
          element.style.webkitBackdropFilter = originalWebkit;
          delete element.dataset.glassReady;
          releaseExcept(null);
          currentKey = currentEntry = null;
        }
        console.warn('Liquid glass map decode failed; CSS frosting remains:', error);
      });
      return activeReady;
    }

    function schedule() {
      if (disposed) return;
      cancelAnimationFrame(scheduledFrame);
      scheduledFrame = requestAnimationFrame(() => {
        scheduledFrame = 0;
        void rebuild();
      });
    }

    const resize = new ResizeObserver(schedule);
    resize.observe(element);
    window.addEventListener('resize', schedule, { passive: true });
    const instance = {
      element,
      refresh: rebuild,
      dispose() {
        if (disposed) return;
        disposed = true;
        resize.disconnect();
        window.removeEventListener('resize', schedule);
        cancelAnimationFrame(scheduledFrame);
        releaseExcept(null);
        currentKey = currentEntry = null;
        element.style.backdropFilter = originalBackdrop;
        element.style.webkitBackdropFilter = originalWebkit;
        delete element.dataset.glassReady;
        instances.delete(element);
      },
    };
    instances.set(element, instance);
    return instance;
  }

  /**
   * Await once before registering/playing the composition timeline:
   *   const glass = await prepareLiquidGlass('[data-liquid-glass]');
   *   // ...later: glass.dispose() before removing/replacing the composition.
   *
   * Optional attributes: data-glass-warp="true" (decorative lenses only),
   * data-glass-strength="1.25", data-glass-blur="2". Defaults preserve a
   * readable, unwarped center. Attribute changes require handle.refresh().
   */
  window.prepareLiquidGlass = async (elements = '[data-liquid-glass]') => {
    const list = typeof elements === 'string'
      ? [...document.querySelectorAll(elements)]
      : elements instanceof Element ? [elements] : [...elements];
    const unique = [...new Set(list)].filter((element) => element instanceof HTMLElement);
    if (!supported()) {
      return { supported: false, elements: unique, refresh: async () => {}, dispose() {} };
    }
    const owned = unique.map((element) => instances.get(element) || createInstance(element));
    await Promise.all(owned.map((instance) => instance.refresh()));
    // Hyperframes can pause frame pumping until timeline registration, so
    // initialization must never wait for requestAnimationFrame. PNG decode
    // above is the asynchronous resource barrier; flush the assigned styles
    // synchronously before returning control to timeline creation.
    for (const element of unique) getComputedStyle(element).backdropFilter;
    return {
      supported: true,
      elements: unique,
      refresh: async () => { await Promise.all(owned.map((instance) => instance.refresh())); },
      dispose: () => { for (const instance of owned) instance.dispose(); },
    };
  };
})();
