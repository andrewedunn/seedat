// ABOUTME: Address typeahead for every search box marked data-suggest: debounced /api/suggest, ARIA combobox pattern
// ABOUTME: (aria-activedescendant), stale responses ignored. Plain script; forms still work without it (submit to /search).
(() => {
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const titleCase = (s) => s.toLowerCase().replace(/(^|[\s\-/.])([a-z])/g, (_, p, c) => p + c.toUpperCase());

  for (const input of document.querySelectorAll("input[data-suggest]")) {
    const form = input.closest("form");
    const list = document.createElement("ul");
    list.className = "suggest";
    list.id = `${input.id}-suggest`;
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Matching addresses");
    list.hidden = true;
    const status = document.createElement("p");
    status.className = "sr-only";
    status.setAttribute("role", "status");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", list.id);
    input.setAttribute("aria-expanded", "false");
    form.append(list, status);

    let timer = 0, active = -1, items = [], seq = 0;
    const close = () => {
      list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); active = -1;
    };
    const highlight = (i) => {
      items.forEach((a, j) => a.setAttribute("aria-selected", String(j === i)));
      active = i;
      input.setAttribute("aria-activedescendant", items[i].id);
    };

    input.addEventListener("input", () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 3) { seq++; return close(); }
      timer = setTimeout(async () => {
        const mine = ++seq;
        try {
          const rows = await (await fetch(`/api/suggest?q=${encodeURIComponent(q)}`)).json();
          if (mine !== seq) return;   // a newer keystroke has already asked again
          list.replaceChildren(...rows.map((r, i) => {
            const li = document.createElement("li");
            li.setAttribute("role", "none");
            const a = document.createElement("a");
            a.id = `${list.id}-${i}`;
            a.href = `/p/${r.geopin}/${slug(r.full_address)}`;
            a.setAttribute("role", "option");
            a.setAttribute("aria-selected", "false");
            a.tabIndex = -1;
            a.textContent = r.full_address;
            if (r.neighborhood) { const s = document.createElement("span"); s.textContent = titleCase(r.neighborhood); a.appendChild(s); }
            li.appendChild(a);
            return li;
          }));
          items = [...list.querySelectorAll("a")];
          list.hidden = items.length === 0;
          input.setAttribute("aria-expanded", String(!list.hidden));
          input.removeAttribute("aria-activedescendant");
          active = -1;
          status.textContent = items.length ? `${items.length} matching addresses. Use the arrow keys to choose.` : "No matching addresses.";
        } catch {
          if (mine === seq) close();
        }
      }, 160);
    });

    input.addEventListener("keydown", (e) => {
      if (list.hidden || !items.length) return;
      if (e.key === "ArrowDown") { e.preventDefault(); highlight((active + 1) % items.length); }
      else if (e.key === "ArrowUp") { e.preventDefault(); highlight((active - 1 + items.length) % items.length); }
      else if (e.key === "Enter" && active >= 0) { e.preventDefault(); location.href = items[active].href; }
      else if (e.key === "Escape") close();
    });
    input.addEventListener("blur", () => setTimeout(close, 150));
  }
})();
