// --- SPA Navigation and Init ---
document.addEventListener('DOMContentLoaded', () => {
    // Set current year in footer
    const yearEl = document.getElementById("y");
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    // View Switching Logic
    const tryBtn = document.getElementById('try-calc-btn');
    if (tryBtn) {
        tryBtn.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('calc-view');
        });
    }

    const backBtn = document.getElementById('back-home-btn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('home-view');
        });
    }

    const steelBtn = document.getElementById('nav-steel-btn');
    if (steelBtn) {
        steelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('steel-view');
        });
    }

    const steelBackBtn = document.getElementById('steel-back-btn');
    if (steelBackBtn) {
        steelBackBtn.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('home-view');
        });
    }

    // Attach mouse pan/zoom to SVGs
    const pscSvg = document.getElementById('svg');
    if (pscSvg) attachPanZoom(pscSvg, 'psc');
    const initialSteelSvg = document.getElementById('steel-svg');
    if (initialSteelSvg) attachPanZoom(initialSteelSvg, 'steel');

    // Initialize calculator UI
    if (document.getElementById("calcBtn")) {
        document.getElementById("calcBtn").addEventListener("click", updateUI);
        document.getElementById("pdfBtn").addEventListener("click", downloadPDF);
        document.getElementById("dxfBtn").addEventListener("click", downloadDXF);

        document.getElementById("resetBtn").addEventListener("click", () => {
            el("D").value = 1372;
            el("tw").value = 203;
            el("bt").value = 508;
            el("tt").value = 200;
            el("bb").value = 660;
            el("tb").value = 220;
            el("ht").value = 250;
            el("hb").value = 300;
            el("gamma").value = 25;
            el("rtitle").value = "PSC Girder Section Property Report";
            updateUI();
        });

        // Trigger initial draw
        updateUI();
    }
});

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.remove('hidden');
    }

    if (viewId === 'calc-view') {
        updateUI();
    }
    if (viewId === 'steel-view') {
        initSteelDB();
    }
    // Scroll to top when switching views
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Steel Database Logic (SQLite via sql.js) ---
let steelDbInitialized = false;
let currentSQLDB = null;
let currentUnits = null; // Stores unit metadata from DB
let isMetric = true;     // UI Toggle state

// Shared pan/zoom state for SVGs
const panZoomStates = {
    psc: { zoom: 1, panX: 0, panY: 0 },
    steel: { zoom: 1, panX: 0, panY: 0 }
};

function attachPanZoom(svg, key) {
    if (!svg || !panZoomStates[key]) return;

    const state = panZoomStates[key];
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    function applyTransform() {
        svg.style.transformOrigin = '50% 50%';
        svg.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
    }

    applyTransform();
    svg.style.cursor = 'grab';

    svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const newZoom = Math.min(4, Math.max(0.4, state.zoom * factor));
        state.zoom = newZoom;
        applyTransform();
    }, { passive: false });

    svg.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        svg.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        state.panX += dx;
        state.panY += dy;
        applyTransform();
    });

    window.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        svg.style.cursor = 'grab';
    });
}

async function initSteelDB() {
    if (steelDbInitialized) return;

    const stdSelect = document.getElementById('steel-standard');
    const shapeSelect = document.getElementById('steel-shape');
    const desSelect = document.getElementById('steel-designation');
    const unitSelect = document.getElementById('steel-units');

    // Populate standards from databases.js (steelDBs global var)
    if (typeof steelDBs === 'undefined') {
        document.getElementById('steel-props-body').innerHTML = `<tr><td class="muted">databases.js not found. Run builder script.</td></tr>`;
        return;
    }

    const standards = Object.keys(steelDBs).sort();
    stdSelect.innerHTML = standards.map(s => `<option value="${s}">${s}</option>`).join('');

    // Load SQL.js
    let SQL;
    try {
        SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
    } catch (e) {
        console.error("Failed to init sql.js", e);
        return;
    }

    // Convert base64 to Uint8Array
    function b64ToUint8Array(b64) {
        const binString = atob(b64);
        const size = binString.length;
        const bytes = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            bytes[i] = binString.charCodeAt(i);
        }
        return bytes;
    }

    function loadDatabase(dbName) {
        if (currentSQLDB) {
            currentSQLDB.close();
        }

        const b64 = steelDBs[dbName];
        if (!b64) return;

        currentSQLDB = new SQL.Database(b64ToUint8Array(b64));

        // Load Units Metadata
        currentUnits = {};
        try {
            const res = currentSQLDB.exec("SELECT * FROM 'Field Units' LIMIT 1;");
            if (res.length > 0) {
                const cols = res[0].columns;
                const vals = res[0].values[0];
                cols.forEach((c, i) => currentUnits[c] = vals[i]);
            }
        } catch (e) { console.log('No unit table found.'); }

        updateSteelShapes(shapeSelect, desSelect);
    }

    stdSelect.addEventListener('change', () => loadDatabase(stdSelect.value));
    shapeSelect.addEventListener('change', () => updateSteelDesignations(desSelect, shapeSelect.value));
    desSelect.addEventListener('change', () => renderSteelProperties(desSelect.value, shapeSelect.value));
    unitSelect.addEventListener('change', () => {
        isMetric = unitSelect.value === 'Metric';
        renderSteelProperties(desSelect.value, shapeSelect.value);
    });

    // Trigger initial population
    if (standards.length > 0) {
        loadDatabase(standards[0]);
    }
    steelDbInitialized = true;
}

function updateSteelShapes(shapeSelect, desSelect) {
    if (!currentSQLDB) return;

    // Find valid tables
    const ignore = ['DBInfo', 'Field Units', 'sqlite_sequence'];
    const q = "SELECT name FROM sqlite_master WHERE type='table';";
    const res = currentSQLDB.exec(q);

    let shapes = [];
    if (res.length > 0) {
        shapes = res[0].values.map(r => r[0]).filter(t => !ignore.includes(t));
    }

    shapeSelect.innerHTML = shapes.map(s => `<option value="${s}">${s}</option>`).join('');
    if (shapes.length > 0) {
        updateSteelDesignations(desSelect, shapes[0]);
    } else {
        desSelect.innerHTML = '';
        document.getElementById('steel-props-body').innerHTML = `<tr><td class="muted">No tables found in DB.</td></tr>`;
    }
}

function updateSteelDesignations(desSelect, shape) {
    if (!currentSQLDB || !shape) return;
    try {
        const q = `SELECT Name FROM '${shape}' ORDER BY RECNO ASC;`;
        const res = currentSQLDB.exec(q);

        if (res.length > 0) {
            const desigs = res[0].values.map(r => r[0]);
            desSelect.innerHTML = desigs.map(d => `<option value="${d}">${d}</option>`).join('');
            if (desigs.length > 0) {
                renderSteelProperties(desigs[0], shape);
            }
        }
    } catch (e) {
        desSelect.innerHTML = '';
        console.error(e);
    }
}

function autoConvert(val, nativeUnit, toMetric) {
    if (!val || isNaN(val)) return { v: val, u: nativeUnit };

    let v = parseFloat(val);
    let u = (nativeUnit || '').trim().replace('^2', '2').replace('^3', '3').replace('^4', '4');

    const isImperialUnit = u.startsWith('in') || u.includes('lb') || u.includes('kip');
    const isMetricUnit = u.startsWith('mm') || u.startsWith('cm') || u.startsWith('m') || u.includes('kg') || u.includes('kN');

    if (toMetric && isMetricUnit) return { v: v.toFixed(2), u: u.replace('2', '²').replace('3', '³').replace('4', '⁴') };
    if (!toMetric && isImperialUnit) return { v: v.toFixed(3), u: u.replace('2', '²').replace('3', '³').replace('4', '⁴') };

    if (toMetric && isImperialUnit) {
        if (u === 'in') { v *= 25.4; u = 'mm'; }
        else if (u === 'in2') { v *= 6.4516; u = 'cm²'; }
        else if (u === 'in3') { v *= 16.3871; u = 'cm³'; }
        else if (u === 'in4') { v *= 41.6231; u = 'cm⁴'; }
        else if (u === 'lbs/ft' || u === 'lb/ft') { v *= 1.48816; u = 'kg/m'; }
        else if (u === 'kips/ft' || u === 'kip/ft') { v *= 14.5939; u = 'kN/m'; }
        return { v: v.toFixed(2), u };
    }

    if (!toMetric && isMetricUnit) {
        if (u === 'mm') { v /= 25.4; u = 'in'; }
        else if (u === 'cm') { v /= 2.54; u = 'in'; }
        else if (u === 'cm2') { v /= 6.4516; u = 'in²'; }
        else if (u === 'cm3') { v /= 16.3871; u = 'in³'; }
        else if (u === 'cm4') { v /= 41.6231; u = 'in⁴'; }
        else if (u === 'kg/m') { v /= 1.48816; u = 'lb/ft'; }
        else if (u === 'kN/m') { v /= 14.5939; u = 'kip/ft'; }
        return { v: v.toFixed(3), u };
    }

    return { v: v.toFixed(2), u: u.replace('2', '²').replace('3', '³').replace('4', '⁴') };
}

function drawDynamicSVG(shapeName, p) {
    // Normalize shape name for robust matching across different databases
    const s = shapeName.toLowerCase();
    const norm = s.replace(/[^a-z0-9]/g, '');

    // Safely parse properties
    const D = p.D ? parseFloat(p.D.v) : (p.OD ? parseFloat(p.OD.v) : 100);
    const Bf = p.Bf ? parseFloat(p.Bf.v) : (p.B ? parseFloat(p.B.v) : 50);
    const Tf = p.Tf ? parseFloat(p.Tf.v) : (p.T ? parseFloat(p.T.v) : 10);
    const Tw = p.Tw ? parseFloat(p.Tw.v) : 5;

    // ViewBox scaling based on max dimension
    const maxDim = Math.max(D, Bf) || 100;
    // Increase padding slightly so that dynamically scaled text never clips off-screen
    const pad = maxDim * 0.65;
    const vW = maxDim + pad * 2;
    const vH = maxDim + pad * 2;
    // Shift origin so (0,0) is center
    const viewBox = `viewBox="-${vW / 2} -${vH / 2} ${vW} ${vH}"`;

    // Calculate dynamic scaling parameters for SVG features proportional to geometry
    const strokeW = Math.max(maxDim * 0.012, 0.5);
    const dimStrokeW = Math.max(maxDim * 0.008, 0.3);
    const fontSize = Math.max(maxDim * 0.075, 3);
    const arrSize = Math.max(maxDim * 0.045, 2);
    const dash = `${maxDim * 0.03},${maxDim * 0.03}`;

    const style = `fill="var(--shapeFill)" stroke="var(--shapeStroke)" stroke-width="${strokeW}" stroke-linejoin="round"`;
    const dimStyle = `stroke="var(--muted)" stroke-width="${dimStrokeW}" stroke-dasharray="${dash}"`;
    // Add text background via a filter to make text pop over the drawing. Removing 'px' forces relative scaling.
    const textStyle = `fill="var(--text)" font-size="${fontSize}" font-weight="500" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle" filter="url(#solid)"`;
    const arrStyle = `fill="var(--muted)"`;

    let svg = `<svg id="steel-svg" ${viewBox} width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="${arrSize}" markerHeight="${arrSize}" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
            <path d="M 0 0 L 10 5 L 0 10 z" ${arrStyle}/>
        </marker>
        <filter x="-0.15" y="-0.15" width="1.3" height="1.3" id="solid">
            <feFlood flood-color="rgba(20,25,45,0.9)" result="bg"/>
            <feMerge>
                <feMergeNode in="bg"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>
    </defs>`;

    // Helper to draw a dimension line
    function drawDim(x1, y1, x2, y2, labelText, pt, offset, isVertical) {
        if (!pt || !pt.v) return '';
        const lbl = pt.v + ' ' + pt.u;

        let dx = isVertical ? offset : 0;
        let dy = isVertical ? 0 : offset;

        let tx = (x1 + x2) / 2 + dx;
        let ty = (y1 + y2) / 2 + dy;

        // Shift text proportionally by font size to avoid overlapping the exact axis line
        const shiftAmt = fontSize * 1.05;
        if (isVertical) tx += (offset > 0 ? shiftAmt : -shiftAmt);
        if (!isVertical) ty += (offset > 0 ? shiftAmt : -shiftAmt);

        return `
            <line x1="${x1}" y1="${y1}" x2="${x1 + dx}" y2="${y1 + dy}" ${dimStyle} />
            <line x1="${x2}" y1="${y2}" x2="${x2 + dx}" y2="${y2 + dy}" ${dimStyle} />
            <line x1="${x1 + dx}" y1="${y1 + dy}" x2="${x2 + dx}" y2="${y2 + dy}" stroke="var(--muted)" stroke-width="${dimStrokeW}" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
            <text x="${tx}" y="${ty}" ${textStyle}>${lbl}</text>
        `;
    }

    // Wide‑flange / I-beam family
    if (
        // Common wide‑flange / I‑beam labels
        s.includes('i shape') || s.includes('w shape') || s.includes('s shape') || s.includes('m shape') ||
        s.includes('npb') || s.includes('wpb') || s.includes('beam') ||
        // Some databases (e.g. AISC) may use "B Shape" or similar for beam tables
        s.includes('b shape') ||
        // Normalized variants without spaces / hyphens
        norm.includes('ishape') || norm.includes('wshape') || norm.includes('bshape') ||
        norm.includes('ipe') || norm.includes('heb')
    ) {
        const curD = D / 2; const curB = Bf / 2; const curTf = Tf; const curTw = Tw / 2;
        svg += `<path d="
            M -${curB} -${curD} 
            L  ${curB} -${curD} 
            L  ${curB} -${curD - curTf} 
            L  ${curTw} -${curD - curTf} 
            L  ${curTw}  ${curD - curTf} 
            L  ${curB}  ${curD - curTf} 
            L  ${curB}  ${curD} 
            L -${curB}  ${curD} 
            L -${curB}  ${curD - curTf} 
            L -${curTw}  ${curD - curTf} 
            L -${curTw} -${curD - curTf} 
            L -${curB} -${curD - curTf} Z" ${style}/>`;

        svg += drawDim(-curB, -curD, -curB, curD, 'D', p.D, -pad * 0.5, true);
        svg += drawDim(-curB, curD, curB, curD, 'Bf', p.Bf, pad * 0.3, false);
        svg += drawDim(curB, -curD, curB, -curD + curTf, 'Tf', p.Tf, pad * 0.3, true);
        svg += drawDim(-curTw, 0, curTw, 0, 'Tw', p.Tw, -pad * 0.2, false);

        // Channels
    } else if (s.includes('channel') || s.includes('c shape') || norm.includes('cshape')) {
        const curD = D / 2; const curB = Bf; const curTf = Tf; const curTw = Tw;
        const oX = curB / 2;
        svg += `<path d="
            M -${oX} -${curD} 
            L  ${curB - oX} -${curD} 
            L  ${curB - oX} -${curD - curTf} 
            L -${oX - curTw} -${curD - curTf} 
            L -${oX - curTw}  ${curD - curTf} 
            L  ${curB - oX}  ${curD - curTf} 
            L  ${curB - oX}  ${curD} 
            L -${oX}  ${curD} Z" ${style}/>`;

        svg += drawDim(-oX, -curD, -oX, curD, 'D', p.D, -pad * 0.5, true);
        svg += drawDim(-oX, curD, curB - oX, curD, 'Bf', p.Bf || p.B, pad * 0.3, false);
        svg += drawDim(-oX, 0, -oX + curTw, 0, 'Tw', p.Tw, -pad * 0.3, false);
        svg += drawDim(curB - oX, -curD, curB - oX, -curD + curTf, 'Tf', p.Tf, pad * 0.3, true);

        // Angles
    } else if (s.includes('angle') || norm.includes('angle') || norm.startsWith('l')) {
        const curD = D; const curB = Bf; const curT = Tf;
        const ox = curB / 2; const oy = curD / 2;
        svg += `<path d="
            M -${ox} -${oy}
            L -${ox - curT} -${oy}
            L -${ox - curT}  ${oy - curT}
            L  ${curB - ox}  ${oy - curT}
            L  ${curB - ox}  ${oy}
            L -${ox}  ${oy} Z" ${style}/>`;

        svg += drawDim(-ox, -oy, -ox, oy, 'D', p.D, -pad * 0.5, true);
        svg += drawDim(-ox, oy, curB - ox, oy, 'B', p.B || p.Bf, pad * 0.3, false);
        svg += drawDim(-ox, -oy, -ox + curT, -oy, 'T', p.T || p.Tf || p.Tw, -pad * 0.3, false);

        // Rectangular / square tubes
    } else if (s.includes('tube') || s.includes('box') || norm.includes('rhs') || norm.includes('shs')) {
        const curD = D / 2; const curB = Bf / 2; const curT = Tf;
        svg += `
            <path d="M -${curB} -${curD} L ${curB} -${curD} L ${curB} ${curD} L -${curB} ${curD} Z" ${style} fill="none"/>
            <path d="M -${curB - curT} -${curD - curT} L ${curB - curT} -${curD - curT} L ${curB - curT} ${curD - curT} L -${curB - curT} ${curD - curT} Z" ${style} fill="none"/>
            <path d="M -${curB} -${curD} L ${curB} -${curD} L ${curB} ${curD} L -${curB} ${curD} Z M -${curB - curT} -${curD - curT} L -${curB - curT} ${curD - curT} L ${curB - curT} ${curD - curT} L ${curB - curT} -${curD - curT} Z" fill="var(--shapeFill)" fill-rule="evenodd" stroke="none"/>
        `;
        svg += drawDim(-curB, -curD, -curB, curD, 'D', p.D, -pad * 0.5, true);
        svg += drawDim(-curB, curD, curB, curD, 'B', p.B || p.Bf, pad * 0.3, false);
        svg += drawDim(curB - curT, 0, curB, 0, 'T', p.T || p.Tf || p.Tw, pad * 0.4, false);

        // Circular hollow sections / pipes
    } else if (s.includes('pipe') || s.includes('chs') || norm.includes('circularhollow')) {
        const r = D / 2; const r2 = r - Tw;
        svg += `
            <circle cx="0" cy="0" r="${r}" fill="none" ${style}/>
            <circle cx="0" cy="0" r="${r2}" fill="none" ${style}/>
            <path d="M 0 -${r} A ${r} ${r} 0 1 1 -0.01 -${r} M 0 -${r2} A ${r2} ${r2} 0 1 0 -0.01 -${r2} Z" fill="var(--shapeFill)" stroke="none"/>
        `;
        svg += drawDim(-r, r + pad * 0.1, r, r + pad * 0.1, 'OD', p.OD || p.D, pad * 0.3, false);
        svg += drawDim(r2, 0, r, 0, 'Tw', p.Tw || p.T || p.Tf, pad * 0.3, true);

    } else if (s.includes('t shape')) {
        const curD = D; const curB = Bf / 2; const curTf = Tf; const curTw = Tw / 2;
        const oy = curD / 2;
        svg += `<path d="
            M -${curB} -${oy} 
            L  ${curB} -${oy} 
            L  ${curB} -${oy - curTf} 
            L  ${curTw} -${oy - curTf} 
            L  ${curTw}  ${oy} 
            L -${curTw}  ${oy} 
            L -${curTw} -${oy - curTf} 
            L -${curB} -${oy - curTf} Z" ${style}/>`;

        svg += drawDim(-curB, -oy, -curB, oy, 'D', p.D, -pad * 0.5, true);
        svg += drawDim(-curB, -oy, curB, -oy, 'Bf', p.Bf || p.B, -pad * 0.3, false);
        svg += drawDim(curB, -oy, curB, -oy + curTf, 'Tf', p.Tf, pad * 0.3, true);
        svg += drawDim(-curTw, oy - pad * 0.1, curTw, oy - pad * 0.1, 'Tw', p.Tw, pad * 0.3, false);

    } else {
        svg += `<text x="0" y="0" ${textStyle}>Profile Preview Unavailable</text>`;
    }

    svg += `</svg>`;
    return svg;
}

function renderSteelProperties(designation, shape) {
    if (!currentSQLDB || !designation || !shape) return;

    const tbody = document.getElementById('steel-props-body');
    const svgBox = document.querySelector('.svgBox');

    try {
        const q = `SELECT * FROM '${shape}' WHERE Name='${designation}' LIMIT 1;`;
        const res = currentSQLDB.exec(q);

        if (res.length > 0) {
            const cols = res[0].columns;
            const vals = res[0].values[0];

            let html = '';
            let propsForSvg = {};

            for (let i = 0; i < cols.length; i++) {
                const key = cols[i];
                if (key === 'RECNO' || key === 'Name' || key === 'StaadName') continue;

                const valRaw = vals[i];
                let unitRaw = currentUnits ? (currentUnits[`Field${i}`] || '') : '';

                // Database schema safety override for common properties that databases mislabel.
                // Many databases list Dimensions as Area or vice versa in their 'Field Units' table.
                if (key === 'AX' || key === 'A' || key === 'Area') {
                    if (unitRaw && !unitRaw.includes('2')) unitRaw += '2';
                } else if (key === 'D' || key === 'B' || key === 'Bf' || key === 'T' || key === 'Tf' || key === 'Tw' || key === 'OD' || key === 'ID' || key === 't' || key === 'b') {
                    if (unitRaw && unitRaw.includes('2')) unitRaw = unitRaw.replace('2', '');
                }

                const f = autoConvert(valRaw, unitRaw, isMetric);

                // Save for SVG generator
                propsForSvg[key] = f;

                html += `<tr>
                    <td style="font-weight: 600; padding: 8px 0; border-bottom: 1px solid var(--line);">${key}</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid var(--line); text-align: right;">${f.v} <span class="muted" style="font-size:11px;">${f.u}</span></td>
                </tr>`;
            }
            tbody.innerHTML = html;

            // Generate dynamic SVG into the steel view's SVG box only
            const svgBox = document.querySelector('#steel-view .svgBox');
            if (svgBox) {
                svgBox.innerHTML = drawDynamicSVG(shape, propsForSvg);
                const newSvg = document.getElementById('steel-svg');
                if (newSvg) attachPanZoom(newSvg, 'steel');
            }

        } else {
            tbody.innerHTML = `<tr><td class="muted">Not found.</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td class="muted">Error reading properties.</td></tr>`;
        console.error(e);
    }
}

// --- Calculator Logic ---
const el = (id) => document.getElementById(id);

function nowStamp() {
    return new Date().toLocaleString();
}

function fmt(x, decimals = 1) {
    if (!isFinite(x)) return "—";
    return x.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function validate(d) {
    const errs = [];
    if ([d.D, d.tw, d.bt, d.tt, d.bb, d.tb].some(v => v <= 0)) errs.push("All main dimensions must be > 0.");
    if (d.bt < d.tw) errs.push("Top flange width bt must be ≥ web thickness tw.");
    if (d.bb < d.tw) errs.push("Bottom flange width bb must be ≥ web thickness tw.");
    if (d.ht < 0 || d.hb < 0) errs.push("Taper heights must be ≥ 0.");
    if (d.D <= d.tt + d.tb + d.ht + d.hb) errs.push("D must be > (tt + tb + ht + hb). Reduce taper heights or flange thickness.");
    if (d.gamma <= 0) errs.push("Concrete density must be > 0.");
    return errs;
}

// Build polygon points (x,y) in mm, symmetric about centerline.
// Origin: bottom at y=0, centerline at x=0.
function buildPolygon(d) {
    const y0 = 0;
    const y1 = d.tb;
    const y2 = y1 + d.hb;          // end of bottom taper, start of web
    const y3 = d.D - d.tt - d.ht;  // end of web, start of top taper
    const y4 = d.D - d.tt;         // end of top taper, start of top flange
    const y5 = d.D;

    const hbb = d.bb / 2;
    const htw = d.tw / 2;
    const hbt = d.bt / 2;

    const right = [
        { x: hbb, y: y0 },
        { x: hbb, y: y1 },
        { x: htw, y: y2 },
        { x: htw, y: y3 },
        { x: hbt, y: y4 },
        { x: hbt, y: y5 },
        { x: -hbt, y: y5 },
    ];

    const leftDown = [
        { x: -hbt, y: y4 },
        { x: -htw, y: y3 },
        { x: -htw, y: y2 },
        { x: -hbb, y: y1 },
        { x: -hbb, y: y0 }
    ];

    return [...right, ...leftDown];
}

function polyProps(poly) {
    let A2 = 0;
    let Cx6A = 0;
    let Cy6A = 0;
    let Ix12 = 0;

    const n = poly.length;
    for (let i = 0; i < n; i++) {
        const p0 = poly[i];
        const p1 = poly[(i + 1) % n];
        const cross = p0.x * p1.y - p1.x * p0.y;
        A2 += cross;
        Cx6A += (p0.x + p1.x) * cross;
        Cy6A += (p0.y + p1.y) * cross;
        Ix12 += (p0.y * p0.y + p0.y * p1.y + p1.y * p1.y) * cross;
    }

    const A = A2 / 2;
    const Cx = Cx6A / (6 * A2);
    const Cy = Cy6A / (6 * A2);
    const Ix0 = Ix12 / 12;

    const sign = (A < 0) ? -1 : 1;
    return {
        A: Math.abs(A),
        Cx: Cx * sign,
        Cy: Cy * sign,
        Ix0: Ix0 * sign
    };
}

function compute() {
    if (!el("D")) return null; // Avoid errors if elements are missing
    const d = {
        D: +el("D").value,
        tw: +el("tw").value,
        bt: +el("bt").value,
        tt: +el("tt").value,
        bb: +el("bb").value,
        tb: +el("tb").value,
        ht: +el("ht").value,
        hb: +el("hb").value,
        gamma: +el("gamma").value
    };

    const errs = validate(d);
    const msg = el("msg");
    if (msg) msg.innerHTML = "";

    if (errs.length) {
        if (msg) msg.innerHTML = `<div class="warn">⚠ ${errs.join(" ")}</div>`;
        return null;
    }
    if (msg) msg.innerHTML = `<div class="ok">✓ Inputs look OK</div>`;

    const poly = buildPolygon(d);
    const props = polyProps(poly);

    const Ixx = props.Ix0 - props.A * props.Cy * props.Cy;
    const ybar = props.Cy;
    const Ztop = Ixx / (d.D - ybar);
    const Zbot = Ixx / (ybar);

    const Vpm = props.A / 1e6;
    const Wpm = d.gamma * Vpm;

    return { d, poly, A: props.A, ybar, Ixx, Ztop, Zbot, Vpm, Wpm };
}

// --- SVG helpers for dimensions ---
function svgLine(x1, y1, x2, y2, stroke = "rgba(255,255,255,.7)", w = 2, dash = "") {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
      stroke="${stroke}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ``} />`;
}

function svgText(x, y, txt, anchor = "middle", transform = "") {
    return `<text x="${x}" y="${y}" fill="rgba(255,255,255,.85)"
      font-size="14" text-anchor="${anchor}" font-family="system-ui, Arial"${transform ? ` transform="${transform}"` : ""}>${txt}</text>`;
}

function dimH(x1, x2, y, ext = 18, label = "") {
    return `
    ${svgLine(x1, y, x1, y - ext)}
    ${svgLine(x2, y, x2, y - ext)}
    <line x1="${x1}" y1="${y - ext}" x2="${x2}" y2="${y - ext}" stroke="rgba(255,255,255,.7)" stroke-width="2" marker-start="url(#arrStart)" marker-end="url(#arrEnd)" />
    ${svgText((x1 + x2) / 2, y - ext - 12, label)}
  `;
}

function dimV(x, y1, y2, ext = 18, label = "", yOffset = 0) {
    const isLeft = ext < 0;
    const lineX = x + ext;
    const txtX = lineX + (isLeft ? -5 : 5);
    const txtY = (y1 + y2) / 2 + yOffset;

    // Left-side dimensions (rotated) should be anchored "middle".
    // Right-side dimensions (horizontal) should be anchored "start".
    const anchor = isLeft ? "middle" : "start";

    // Reintroduce rotation ONLY for left-side labels (ȳ, D) to keep them vertical.
    // Right-side labels (tb, ht, etc) stay horizontal.
    const transform = isLeft ? `rotate(-90 ${txtX} ${txtY})` : "";
    const finalTxtY = txtY + (isLeft ? 0 : 5); // Add slight padding if horizontal

    return `
    ${svgLine(x, y1, lineX, y1)}
    ${svgLine(x, y2, lineX, y2)}
    <line x1="${lineX}" y1="${y1}" x2="${lineX}" y2="${y2}" stroke="rgba(255,255,255,.7)" stroke-width="2" marker-start="url(#arrStart)" marker-end="url(#arrEnd)" />
    ${svgText(txtX, finalTxtY, label, anchor, transform)}
  `;
}

function draw(res) {
    if (!res) return;
    const { d, poly, ybar } = res;

    const gShape = el("shape");
    const gAxis = el("axis");
    const gDims = el("dims");
    if (!gShape || !gAxis || !gDims) return;

    gShape.innerHTML = "";
    gAxis.innerHTML = "";
    gDims.innerHTML = "";

    const W = 900, H = 520, pad = 120;
    const maxX = Math.max(...poly.map(p => Math.abs(p.x)));
    const maxY = d.D;

    const sx = (W - 2 * pad) / (2 * maxX);
    const sy = (H - 2 * pad) / (maxY);
    const s = Math.min(sx, sy);

    const secW = 2 * maxX * s;
    const secH = maxY * s;
    const x0 = (W - secW) / 2;
    const y0 = (H - secH) / 2;

    const X = (x) => x0 + (x + maxX) * s;
    const Y = (y) => y0 + (maxY - y) * s;

    const pts = poly.map(p => `${X(p.x)},${Y(p.y)}`).join(" ");

    gShape.insertAdjacentHTML("beforeend", `
      <polygon points="${pts}" fill="var(--shapeFill)" stroke="var(--shapeStroke)" stroke-width="2"/>
    `);

    gAxis.insertAdjacentHTML("beforeend", `
      <line x1="${X(-maxX)}" y1="${Y(ybar)}" x2="${X(maxX)}" y2="${Y(ybar)}"
            stroke="var(--axis)" stroke-width="3" stroke-dasharray="10,8"/>
      <circle cx="${X(0)}" cy="${Y(ybar)}" r="5" fill="var(--axis)"/>
    `);

    const y00 = 0;
    const y1 = d.tb;
    const y2 = y1 + d.hb;
    const y3 = d.D - d.tt - d.ht;
    const y4 = d.D - d.tt;
    const y5 = d.D;

    const hbb = d.bb / 2;
    const htw = d.tw / 2;
    const hbt = d.bt / 2;

    const xLeftTop = X(-hbt), xRightTop = X(hbt);
    const xLeftWeb = X(-htw), xRightWeb = X(htw);
    const xLeftBot = X(-hbb), xRightBot = X(hbb);

    // Push bt higher (more negative in Y relative to top of shape)
    gDims.insertAdjacentHTML("beforeend", dimH(xLeftTop, xRightTop, Y(y5) - 30, 18, `bt = ${d.bt} mm`));
    gDims.insertAdjacentHTML("beforeend", dimH(xLeftWeb, xRightWeb, Y((y2 + y3) / 2) + 40, 18, `tw = ${d.tw} mm`));
    // Push bb lower (more positive in Y relative to bottom of shape)
    gDims.insertAdjacentHTML("beforeend", dimH(xLeftBot, xRightBot, Y(y00) + 50, 18, `bb = ${d.bb} mm`));

    gDims.insertAdjacentHTML("beforeend", dimV(X(-hbb) - 25, Y(y00), Y(ybar), -16, `ȳ = ${fmt(ybar, 1)} mm`));
    gDims.insertAdjacentHTML("beforeend", dimV(X(-hbb) - 75, Y(y00), Y(y5), -16, `D = ${d.D} mm`));

    // Give right-side heights extra padding based on the widest footprint so the text sits wholly outside the polygon.
    const rtPadX = X(Math.max(hbt, hbb)) + 40;
    gDims.insertAdjacentHTML("beforeend", dimV(X(hbb), Y(y00), Y(y1), rtPadX - X(hbb), `tb = ${d.tb}`, 0));
    gDims.insertAdjacentHTML("beforeend", dimV(X(hbt), Y(y1), Y(y2), rtPadX - X(hbt) + 50, `hb = ${d.hb}`, 0));
    gDims.insertAdjacentHTML("beforeend", dimV(X(hbt), Y(y3), Y(y4), rtPadX - X(hbt) + 50, `ht = ${d.ht}`, 0));
    gDims.insertAdjacentHTML("beforeend", dimV(X(hbb), Y(y4), Y(y5), rtPadX - X(hbb), `tt = ${d.tt}`, 0));

    gDims.insertAdjacentHTML("beforeend", `
      <text x="18" y="30" fill="rgba(255,255,255,.85)" font-size="14">D=${d.D} mm</text>
      <text x="18" y="52" fill="rgba(255,255,255,.75)" font-size="13">
        bt=${d.bt}, tt=${d.tt}, tw=${d.tw}, bb=${d.bb}, tb=${d.tb}, ht=${d.ht}, hb=${d.hb} (mm)
      </text>
    `);
}

function updateUI() {
    const res = compute();
    if (!res) return;

    if (el("A")) el("A").textContent = `${fmt(res.A, 0)} mm²`;
    if (el("ybar")) el("ybar").textContent = `${fmt(res.ybar, 1)} mm`;
    if (el("Ixx")) el("Ixx").textContent = `${res.Ixx.toExponential(3)} mm⁴`;
    if (el("Ztop")) el("Ztop").textContent = `${res.Ztop.toExponential(3)} mm³`;
    if (el("Zbot")) el("Zbot").textContent = `${res.Zbot.toExponential(3)} mm³`;
    if (el("Vpm")) el("Vpm").textContent = `${fmt(res.Vpm, 6)} m³/m`;
    if (el("Wpm")) el("Wpm").textContent = `${fmt(res.Wpm, 3)} kN/m`;

    if (el("stamp")) el("stamp").textContent = `Generated: ${nowStamp()}`;
    draw(res);
}

async function downloadPDF() {
    const res = compute();
    if (!res) return;

    // Wait until external library is loaded if needed
    if (!window.jspdf || !window.html2canvas) {
        alert("PDF libraries are not loaded yet. Please wait a moment and try again.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

    const margin = 12;
    let y = margin;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(el("rtitle").value || "Section Property Report", margin, y);
    y += 7;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`Generated: ${nowStamp()}`, margin, y);
    y += 8;

    pdf.setFont("helvetica", "bold"); pdf.text("Inputs (mm)", margin, y); y += 6;
    pdf.setFont("helvetica", "normal");

    const d = res.d;
    const inputLines = [
        `D=${d.D}, tw=${d.tw}`,
        `bt=${d.bt}, tt=${d.tt}`,
        `bb=${d.bb}, tb=${d.tb}`,
        `Top taper ht=${d.ht}, Bottom taper hb=${d.hb}`,
        `Concrete density = ${d.gamma} kN/m³`
    ];
    inputLines.forEach(line => { pdf.text(line, margin, y); y += 5; });
    y += 4;

    pdf.setFont("helvetica", "bold"); pdf.text("Results", margin, y); y += 6;
    pdf.setFont("helvetica", "normal");
    const resLines = [
        `Area A = ${Math.round(res.A)} mm²`,
        `Centroid ȳ (from bottom) = ${res.ybar.toFixed(1)} mm`,
        `Ixx (about centroid) = ${res.Ixx.toExponential(3)} mm⁴`,
        `Ztop = ${res.Ztop.toExponential(3)} mm³`,
        `Zbot = ${res.Zbot.toExponential(3)} mm³`,
        `Concrete volume per meter = ${(res.Vpm).toFixed(6)} m³/m`,
        `Self weight per meter = ${(res.Wpm).toFixed(3)} kN/m`
    ];
    resLines.forEach(line => { pdf.text(line, margin, y); y += 5; });

    y += 4;

    const report = el("reportArea");
    const canvas = await html2canvas(report, { scale: 2, backgroundColor: "#0b1220" });
    const imgData = canvas.toDataURL("image/png");

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const maxW = pageW - 2 * margin;
    const imgW = maxW;
    const imgH = (canvas.height / canvas.width) * imgW;

    if (y + imgH > pageH - margin) {
        pdf.addPage();
        y = margin;
    }
    pdf.addImage(imgData, "PNG", margin, y, imgW, imgH);

    pdf.save("psc_section_report.pdf");
}

function downloadDXF() {
    const res = compute();
    if (!res) return;

    const pts = res.poly;

    const NL = "\r\n";
    let dxf = "";
    const add = s => dxf += s + NL;

    add("0"); add("SECTION");
    add("2"); add("HEADER");
    add("9"); add("$INSUNITS");
    add("70"); add("4");
    add("0"); add("ENDSEC");

    add("0"); add("SECTION");
    add("2"); add("TABLES");

    add("0"); add("TABLE");
    add("2"); add("LAYER");
    add("70"); add("1");

    add("0"); add("LAYER");
    add("2"); add("0");
    add("70"); add("0");
    add("62"); add("7");
    add("6"); add("CONTINUOUS");

    add("0"); add("ENDTAB");
    add("0"); add("ENDSEC");

    add("0"); add("SECTION");
    add("2"); add("ENTITIES");

    add("0"); add("POLYLINE");
    add("8"); add("0");
    add("66"); add("1");
    add("70"); add("1");

    pts.forEach(p => {
        add("0"); add("VERTEX");
        add("8"); add("0");
        add("10"); add(p.x.toFixed(3));
        add("20"); add(p.y.toFixed(3));
        add("30"); add("0");
    });

    add("0"); add("SEQEND");
    add("0"); add("ENDSEC");
    add("0"); add("EOF");

    const blob = new Blob([dxf], { type: "application/dxf" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "psc_section.dxf";
    a.click();
}
