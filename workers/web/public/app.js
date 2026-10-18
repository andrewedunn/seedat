// ABOUTME: Address typeahead for every search box marked data-suggest: debounced /api/suggest, keyboard navigable.
// ABOUTME: Plain script, no framework; the form still works without it (submits to /search).
(() => {
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const titleCase = (s) => s.toLowerCase().replace(/(^|[\s\-/.])([a-z])/g, (_, p, c) => p + c.toUpperCase());

  for (const input of document.querySelectorAll("input[data-suggest]")) {
    const list = document.createElement("ul");
    list.className = "suggest";
    list.id = `${input.id}-suggest`;
    list.setAttribute("role", "listbox");
    list.hidden = true;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", list.id);
    input.setAttribute("aria-expanded", "false");
    input.closest("form").appendChild(list);

    let timer = 0, active = -1, items = [];
    const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; };
    const highlight = (i) => {
      items.forEach((a, j) => a.setAttribute("aria-selected", String(j === i)));
      active = i;
    };

    input.addEventListener("input", () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 3) return close();
      timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
          const rows = await res.json();
          list.replaceChildren(...rows.map((r) => {
            const li = document.createElement("li");
            const a = document.createElement("a");
            a.href = `/p/${r.geopin}/${slug(r.full_address)}`;
            a.setAttribute("role", "option");
            a.textContent = r.full_address;
            if (r.neighborhood) { const s = document.createElement("span"); s.textContent = titleCase(r.neighborhood); a.appendChild(s); }
            li.appendChild(a);
            return li;
          }));
          items = [...list.querySelectorAll("a")];
          list.hidden = items.length === 0;
          input.setAttribute("aria-expanded", String(!list.hidden));
          active = -1;
        } catch { close(); }
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
