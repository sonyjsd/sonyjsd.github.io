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
    // Scroll to top when switching views
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

function svgText(x, y, txt, anchor = "middle") {
    return `<text x="${x}" y="${y}" fill="rgba(255,255,255,.85)"
      font-size="14" text-anchor="${anchor}" font-family="system-ui, Arial">${txt}</text>`;
}

function dimH(x1, x2, y, ext = 18, label = "") {
    const tick = 8;
    return `
    ${svgLine(x1, y, x1, y - ext)}
    ${svgLine(x2, y, x2, y - ext)}
    ${svgLine(x1 - tick, y - ext + tick, x1 + tick, y - ext - tick)}
    ${svgLine(x2 - tick, y - ext + tick, x2 + tick, y - ext - tick)}
    ${svgLine(x1, y - ext, x2, y - ext)}
    ${svgText((x1 + x2) / 2, y - ext - 6, label)}
  `;
}

function dimV(x, y1, y2, ext = 18, label = "") {
    const tick = 8;
    return `
    ${svgLine(x, y1, x + ext, y1)}
    ${svgLine(x, y2, x + ext, y2)}
    ${svgLine(x + ext - tick, y1 - tick, x + ext + tick, y1 + tick)}
    ${svgLine(x + ext - tick, y2 - tick, x + ext + tick, y2 + tick)}
    ${svgLine(x + ext, y1, x + ext, y2)}
    ${svgText(x + ext + 6, (y1 + y2) / 2 + 5, label, "start")}
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

    const W = 900, H = 520, pad = 70;
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

    gDims.insertAdjacentHTML("beforeend", dimH(xLeftTop, xRightTop, Y(y5) + 40, 18, `bt = ${d.bt} mm`));
    gDims.insertAdjacentHTML("beforeend", dimH(xLeftWeb, xRightWeb, Y((y2 + y3) / 2) + 40, 18, `tw = ${d.tw} mm`));
    gDims.insertAdjacentHTML("beforeend", dimH(xLeftBot, xRightBot, Y(y00) + 40, 18, `bb = ${d.bb} mm`));

    gDims.insertAdjacentHTML("beforeend", dimV(X(-hbb) - 60, Y(y00), Y(y5), -18, `D = ${d.D} mm`));

    gDims.insertAdjacentHTML("beforeend", dimV(X(hbb) + 30, Y(y00), Y(y1), 18, `tb = ${d.tb}`));
    gDims.insertAdjacentHTML("beforeend", dimV(X(hbb) + 30, Y(y1), Y(y2), 18, `hb = ${d.hb}`));
    gDims.insertAdjacentHTML("beforeend", dimV(X(hbb) + 30, Y(y3), Y(y4), 18, `ht = ${d.ht}`));
    gDims.insertAdjacentHTML("beforeend", dimV(X(hbb) + 30, Y(y4), Y(y5), 18, `tt = ${d.tt}`));

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
