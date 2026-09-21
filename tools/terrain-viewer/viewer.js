const canvas = document.querySelector("#map"),
	ctx = canvas.getContext("2d"),
	status = document.querySelector("#status");
const overview = new Image(),
	detail = document.querySelector("#detail");
let world,
	zoom = 1,
	cx = 0.5,
	cy = 0.5,
	drag,
	detailImage = null,
	timer,
	revision = 0,
	inFlight = false,
	requestAgain = false;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function dimensions() {
	const w = canvas.clientWidth,
		h = canvas.clientHeight;
	return { w, h, scale: Math.min(w / 2, h) * zoom };
}
function coords() {
	const g = world.bounds;
	return {
		latitude: g.latN - cy * (g.latN - g.latS),
		longitude: g.lonW + cx * (g.lonE - g.lonW),
	};
}
function draw() {
	if (!world) return;
	const { w, h, scale } = dimensions();
	canvas.width = w * devicePixelRatio;
	canvas.height = h * devicePixelRatio;
	ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
	ctx.fillStyle = "#102330";
	ctx.fillRect(0, 0, w, h);
	ctx.imageSmoothingEnabled = zoom < 8;
	if (detailImage) {
		const size = Math.min(w, h);
		ctx.drawImage(detailImage, (w - size) / 2, (h - size) / 2, size, size);
	} else if (overview.complete && overview.naturalWidth)
		ctx.drawImage(
			overview,
			w / 2 - cx * scale * 2,
			h / 2 - cy * scale,
			scale * 2,
			scale,
		);
	ctx.strokeStyle = "#d6f4c3";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(w / 2 - 12, h / 2);
	ctx.lineTo(w / 2 + 12, h / 2);
	ctx.moveTo(w / 2, h / 2 - 12);
	ctx.lineTo(w / 2, h / 2 + 12);
	ctx.stroke();
	const p = coords();
	document.querySelector("#location").textContent =
		`${p.latitude.toFixed(3)}°, ${p.longitude.toFixed(3)}° · ${zoom.toFixed(0)}×`;
}
function moved() {
	revision++;
	detailImage = null;
	detail.hidden = true;
	document.querySelector("#caption").textContent = "";
	clearTimeout(timer);
	draw();
	if (zoom >= 256 && document.querySelector("#auto").checked) {
		status.textContent = "Waiting for navigation to settle…";
		timer = setTimeout(() => refine(revision), 850);
	} else status.textContent = "Zoom closer to refine this location.";
}
async function refine(token) {
	if (
		generationId ||
		token !== revision ||
		zoom < 256 ||
		!document.querySelector("#auto").checked
	)
		return;
	if (inFlight) {
		requestAgain = true;
		return;
	}
	inFlight = true;
	try {
		const response = await fetch("/detail", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...coords(), world: world.hash }),
		});
		const result = await response.json();
		if (token !== revision) return;
		if (!response.ok && response.status !== 202)
			throw Error(result.error || "Cannot refine this region");
		if (result.state === "ready") {
			const image = new Image();
			image.onload = () => {
				if (token !== revision) return;
				detail.src = image.src;
				detail.hidden = false;
				detailImage = image;
				draw();
			};
			image.src = `/detail/${result.key}.png`;
			status.textContent = "Terrain ready · saved in local cache";
			document.querySelector("#caption").textContent =
				`${result.latitude.toFixed(1)}°, ${result.longitude.toFixed(1)}° · ${result.report.inferenceSeconds.toFixed(0)} s generation`;
		} else if (result.state === "failed") throw Error(result.error);
		else {
			status.textContent =
				result.state === "busy"
					? "GPU is finishing another region. Your latest location will run next."
					: "Refining this region on Apple GPU…";
			timer = setTimeout(() => refine(token), 2500);
		}
	} catch (error) {
		if (token === revision) status.textContent = error.message;
	} finally {
		inFlight = false;
		if (requestAgain) {
			requestAgain = false;
			clearTimeout(timer);
			timer = setTimeout(() => refine(revision), 850);
		}
	}
}
function changeZoom(
	factor,
	x = canvas.clientWidth / 2,
	y = canvas.clientHeight / 2,
) {
	const { w, h, scale } = dimensions();
	const px = cx + (x - w / 2) / (scale * 2),
		py = cy + (y - h / 2) / scale;
	zoom = clamp(zoom * factor, 1, 2048);
	const next = dimensions().scale;
	cx = clamp(px - (x - w / 2) / (next * 2), 0, 1);
	cy = clamp(py - (y - h / 2) / next, 0, 1);
	moved();
}
canvas.onwheel = (e) => {
	e.preventDefault();
	if (!world) return;
	const r = canvas.getBoundingClientRect();
	changeZoom(
		Math.exp(-e.deltaY * 0.003),
		e.clientX - r.left,
		e.clientY - r.top,
	);
};
canvas.onpointerdown = (e) => {
	if (!world) return;
	drag = { x: e.clientX, y: e.clientY, cx, cy, moved: false };
	canvas.setPointerCapture(e.pointerId);
	clearTimeout(timer);
	revision++;
	detailImage = null;
	detail.hidden = true;
};
canvas.onpointermove = (e) => {
	if (!drag) return;
	const { scale } = dimensions();
	if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 3) drag.moved = true;
	cx = clamp(drag.cx - (e.clientX - drag.x) / (scale * 2), 0, 1);
	cy = clamp(drag.cy - (e.clientY - drag.y) / scale, 0, 1);
	draw();
};
canvas.onpointerup = (e) => {
	if (!drag) return;
	if (!drag.moved) {
		const r = canvas.getBoundingClientRect(),
			{ w, h, scale } = dimensions();
		cx = clamp(cx + (e.clientX - r.left - w / 2) / (scale * 2), 0, 1);
		cy = clamp(cy + (e.clientY - r.top - h / 2) / scale, 0, 1);
	}
	drag = null;
	moved();
};
canvas.onpointercancel = () => {
	drag = null;
	moved();
};
document.querySelector("#plus").onclick = () => world && changeZoom(2);
document.querySelector("#minus").onclick = () => world && changeZoom(0.5);
document.querySelector("#home").onclick = () => {
	cx = cy = 0.5;
	zoom = 1;
	moved();
};
document.querySelector("#focus").onclick = () => {
	if (!world) return;
	zoom = 512;
	moved();
};
document.querySelector("#auto").onchange = moved;
canvas.onkeydown = (e) => {
	if (!world) return;
	if (e.key === "+" || e.key === "=") changeZoom(2);
	else if (e.key === "-") changeZoom(0.5);
	else if (
		["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
	) {
		e.preventDefault();
		cx = clamp(
			cx + (({ ArrowLeft: -1, ArrowRight: 1 }[e.key] || 0) * 0.1) / zoom,
			0,
			1,
		);
		cy = clamp(
			cy + (({ ArrowUp: -1, ArrowDown: 1 }[e.key] || 0) * 0.1) / zoom,
			0,
			1,
		);
		moved();
	}
};
new ResizeObserver(draw).observe(canvas);
async function loadWorld() {
	try {
		const r = await fetch("/world");
		const data = await r.json();
		if (!r.ok) throw Error(data.error);
		world = data;
		document.querySelector("#world").textContent = world.name;
		overview.onload = () => {
			draw();
			status.textContent = "Select a location and zoom in to generate detail.";
		};
		overview.src = `/overview.png?v=${world.hash}`;
	} catch (e) {
		status.textContent = e.message;
		document.querySelector("#world").textContent = "Create your first world";
	}
}
loadWorld();

const generator = document.querySelector("#generator");
const generate = document.querySelector("#generate");
const generationStatus = document.querySelector("#generationStatus");
const engineOrigin = "http://127.0.0.1:5174";
let engineReady = false,
	generationId = null,
	generationTimer;
window.addEventListener("message", async (event) => {
	if (event.origin !== engineOrigin || event.source !== generator.contentWindow)
		return;
	if (event.data?.type === "spacology:ready") {
		engineReady = true;
		if (!generationId) {
			generate.disabled = false;
			generationStatus.textContent =
				"Ready. Generate here, then zoom into the result.";
		}
		return;
	}
	if (
		event.data?.type !== "spacology:world" ||
		event.data.id !== generationId ||
		typeof event.data.json !== "string"
	)
		return;
	clearTimeout(generationTimer);
	try {
		generationStatus.textContent = "Preparing world for exploration…";
		const response = await fetch("/import", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: event.data.json,
		});
		if (!response.ok) throw Error(await response.text());
		revision++;
		clearTimeout(timer);
		detailImage = null;
		detail.hidden = true;
		cx = cy = 0.5;
		zoom = 1;
		await loadWorld();
		generationStatus.textContent =
			"World ready. Zoom in to generate terrain detail automatically.";
	} catch (error) {
		generationStatus.textContent = error.message;
	} finally {
		generationId = null;
		generate.disabled = false;
	}
});
generate.onclick = async () => {
	if (!engineReady || generationId) return;
	generate.disabled = true;
	revision++;
	clearTimeout(timer);
	requestAgain = false;
	try {
		generationId = "waiting";
		const started = Date.now();
		while (true) {
			const response = await fetch("/status");
			if (!response.ok) throw Error("Local terrain service is unavailable.");
			const state = await response.json();
			if (!state.running) break;
			if (Date.now() - started > 180000)
				throw Error(
					"The current terrain job is still running. Try again when it finishes.",
				);
			generationStatus.textContent =
				"Finishing the current terrain region, then generating your new world…";
			await new Promise((resolve) => setTimeout(resolve, 2500));
		}
		generationId = crypto.randomUUID();
		generationStatus.textContent = "Generating land, climate and world data…";
		generator.contentWindow.postMessage(
			{
				type: "spacology:generate",
				id: generationId,
				preset: document.querySelector("#preset").value,
				seed: document.querySelector("#seed").value,
			},
			engineOrigin,
		);
		generationTimer = setTimeout(() => {
			generationId = null;
			generate.disabled = false;
			generationStatus.textContent =
				"Generation timed out. Check the local FMG server and try again.";
		}, 90000);
	} catch (error) {
		generationId = null;
		generationStatus.textContent = error.message;
		generate.disabled = false;
	}
};
generator.src = engineOrigin + "/Fantasy-Map-Generator/?terrainLab=1";
setTimeout(() => {
	if (!engineReady)
		generationStatus.textContent =
			"FMG is not ready. Its local server must be running on port 5174.";
}, 15000);
