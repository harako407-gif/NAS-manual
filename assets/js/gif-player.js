    (function installGifPlayers(createReader) {
	const Reader = createReader();
	const players = new Map();
	function attach(img) {
		const source = img.getAttribute("src") || "";
		if (!/^data:image\/gif[;,]/i.test(source) && !/\.gif(?:$|[?#])/i.test(source)) return;
		const host = img.closest(".media-visual, figure, .lightbox");
		if (!host) return;
		let disposed = false, reader, pixels, restore, previous = -1, playing = false, time = 0, last = 0, raf = 0, busy = false;
		const abort = new AbortController();
		const panel = document.createElement("div");
		const hint = document.createElement("div");
		hint.className = "gif-hint";
		hint.innerHTML = '<span class="gif-label">영상</span><span class="gif-hint-text">불러오는 중…</span>';
		const hintText = hint.querySelector(".gif-hint-text");
		host.prepend(hint);
		panel.className = "gif-controls";
		panel.innerHTML = "<button type=\"button\" class=\"gif-toggle\" aria-label=\"재생\" title=\"재생\" disabled><span aria-hidden=\"true\" class=\"play-icon\"></span></button><input type=\"range\" min=\"0\" max=\"1\" step=\"0.01\" value=\"0\" aria-label=\"영상 재생 위치\" disabled><output>불러오는 중…</output><div class=\"gif-speed\" role=\"group\" aria-label=\"영상 재생 속도\"><button type=\"button\" data-speed=\"0.5\" aria-pressed=\"false\">천천히</button><button type=\"button\" data-speed=\"1\" aria-pressed=\"true\">빠르게</button></div>";
		host.classList.add("gif-player-host");
		const surface = img.closest(".zoom-button");
		const overlay = document.createElement("span");
		overlay.className = "gif-center-play";
		overlay.setAttribute("aria-hidden", "true");
		overlay.innerHTML = '<span class="play-icon"></span>';
		if (surface) {
			surface.append(overlay);
			surface.setAttribute("aria-label", "영상 불러오는 중");
			surface.setAttribute("aria-disabled", "true");
		}
		const initialVisibility = img.style.visibility;
		img.style.visibility = "hidden";
		host.append(panel);
		panel.addEventListener("click", (e) => e.stopPropagation());
		panel.addEventListener("pointerdown", (e) => e.stopPropagation());
		const button = panel.querySelector("button"), slider = panel.querySelector("input"), output = panel.querySelector("output");
		        let playbackRate = 1;
        const speedButtons = panel.querySelectorAll('[data-speed]');
        speedButtons.forEach(speedButton => {
            speedButton.addEventListener('click', () => {
                playbackRate = Number(speedButton.dataset.speed);
                speedButtons.forEach(option => option.setAttribute('aria-pressed', String(option === speedButton)));
            });
        });
		const canvas = document.createElement("canvas"), context = canvas.getContext("2d");
		const state = {
			source,
			rendered: source,
			cleanup() {
				disposed = true;
				abort.abort();
				cancelAnimationFrame(raf);
                cancelAnimationFrame(seekRaf);
                clearTimeout(decodeTimer);
                checkpoints.clear();
				panel.remove();
				hint.remove();
				overlay.remove();
				img.style.visibility = initialVisibility;
				host.classList.remove("gif-player-host");
				if (img.getAttribute("src") === state.rendered) img.setAttribute("src", source);
				delete img.dataset.gifSource;
			}
		};
		players.set(img, state);
		img.dataset.gifSource = source;
		let starts = [], duration = 0;
        let wanted = -1, decodeTimer = 0, seekRaf = 0;
        const checkpoints = new Map();
        let cacheBytes = 0;
        const cacheLimit = 16 * 1024 * 1024;
        function saveCheckpoint(index) {
            if (index % 10 || checkpoints.has(index)) return;
            const bytes = pixels.byteLength + (restore ? restore.byteLength : 0);
            if (bytes > cacheLimit) return;
            while (cacheBytes + bytes > cacheLimit && checkpoints.size) {
                const key = checkpoints.keys().next().value;
                cacheBytes -= checkpoints.get(key).bytes;
                checkpoints.delete(key);
            }
            checkpoints.set(index, {pixels:pixels.slice(), restore:restore ? restore.slice() : null, bytes});
            cacheBytes += bytes;
        }
        function decodeLatest() {
            decodeTimer = 0;
            if (disposed || wanted < 0) return;
            if (wanted < previous) {
                let nearest = -1;
                for (const key of checkpoints.keys()) if (key <= wanted && key > nearest) nearest = key;
                if (nearest >= 0) {
                    const saved = checkpoints.get(nearest);
                    pixels.set(saved.pixels);
                    restore = saved.restore ? saved.restore.slice() : null;
                    previous = nearest;
                } else { pixels.fill(0); previous = -1; restore = null; }
            }
            const deadline = performance.now() + 6;
            while (previous < wanted) {
                const i = previous + 1;
                if (i > 0) {
                    const prior = reader.frameInfo(i - 1);
                    if (prior.disposal === 2) for (let y = prior.y; y < prior.y + prior.height; y++) pixels.fill(0, (y * reader.width + prior.x) * 4, (y * reader.width + prior.x + prior.width) * 4);
                    if (prior.disposal === 3 && restore) pixels.set(restore);
                }
                restore = reader.frameInfo(i).disposal === 3 ? pixels.slice() : null;
                reader.decodeAndBlitFrameRGBA(i, pixels);
                previous = i;
                saveCheckpoint(i);
                if (performance.now() >= deadline && previous < wanted) {
                    decodeTimer = setTimeout(decodeLatest, 0);
                    return;
                }
            }
            context.putImageData(new ImageData(pixels, reader.width, reader.height), 0, 0);
            state.rendered = canvas.toDataURL("image/png");
            img.setAttribute("src", state.rendered);
        }
        function draw(index) {
            if (index === wanted) return;
            wanted = index;
            if (!decodeTimer) decodeTimer = setTimeout(decodeLatest, 0);
        }
		function formatTime(seconds) {
			return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
		}
		function render() {
			let index = starts.length - 1;
			while (index > 0 && starts[index] > time) index--;
			draw(index);
			slider.value = String(time);
			slider.style.setProperty("--gif-progress", time / duration * 100 + "%");
			output.textContent = `${formatTime(time)} / ${formatTime(duration)}`;
		}
		function tick(now) {
			if (disposed) return;
			if (playing && !busy && !seekRaf && !decodeTimer && img.getClientRects().length && !document.hidden) {
				time = (time + Math.min((now - last) / 1e3, .1) * playbackRate) % duration;
				render();
			}
			last = now;
			raf = requestAnimationFrame(tick);
		}
		function setPlaying(value) {
			playing = value;
			overlay.hidden = playing;
			if (surface) {
				surface.setAttribute("aria-label", playing ? "영상 일시정지" : "영상 재생");
				surface.removeAttribute("aria-disabled");
			}
			hint.dataset.playing = String(playing);
			hintText.textContent = playing ? "재생 중 · 누르면 일시정지" : "눌러서 재생";
			button.setAttribute("aria-label", playing ? "일시정지" : "재생");
			button.title = playing ? "일시정지" : "재생";
			button.dataset.playing = String(playing);
		}
		button.onclick = () => setPlaying(!playing);
		// Capture before the image's existing zoom handler (including React delegation).
		host.addEventListener("click", (event) => {
			if (panel.contains(event.target)) return;
			if (event.target.closest?.(".photo-resize-handle, .is-adjusting")) return;
			if (host.classList.contains("lightbox") && event.target !== img) return;
			event.preventDefault();
			event.stopPropagation();
			if (!button.disabled) setPlaying(!playing);
		}, {
			capture: true,
			signal: abort.signal
		});
		slider.onpointerdown = () => {
			busy = true;
		};
		const release = () => {
			busy = false;
		};
		window.addEventListener("pointerup", release, { signal: abort.signal });
		window.addEventListener("pointercancel", release, { signal: abort.signal });
		slider.oninput = () => {
            time = Number(slider.value);
            if (!seekRaf) seekRaf = requestAnimationFrame(() => {
                seekRaf = 0;
                if (!disposed) render();
            });
		};
		fetch(source, { signal: abort.signal }).then((r) => {
			if (!r.ok) throw new Error("load");
			return r.arrayBuffer();
		}).then((data) => {
			if (disposed) return;
			reader = new Reader(new Uint8Array(data));
			if (reader.width * reader.height > 16777216) throw new Error("size");
			canvas.width = reader.width;
			canvas.height = reader.height;
			pixels = new Uint8ClampedArray(reader.width * reader.height * 4);
			for (let i = 0; i < reader.numFrames(); i++) {
				starts.push(duration);
				duration += Math.max(reader.frameInfo(i).delay / 100, .02);
			}
			if (!duration) throw new Error("empty");
			slider.max = String(duration);
			slider.disabled = false;
			button.disabled = false;
			setPlaying(false);
            render();
            clearTimeout(decodeTimer);
            decodeLatest();
			img.style.visibility = initialVisibility;
			raf = requestAnimationFrame(tick);
		}).catch(() => {
			if (!disposed) {
				overlay.hidden = true;
				if (surface) surface.setAttribute("aria-label", "영상을 불러오지 못했습니다");
				hintText.textContent = "파일을 불러오지 못했습니다";
				img.style.visibility = initialVisibility;
				output.textContent = "재생 파일을 불러오지 못했습니다.";
			}
		});
	}
	function scan() {
		for (const [img, state] of players) if (!img.isConnected || img.getAttribute("src") !== state.rendered && img.getAttribute("src") !== state.source) {
			state.cleanup();
			players.delete(img);
		}
		document.querySelectorAll(".media-visual img, figure img, .lightbox img").forEach((img) => {
			if (!players.has(img)) attach(img);
		});
	}
	const observer = new MutationObserver(scan);
	observer.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ["src"]
	});
	scan();
	return () => {
		observer.disconnect();
		for (const state of players.values()) state.cleanup();
		players.clear();
	};
})(createGifReader);
