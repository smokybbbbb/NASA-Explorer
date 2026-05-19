/* ================================================
   NASA Explorer · app.js
   ================================================ */

function getApiKey() {
  return CONFIG.apiKey;
}

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', () => {
  initStars();
  initNav();
  setFooterDate();
  loadAPOD();
  loadMarsPhotos();
  loadNEO();
});

/* ================================================
   STARS CANVAS
   ================================================ */
function initStars() {
  const canvas = document.getElementById('starsCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    buildStars();
  }

  function buildStars() {
    const count = Math.floor((canvas.width * canvas.height) / 6000);
    stars = Array.from({ length: count }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      r:     Math.random() * 1.1 + 0.2,
      alpha: Math.random() * 0.7 + 0.15,
      speed: Math.random() * 0.008 + 0.002,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  function draw(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      const a = s.alpha * (0.45 + 0.55 * Math.sin(t * s.speed + s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(draw);
}

/* ================================================
   NAV
   ================================================ */
function initNav() {
  const nav    = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  const mobile = document.getElementById('navMobile');

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  toggle.addEventListener('click', () => {
    const open = mobile.classList.toggle('open');
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open);
    mobile.setAttribute('aria-hidden', !open);
  });

  document.querySelectorAll('.nav-mobile-link').forEach(l =>
    l.addEventListener('click', () => {
      mobile.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      mobile.setAttribute('aria-hidden', 'true');
    })
  );
}

/* ================================================
   UTILITIES
   ================================================ */
function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

function fmtDateThai(str) {
  if (!str) return '—';
  try {
    return new Date(str).toLocaleDateString('th-TH', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return str; }
}

function fmtNum(n, decimals = 0) {
  return Number(n).toLocaleString('th-TH', { maximumFractionDigits: decimals });
}

function errorHTML(title, detail) {
  return `
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <h3>${title}</h3>
      <p>${detail || 'กรุณาลองใหม่ภายหลัง'}</p>
    </div>`;
}

/* -- localStorage cache -- */
function getCached(key) {
  try {
    const raw = localStorage.getItem(`nasa_cache_${key}`);
    if (!raw) return null;
    const { data, expires } = JSON.parse(raw);
    if (Date.now() > expires) { localStorage.removeItem(`nasa_cache_${key}`); return null; }
    return data;
  } catch { return null; }
}

function setCache(key, data, ttlMs) {
  try {
    localStorage.setItem(`nasa_cache_${key}`, JSON.stringify({ data, expires: Date.now() + ttlMs }));
  } catch {}
}

function clearCache() {
  Object.keys(localStorage)
    .filter(k => k.startsWith('nasa_cache_'))
    .forEach(k => localStorage.removeItem(k));
}

async function apiFetch(url, cacheKey, ttlMs) {
  if (cacheKey) {
    const hit = getCached(cacheKey);
    if (hit) { console.info(`[cache] ${cacheKey}`); return hit; }
  }
  const res = await fetch(url);
  if (res.status === 429) {
    showRateLimitBanner();
    throw new Error('rate_limited');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  // don't cache empty photo arrays — let next request retry
  const isEmpty = Array.isArray(data.latest_photos) && data.latest_photos.length === 0
               || Array.isArray(data.photos)         && data.photos.length === 0;
  if (cacheKey && ttlMs && !isEmpty) setCache(cacheKey, data, ttlMs);
  return data;
}

function setFooterDate() {
  const el = document.getElementById('footerDate');
  if (el) el.textContent = fmtDateThai(toDateStr(new Date()));
}

/* ================================================
   APOD
   ================================================ */
async function loadAPOD() {
  try {
    const data = await apiFetch(
      `${CONFIG.baseUrl}/planetary/apod?api_key=${getApiKey()}`,
      'apod_' + toDateStr(new Date()),
      CONFIG.cache.apod
    );
    renderAPOD(data);
  } catch (err) {
    document.getElementById('apodCard').innerHTML =
      errorHTML('ไม่สามารถโหลด APOD ได้', err.message);
  }
}

function renderAPOD(data) {
  const card     = document.getElementById('apodCard');
  const heroImg  = document.getElementById('heroImg');
  const dateLabel = document.getElementById('apodDateLabel');

  if (dateLabel) dateLabel.textContent = fmtDateThai(data.date);

  if (data.media_type === 'image' && heroImg) {
    heroImg.style.backgroundImage = `url('${data.hdurl || data.url}')`;
    setTimeout(() => heroImg.classList.add('loaded'), 100);
  }

  const isVideo  = data.media_type === 'video';
  const mediaEl  = isVideo
    ? `<iframe src="${data.url}" allowfullscreen title="${esc(data.title)}"></iframe>`
    : `<img src="${data.url}" alt="${esc(data.title)}" loading="lazy">
       ${data.copyright ? `<span class="apod-copyright">© ${esc(data.copyright.replace(/\n/g, ' '))}</span>` : ''}`;

  card.innerHTML = `
    <div class="apod-img-wrap fade-up">${mediaEl}</div>
    <div class="apod-info fade-up" style="animation-delay:.12s">
      <div class="apod-meta">
        <span class="apod-type">${isVideo ? '▶ VIDEO' : '◉ IMAGE'}</span>
        <span class="apod-date">${fmtDateThai(data.date)}</span>
      </div>
      <h3 class="apod-title">${esc(data.title)}</h3>
      <p class="apod-explanation">${esc(data.explanation)}</p>
      ${data.hdurl && !isVideo
        ? `<a href="${data.hdurl}" target="_blank" rel="noopener" class="apod-link">ดูภาพความละเอียดสูง →</a>`
        : ''}
    </div>`;
}

/* ================================================
   MARS — NASA Image & Video Library
   ================================================ */
async function loadMarsPhotos() {
  const grid = document.getElementById('marsGrid');
  const meta = document.getElementById('roverMeta');

  try {
    const { query, yearStart, photoLimit } = CONFIG.mars;
    const url = `${CONFIG.imagesUrl}/search?q=${encodeURIComponent(query)}`
              + `&media_type=image&year_start=${yearStart}&page_size=40`;

    const data = await apiFetch(url, 'mars_images', CONFIG.cache.marsImages);
    const items = (data.collection?.items || [])
      .filter(item => item.links?.length && item.data?.length)
      .slice(0, photoLimit);

    if (!items.length) {
      grid.innerHTML = errorHTML('ไม่พบภาพ Mars', 'ลองเปลี่ยน query ใน config.js');
      meta.innerHTML = '';
      return;
    }

    meta.innerHTML = `
      <div class="rover-chip">
        <span class="rover-chip-label">แหล่งข้อมูล</span>
        <span class="rover-chip-val">NASA Image Library</span>
      </div>
      <div class="rover-chip">
        <span class="rover-chip-label">ภารกิจ</span>
        <span class="rover-chip-val">Perseverance · Mars 2020</span>
      </div>
      <div class="rover-chip">
        <span class="rover-chip-label">ภาพที่พบ</span>
        <span class="rover-chip-val">${items.length} ภาพ</span>
      </div>`;

    grid.innerHTML = items.map((item, i) => {
      const d       = item.data[0];
      const thumb   = item.links[0].href;
      const fullUrl = `https://images-assets.nasa.gov/image/${d.nasa_id}/${d.nasa_id}~orig.jpg`;
      const date    = d.date_created ? d.date_created.slice(0, 10) : '';

      return `
        <div class="mars-card fade-up" style="animation-delay:${(i * 0.045).toFixed(2)}s"
             onclick="window.open('${fullUrl}','_blank')" role="button" tabindex="0"
             aria-label="${esc(d.title)}">
          <div class="mars-card-img">
            <img src="${thumb}" alt="${esc(d.title)}" loading="lazy">
          </div>
          <div class="mars-card-body">
            <div class="mars-card-camera">${esc(d.title)}</div>
            <div class="mars-card-sol">${date}</div>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    console.error('[Mars] load failed:', err);
    grid.innerHTML = errorHTML('ไม่สามารถโหลดภาพ Mars ได้', err.message);
    meta.innerHTML = '';
  }
}

/* ================================================
   NEAR EARTH OBJECTS
   ================================================ */
async function loadNEO() {
  try {
    const today = new Date();
    const start = toDateStr(today);
    const end   = toDateStr(new Date(today.getTime() + CONFIG.neo.rangeDays * 86400000));
    const data  = await apiFetch(
      `${CONFIG.baseUrl}/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=${getApiKey()}`,
      `neo_${start}`, CONFIG.cache.neo
    );
    renderNEO(data);
  } catch (err) {
    document.getElementById('neoGrid').innerHTML =
      errorHTML('ไม่สามารถโหลดข้อมูล Near Earth Objects ได้',
        err.message === 'rate_limited' ? 'DEMO_KEY ถึง rate limit — ใส่ API Key ของตัวเองด้านบนเพื่อปลดล็อก' : err.message);
    document.getElementById('neoSummary').innerHTML = '';
  }
}

function renderNEO(data) {
  const grid    = document.getElementById('neoGrid');
  const summary = document.getElementById('neoSummary');

  const all = [];
  for (const date of Object.keys(data.near_earth_objects)) {
    for (const neo of data.near_earth_objects[date]) all.push(neo);
  }

  all.sort((a, b) => {
    const da = a.close_approach_data[0]?.close_approach_date ?? '';
    const db = b.close_approach_data[0]?.close_approach_date ?? '';
    return da.localeCompare(db);
  });

  const hazardous = all.filter(n => n.is_potentially_hazardous_asteroid);
  const safe      = all.filter(n => !n.is_potentially_hazardous_asteroid);

  summary.innerHTML = `
    <div class="neo-stat-box">
      <div class="neo-stat-num is-total">${data.element_count}</div>
      <div class="neo-stat-label">วัตถุทั้งหมด</div>
    </div>
    <div class="neo-stat-box">
      <div class="neo-stat-num is-danger">${hazardous.length}</div>
      <div class="neo-stat-label">อาจเป็นอันตราย</div>
    </div>
    <div class="neo-stat-box">
      <div class="neo-stat-num is-safe">${safe.length}</div>
      <div class="neo-stat-label">ปลอดภัย</div>
    </div>`;

  // Boot 3D view
  initNEO3D(all);

  const display = all.slice(0, CONFIG.neo.displayLimit);
  grid.innerHTML = display.map((neo, i) => {
    const approach   = neo.close_approach_data[0];
    const danger     = neo.is_potentially_hazardous_asteroid;
    const dMin       = parseFloat(neo.estimated_diameter.meters.estimated_diameter_min).toFixed(0);
    const dMax       = parseFloat(neo.estimated_diameter.meters.estimated_diameter_max).toFixed(0);
    const speed      = parseFloat(approach?.relative_velocity.kilometers_per_hour ?? 0).toFixed(0);
    const lunarDist  = parseFloat(approach?.miss_distance.lunar ?? 0).toFixed(2);
    const kmDist     = parseFloat(approach?.miss_distance.kilometers ?? 0);
    const approachDate = approach?.close_approach_date ?? '';
    const cleanName  = esc(neo.name.replace(/[()]/g, '').trim());

    return `
    <div class="neo-card ${danger ? 'is-hazardous' : ''} fade-up" style="animation-delay:${(i * 0.05).toFixed(2)}s">
      <div class="neo-icon-box ${danger ? 'danger' : 'safe'}">${danger ? '☄️' : '🪨'}</div>
      <div style="overflow:hidden;min-width:0">
        <div class="neo-name" title="${cleanName}">${cleanName}</div>
        <div class="neo-approach-date">ใกล้โลกสุด: ${fmtDateThai(approachDate)}</div>
        <div class="neo-data-row">
          <div class="neo-data-item">
            <span class="neo-data-label">ขนาด</span>
            <span class="neo-data-val">${dMin}–${dMax} m</span>
          </div>
          <div class="neo-data-item">
            <span class="neo-data-label">ความเร็ว</span>
            <span class="neo-data-val">${fmtNum(speed)} km/h</span>
          </div>
          <div class="neo-data-item">
            <span class="neo-data-label">ระยะห่าง (LD)</span>
            <span class="neo-data-val">${lunarDist}</span>
          </div>
          <div class="neo-data-item">
            <span class="neo-data-label">ระยะห่าง (km)</span>
            <span class="neo-data-val">${fmtNum(kmDist / 1e6, 2)}M</span>
          </div>
        </div>
        <span class="neo-badge ${danger ? 'danger' : 'safe'}">${danger ? '⚠ อาจเป็นอันตราย' : '✓ ปลอดภัย'}</span>
      </div>
    </div>`;
  }).join('');
}

/* ================================================
   NEO 3D VISUALIZATION
   ================================================ */
function initNEO3D(neoList) {
  const container = document.getElementById('neo3d');
  const loading   = document.getElementById('neo3dLoading');
  if (!container || typeof THREE === 'undefined') return;

  const LD_SCALE = 3.2; // 1 lunar distance = 3.2 scene units
  const EARTH_R  = 1.1;

  /* -- Scene -- */
  const scene  = new THREE.Scene();
  const W = container.clientWidth;
  const H = container.clientHeight || 520;

  const camera = new THREE.PerspectiveCamera(52, W / H, 0.05, 2000);
  camera.position.set(0, 28, 62);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.insertBefore(renderer.domElement, container.firstChild);

  /* -- Controls -- */
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping  = true;
  controls.dampingFactor  = 0.07;
  controls.minDistance    = 4;
  controls.maxDistance    = 300;
  controls.autoRotate     = true;
  controls.autoRotateSpeed = 0.45;

  /* -- Lighting -- */
  scene.add(new THREE.AmbientLight(0x8899cc, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.05);
  sun.position.set(40, 25, 35);
  scene.add(sun);

  /* -- Earth -- */
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R, 64, 64),
    new THREE.MeshPhongMaterial({
      color: 0x1565c0, emissive: 0x062040,
      specular: 0x3d8ef5, shininess: 55,
    })
  );
  scene.add(earth);

  // Atmosphere halo
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R * 1.22, 48, 48),
    new THREE.MeshBasicMaterial({
      color: 0x2979ff, transparent: true, opacity: 0.065, side: THREE.BackSide,
    })
  ));

  /* -- Reference rings -- */
  addOrbitRing(scene,  1 * LD_SCALE, 0x5577cc, 0.65); // Moon orbit
  addOrbitRing(scene, 10 * LD_SCALE, 0x2a3d55, 0.38);
  addOrbitRing(scene, 20 * LD_SCALE, 0x2a3d55, 0.28);
  addOrbitRing(scene, 30 * LD_SCALE, 0x2a3d55, 0.20);

  // Moon position marker
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 16),
    new THREE.MeshPhongMaterial({ color: 0xaabbcc, emissive: 0x223344, shininess: 15 })
  );
  moon.position.set(1 * LD_SCALE, 0, 0);
  scene.add(moon);

  /* -- Asteroids -- */
  const meshes = [];
  const n = neoList.length;

  neoList.forEach((neo, i) => {
    const ap  = neo.close_approach_data[0];
    const ld  = parseFloat(ap?.miss_distance.lunar ?? 10);
    const dAvg = (
      parseFloat(neo.estimated_diameter.meters.estimated_diameter_min) +
      parseFloat(neo.estimated_diameter.meters.estimated_diameter_max)
    ) / 2;
    const danger = neo.is_potentially_hazardous_asteroid;

    // Fibonacci sphere — even angular spread, accurate radial distance
    const phi   = Math.acos(1 - 2 * (i + 0.5) / n);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const r     = ld * LD_SCALE;

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi) * 0.38; // slight disk flattening
    const z = r * Math.sin(phi) * Math.sin(theta);

    const meshR  = Math.max(0.07, Math.min(0.6, dAvg / 4000 + 0.07));
    const color  = danger ? 0xef5350 : 0x42a5f5;
    const emissive = danger ? 0x5a0a0a : 0x0a2244;

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(meshR, 14, 14),
      new THREE.MeshPhongMaterial({ color, emissive, shininess: 35 })
    );
    mesh.position.set(x, y, z);
    mesh.userData = {
      name:    neo.name.replace(/[()]/g, '').trim(),
      ld:      ld.toFixed(2),
      km:      parseFloat(ap?.miss_distance.kilometers ?? 0),
      speedKmh: parseFloat(ap?.relative_velocity.kilometers_per_hour ?? 0),
      dMin:    parseFloat(neo.estimated_diameter.meters.estimated_diameter_min).toFixed(0),
      dMax:    parseFloat(neo.estimated_diameter.meters.estimated_diameter_max).toFixed(0),
      danger,
      date:    ap?.close_approach_date ?? '',
    };
    scene.add(mesh);
    meshes.push(mesh);
  });

  /* -- Raycasting / Tooltip -- */
  const tooltip   = document.getElementById('neo3dTooltip');
  const raycaster = new THREE.Raycaster();
  const mouse     = new THREE.Vector2(-9, -9);
  let hovered = null;

  function onMove(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    mouse.x =  ((cx - rect.left) / rect.width)  * 2 - 1;
    mouse.y = -((cy - rect.top)  / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(meshes);

    if (hits.length > 0) {
      const obj = hits[0].object;
      if (hovered !== obj) {
        if (hovered) resetAsteroid(hovered);
        hovered = obj;
        obj.material.emissiveIntensity = 5;
        obj.scale.setScalar(1.5);
        controls.autoRotate = false;
      }
      const d = obj.userData;
      tooltip.innerHTML = `
        <div class="tt-name">${d.name}</div>
        <div class="tt-row">
          <span class="tt-label">ระยะห่าง</span>
          <span class="tt-val">${d.ld} LD</span>
        </div>
        <div class="tt-row">
          <span class="tt-label">ระยะห่าง (km)</span>
          <span class="tt-val">${(d.km / 1e6).toFixed(2)} ล้าน km</span>
        </div>
        <div class="tt-row">
          <span class="tt-label">ขนาด</span>
          <span class="tt-val">${d.dMin}–${d.dMax} m</span>
        </div>
        <div class="tt-row">
          <span class="tt-label">ความเร็ว</span>
          <span class="tt-val">${Math.round(d.speedKmh / 1000).toLocaleString()}k km/h</span>
        </div>
        <div class="tt-row">
          <span class="tt-label">ใกล้สุด</span>
          <span class="tt-val">${d.date}</span>
        </div>
        <div class="tt-badge ${d.danger ? 'danger' : 'safe'}">${d.danger ? '⚠ อาจเป็นอันตราย' : '✓ ปลอดภัย'}</div>`;
      tooltip.classList.add('visible');
      renderer.domElement.style.cursor = 'pointer';
    } else {
      if (hovered) { resetAsteroid(hovered); hovered = null; controls.autoRotate = true; }
      tooltip.classList.remove('visible');
      renderer.domElement.style.cursor = '';
    }
  }

  function resetAsteroid(obj) {
    obj.material.emissiveIntensity = 1;
    obj.scale.setScalar(1);
  }

  renderer.domElement.addEventListener('mousemove', onMove);
  renderer.domElement.addEventListener('mouseleave', () => {
    if (hovered) { resetAsteroid(hovered); hovered = null; controls.autoRotate = true; }
    tooltip.classList.remove('visible');
  });

  /* -- Animate -- */
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    earth.rotation.y  += 0.0025;
    moon.position.x    = Math.cos(Date.now() * 0.0003) * 1 * LD_SCALE;
    moon.position.z    = Math.sin(Date.now() * 0.0003) * 1 * LD_SCALE;
    renderer.render(scene, camera);
  }
  animate();

  /* -- Resize -- */
  new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = container.clientHeight || 520;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }).observe(container);

  /* -- Hide loading overlay -- */
  if (loading) {
    loading.classList.add('hidden');
    setTimeout(() => loading.remove(), 600);
  }
}

function addOrbitRing(scene, radius, color, opacity) {
  const pts = [];
  for (let i = 0; i <= 160; i++) {
    const a = (i / 160) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  scene.add(new THREE.Line(geo, mat));
}

/* ================================================
   ESCAPE HTML
   ================================================ */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
