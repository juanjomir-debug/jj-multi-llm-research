/**
 * App Store screenshot generator for ReliableAI
 * Produces 5 screenshots in 2 required iPhone sizes:
 *   - 6.9"  → 1320×2868 (iPhone 16 Pro Max)
 *   - 6.5"  → 1284×2778 (iPhone 11 Pro Max)
 * Output: reliableai/public/screenshots/
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3001';
const OUT_DIR = path.join(__dirname, '../reliableai/public/screenshots');

const DEVICES = [
  { name: '6.9in', width: 440, height: 956, dpr: 3 },   // → 1320×2868
  { name: '6.5in', width: 428, height: 926, dpr: 3 },   // → 1284×2778
];

const MOCK_QUERY = 'What are the long-term risks of artificial general intelligence?';

const MOCK_RESPONSES = {
  anthropic: {
    label: 'Claude', color: '#cf7d4e', icon: '🟠', time: '4.2s',
    html: `<p><strong>Alignment failure</strong> represents the most cited existential concern — an AGI system that pursues misspecified objectives at a civilizational scale. Unlike narrow AI, a sufficiently capable system acting on subtly wrong goals could cause irreversible harm before humans could intervene.</p>
<p><strong>Power concentration</strong> is a near-term structural risk. The first entities to deploy transformative AGI gain asymmetric leverage over global systems, potentially locking in autocratic control structures.</p>
<p><strong>Economic displacement</strong> at scale differs qualitatively from previous technological disruptions: AGI could compress the adaptation window to years rather than decades, outpacing social safety nets and democratic institutions.</p>`
  },
  openai: {
    label: 'GPT-4o', color: '#74aa9c', icon: '⚫', time: '3.8s',
    html: `<p><strong>Short-term (5–15 years):</strong> Accelerated misinformation, labor market disruption, and dual-use misuse in cybersecurity and bioweapons development.</p>
<p><strong>Medium-term (15–40 years):</strong> Erosion of human epistemic autonomy as AI systems mediate most information. Democratic institutions may struggle to maintain legitimacy.</p>
<p><strong>Long-term (40+ years):</strong> Value lock-in — a world optimized for the values of AGI developers rather than humanity broadly. This includes both misaligned AI and correctly-specified-but-narrow AI risks.</p>`
  },
  google: {
    label: 'Gemini', color: '#4285f4', icon: '🔵', time: '5.1s',
    html: `<p>AGI risk is best understood as a <strong>control problem</strong> compounded by a <strong>coordination problem</strong>.</p>
<p>The control dimension: as capability increases, the gap between what a system can do and what humans can verify widens. Current interpretability research is advancing far slower than capabilities.</p>
<p>The coordination dimension: even if individual labs maintain responsible practices, competitive dynamics create race-to-the-bottom incentives. The Nash equilibrium without binding international agreements is likely unsafe deployment timelines.</p>`
  },
  xai: {
    label: 'Grok', color: '#e7e7e7', icon: '✖️', time: '3.3s',
    html: `<p><strong>Well-evidenced risks:</strong> economic disruption, concentration of power among AI developers, erosion of information ecosystems. These are already happening at narrow-AI scale.</p>
<p><strong>Plausible but uncertain:</strong> recursive self-improvement leading to rapid capability jumps, deceptive alignment where systems pursue different objectives at deployment.</p>
<p>The honest answer is that we don't know which risks will materialize — which is itself the strongest argument for maintaining human oversight and proceeding cautiously.</p>`
  }
};

const MOCK_SYNTHESIS = `
<div style="padding:8px 12px;background:rgba(207,125,78,0.08);border-bottom:1px solid rgba(207,125,78,0.2);border-radius:4px 4px 0 0;display:flex;align-items:center;gap:8px">
  <span style="color:#cf7d4e;font-weight:700;font-size:.9rem">⚡ Integrated Synthesis</span>
  <span style="font-size:.7rem;color:var(--text-muted);margin-left:auto">4 models · ✓ 5.1s</span>
</div>
<div style="padding:12px">
  <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
    <div style="background:rgba(76,175,114,0.15);border:1px solid rgba(76,175,114,0.4);border-radius:8px;padding:5px 12px;font-size:.8rem;color:#4caf72;font-weight:700">● High consensus (3/4)</div>
    <div style="background:rgba(207,125,78,0.15);border:1px solid rgba(207,125,78,0.4);border-radius:8px;padding:5px 12px;font-size:.8rem;color:#cf7d4e;font-weight:700">⚔ 1 contradiction flagged</div>
  </div>
  <div style="font-size:.88rem;line-height:1.75;color:var(--text)">
    <p><strong>Points of strong consensus (4/4 models):</strong></p>
    <ul style="padding-left:18px;margin:8px 0;display:flex;flex-direction:column;gap:5px;color:var(--text-muted);font-size:.85rem">
      <li>Alignment failure is the primary long-term technical risk</li>
      <li>Power concentration among early AGI developers is a structural risk</li>
      <li>Economic disruption will compress societal adaptation timelines</li>
      <li>International coordination is necessary but currently insufficient</li>
    </ul>
    <div style="background:rgba(255,80,80,0.08);border-left:3px solid rgba(255,80,80,0.5);border-radius:0 8px 8px 0;padding:10px 12px;margin:12px 0;font-size:.83rem;color:var(--text-muted)">
      <span style="color:#ff5555;font-weight:700">⚔ Divergence:</span> <strong>Grok</strong> argues long-horizon existential scenarios are "speculative and should not dominate policy discussion," while <strong>Claude</strong> and <strong>Gemini</strong> treat value misalignment as a first-order existential risk worth sustained research investment.
    </div>
    <p><strong>Synthesis:</strong> All four models converge on near-term tractable risks while diverging on the weight assigned to long-horizon existential scenarios. The most defensible posture addresses both: near-term regulation of dual-use capabilities plus investment in alignment research and interpretability.</p>
  </div>
</div>`;

async function injectResults(page) {
  await page.evaluate(({ responses, synthesis, query }) => {
    const answersArea = document.getElementById('answersArea');
    const tabsBar = document.getElementById('resultTabsBar');
    const hint = document.getElementById('selectModelsHint');
    if (hint) hint.style.display = 'none';

    // Remove existing model panels & tabs
    document.querySelectorAll('.tab-panel[id^="tabPanel-"]:not(#tabPanel-integration)').forEach(el => el.remove());
    tabsBar.querySelectorAll('.result-tab:not([data-tab="integration"])').forEach(el => el.remove());

    const intPanel = document.getElementById('tabPanel-integration');

    Object.entries(responses).forEach(([id, p], i) => {
      // Tab button
      const btn = document.createElement('button');
      btn.className = 'result-tab' + (i === 0 ? ' active' : '');
      btn.dataset.tab = `model-${id}`;
      btn.onclick = () => window.switchResultTab(`model-${id}`);
      btn.innerHTML = `${p.icon} ${p.label}<span class="tab-model-ver" style="font-size:.65rem;opacity:.7;margin-left:4px">${p.label}</span><span class="tab-status done fast" style="font-size:.65rem;margin-left:4px">✓ ${p.time}</span>`;
      tabsBar.insertBefore(btn, tabsBar.querySelector('[data-tab="integration"]'));

      // Panel
      const panel = document.createElement('div');
      panel.className = 'tab-panel' + (i === 0 ? ' tab-panel-active' : '');
      panel.id = `tabPanel-${id}`;
      panel.style.display = i === 0 ? '' : 'none';
      panel.innerHTML = `
        <div style="padding:6px 12px;display:flex;align-items:center;gap:8px;background:var(--surface2);border-bottom:1px solid var(--border);border-radius:4px 4px 0 0">
          <span style="color:${p.color};font-weight:700;font-size:.9rem">${p.icon} ${p.label}</span>
          <span style="font-size:.7rem;color:var(--text-muted);margin-left:auto">✓ ${p.time}</span>
        </div>
        <div style="margin:10px 12px;background:rgba(207,125,78,0.12);border-radius:12px 12px 12px 2px;padding:10px 14px;font-size:.85rem;color:var(--text)">${query}</div>
        <div style="padding:12px;font-size:.88rem;line-height:1.75;color:var(--text)">${p.html}</div>
        <div style="display:flex;align-items:center;gap:10px;padding:6px 12px;font-size:.72rem;color:var(--text-muted);border-top:1px solid var(--border)">
          <span>~420 tokens · $0.0021</span>
          <span style="margin-left:auto;display:flex;gap:8px">
            <button style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.1rem">👍</button>
            <button style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.1rem">👎</button>
          </span>
        </div>`;
      answersArea.insertBefore(panel, intPanel);
    });

    // Populate integration panel
    const intResult = document.getElementById('integratorResultArea');
    if (intResult) intResult.innerHTML = synthesis;

    tabsBar.style.display = 'flex';
    tabsBar.classList.add('active');
  }, { responses: MOCK_RESPONSES, synthesis: MOCK_SYNTHESIS, query: MOCK_QUERY });
}

async function dismissOverlays(page) {
  // Dismiss cookie banner
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const accept = btns.find(b => b.textContent.trim() === 'Accept');
    if (accept) accept.click();
    // Hide auth overlay if present
    const auth = document.getElementById('authOverlay');
    if (auth) auth.style.display = 'none';
  });
  await page.waitForTimeout(300);
}

async function takeScreenshots(page, device, outDir) {
  const shots = [];

  // --- Screen 1: Landing hero ---
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await dismissOverlays(page);
  await page.waitForTimeout(400);
  shots.push({ name: '01-landing', page });
  await page.screenshot({
    path: path.join(outDir, `${device.name}_01_landing.png`),
    fullPage: false,
    clip: { x: 0, y: 0, width: device.width, height: device.height }
  });
  console.log(`  ✓ 01 landing`);

  // --- Screen 2: App input UI ---
  await page.goto(`${BASE_URL}/analyze`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await dismissOverlays(page);
  // Close auth modal
  await page.evaluate(() => {
    const auth = document.getElementById('authOverlay');
    if (auth) auth.style.display = 'none';
    const ta = document.getElementById('questionInput');
    if (ta) { ta.value = 'What are the long-term risks of artificial general intelligence?'; ta.dispatchEvent(new Event('input', { bubbles: true })); }
    // Dismiss welcome tooltip
    const btns = Array.from(document.querySelectorAll('button'));
    const ent = btns.find(b => b.textContent.includes('Entendido'));
    if (ent) ent.click();
  });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outDir, `${device.name}_02_input.png`),
    fullPage: false,
    clip: { x: 0, y: 0, width: device.width, height: device.height }
  });
  console.log(`  ✓ 02 input`);

  // --- Screen 3: Claude results ---
  await injectResults(page);
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outDir, `${device.name}_03_results_claude.png`),
    fullPage: false,
    clip: { x: 0, y: 0, width: device.width, height: device.height }
  });
  console.log(`  ✓ 03 results-claude`);

  // --- Screen 4: Integrated Synthesis ---
  await page.evaluate(() => {
    if (window.switchResultTab) window.switchResultTab('integration');
  });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outDir, `${device.name}_04_synthesis.png`),
    fullPage: false,
    clip: { x: 0, y: 0, width: device.width, height: device.height }
  });
  console.log(`  ✓ 04 synthesis`);

  // --- Screen 5: Pricing ---
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await dismissOverlays(page);
  await page.evaluate(() => {
    const el = document.getElementById('pricing');
    if (el) el.scrollIntoView({ behavior: 'instant' });
  });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outDir, `${device.name}_05_pricing.png`),
    fullPage: false,
    clip: { x: 0, y: 0, width: device.width, height: device.height }
  });
  console.log(`  ✓ 05 pricing`);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\n📸 ReliableAI App Store Screenshot Generator`);
  console.log(`Output: ${OUT_DIR}\n`);

  const browser = await chromium.launch({ headless: true });

  for (const device of DEVICES) {
    console.log(`\n📱 ${device.name} (${device.width * device.dpr}×${device.height * device.dpr}px)`);
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.dpr,
      colorScheme: 'dark',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    });
    const page = await context.newPage();
    await takeScreenshots(page, device, OUT_DIR);
    await context.close();
  }

  await browser.close();

  console.log('\n✅ Done! Files saved:');
  fs.readdirSync(OUT_DIR).forEach(f => {
    const size = (fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(0);
    console.log(`  ${f} (${size}KB)`);
  });
})();
