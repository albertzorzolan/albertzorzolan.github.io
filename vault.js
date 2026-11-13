// Vault doors: spin the wheel, swing the door, zoom through the doorway into the room.
// All content is in the HTML; without this script the rooms simply show as normal sections.
(() => {
  const ROOMS = ["projects", "experience", "about"];
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const outside = () => [".skip", ".intro", ".vaults", ".hint", "footer"].map((s) => document.querySelector(s)).filter(Boolean);

  let current = null;      // the open room element
  let openedInstantly = false;
  let pushed = false;      // did we add a history entry for the open room?
  let busy = false;
  let skipping = false;
  let running = [];

  const roomFor = (id) => (ROOMS.includes(id) ? document.getElementById(id) : null);
  const doorFor = (id) => document.querySelector(`.vault[href="#${id}"]`);

  function play(el, keyframes, opts) {
    const a = el.animate(keyframes, { fill: "forwards", ...opts, duration: skipping ? 0 : opts.duration });
    running.push(a);
    return a.finished.catch(() => {});
  }

  function skip() {
    skipping = true;
    running.forEach((a) => a.finish());
  }

  function clear(els) {
    running = running.filter((a) => {
      if (els.includes(a.effect && a.effect.target)) { a.cancel(); return false; }
      return a.playState === "running";
    });
  }

  function geometry(door) {
    const r = door.querySelector(".vault-frame").getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    return { x, y, near: r.width * 0.42, far };
  }

  function setOutsideInert(on) {
    outside().forEach((el) => { el.inert = on; });
    document.body.classList.toggle("room-open", on);
  }

  async function open(id, { instant = false, push = true } = {}) {
    const room = roomFor(id);
    if (!room || busy || current === room) return;
    busy = true;
    const door = doorFor(id);
    const frame = door.querySelector(".vault-frame");
    const leaf = door.querySelector(".vault-door");
    const wheel = door.querySelector(".vault-wheel");
    const inner = room.querySelector(".room-inner");
    const motion = !instant && !reduce.matches;

    if (push) { history.pushState({ vault: id }, "", "#" + id); pushed = true; }

    if (motion) {
      await play(wheel, [{ transform: "rotate(0deg)" }, { transform: "rotate(540deg)" }],
        { duration: 750, easing: "cubic-bezier(.55,0,.2,1)" });
      await play(leaf, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(-112deg)" }],
        { duration: 560, easing: "cubic-bezier(.3,.6,.2,1)" });
    }

    const g = geometry(door);
    room.classList.add("is-open");
    room.scrollTop = 0;
    setOutsideInert(true);

    if (motion) {
      play(frame, [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.5)", opacity: 0 }],
        { duration: 520, easing: "cubic-bezier(.5,0,.75,0)" });
      play(inner, [{ opacity: 0, transform: "translateY(14px) scale(.98)" }, { opacity: 1, transform: "none" }],
        { duration: 480, delay: skipping ? 0 : 260, easing: "cubic-bezier(.2,.7,.2,1)" });
      await play(room, [
        { clipPath: `circle(${g.near}px at ${g.x}px ${g.y}px)` },
        { clipPath: `circle(${g.far}px at ${g.x}px ${g.y}px)` },
      ], { duration: 680, easing: "cubic-bezier(.65,0,.35,1)" });
    } else if (!instant) {
      await play(room, [{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
    }

    clear([room, inner]);
    current = room;
    openedInstantly = !motion;
    busy = false;
    skipping = false;
    // after the browser's own fragment handling, so focus lands on the heading
    setTimeout(() => room.querySelector("h2").focus({ preventScroll: true }), 0);
  }

  async function close() {
    if (!current || busy) return;
    busy = true;
    const room = current;
    const door = doorFor(room.id);
    const frame = door.querySelector(".vault-frame");
    const leaf = door.querySelector(".vault-door");
    const wheel = door.querySelector(".vault-wheel");
    const motion = !openedInstantly && !reduce.matches;

    if (motion) {
      const g = geometry(door);
      await play(room, [
        { clipPath: `circle(${g.far}px at ${g.x}px ${g.y}px)` },
        { clipPath: `circle(${g.near}px at ${g.x}px ${g.y}px)`, opacity: 0.4 },
      ], { duration: 460, easing: "cubic-bezier(.65,0,.35,1)" });
    } else {
      await play(room, [{ opacity: 1 }, { opacity: 0 }], { duration: 150 });
    }

    room.classList.remove("is-open");
    clear([room]);
    setOutsideInert(false);

    if (motion) {
      play(frame, [{ transform: "scale(1.5)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }],
        { duration: 360, easing: "cubic-bezier(.2,.7,.2,1)" });
      await play(leaf, [{ transform: "rotateY(-112deg)" }, { transform: "rotateY(0deg)" }],
        { duration: 420, easing: "cubic-bezier(.3,.6,.2,1)" });
      await play(wheel, [{ transform: "rotate(540deg)" }, { transform: "rotate(0deg)" }],
        { duration: 420, easing: "cubic-bezier(.55,0,.2,1)" });
    }
    clear([frame, leaf, wheel]);

    current = null;
    busy = false;
    skipping = false;
    door.focus({ preventScroll: true });
  }

  function requestClose() {
    if (!current) return;
    if (pushed) { pushed = false; history.back(); }   // popstate closes it
    else { history.replaceState(null, "", location.pathname + location.search); close(); }
  }

  document.querySelectorAll(".vault").forEach((door) => {
    door.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      if (busy) { skip(); return; }
      open(door.getAttribute("href").slice(1));
    });
  });

  document.querySelectorAll(".vault-close").forEach((btn) => btn.addEventListener("click", requestClose));

  document.addEventListener("pointerdown", (e) => {
    if (busy && !e.target.closest(".vault")) skip();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (busy) skip();
    else requestClose();
  });

  window.addEventListener("popstate", () => {
    const id = location.hash.slice(1);
    if (busy) skip();
    if (roomFor(id)) {
      if (current && current.id !== id) close().then(() => open(id, { push: false }));
      else open(id, { push: false });
    } else {
      pushed = false;
      close();
    }
  });

  const start = location.hash.slice(1);
  if (roomFor(start)) open(start, { instant: true, push: false });
})();
