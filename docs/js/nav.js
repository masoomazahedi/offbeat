/* OFFBEAT - the sidebar.
   AI acknowledgment: written with the assistance of Claude, an AI model made by Anthropic,
   and reviewed by the project author. See README.md in the repository.

   Two jobs: open and close the sidebar on a phone, and highlight the link of the
   section that is on screen. On a wide screen the sidebar is always visible. */
(function () {
  const side = document.getElementById("side");
  const menu = document.getElementById("menu");
  const scrim = document.getElementById("scrim");
  const links = [...side.querySelectorAll("nav a")];

  function setOpen(open) {
    side.classList.toggle("open", open);
    scrim.hidden = !open;
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  menu.addEventListener("click", () => setOpen(!side.classList.contains("open")));
  scrim.addEventListener("click", () => setOpen(false));
  side.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && side.classList.contains("open")) {
      setOpen(false);
      menu.focus();
    }
  });

  // Highlight the last section whose top has passed the upper third of the window.
  const ids = links.map((a) => a.dataset.sec);
  function mark() {
    const line = window.innerHeight * 0.35;
    let current = ids[0];
    for (const id of ids.slice(1)) {
      if (document.getElementById(id).getBoundingClientRect().top <= line) current = id;
    }
    for (const a of links) {
      const on = a.dataset.sec === current;
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
  }
  window.addEventListener("scroll", mark, { passive: true });
  window.addEventListener("resize", mark);
  mark();
})();
