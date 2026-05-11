/**
 * Toast notification system
 * API:
 *   showToast("Mensagem simples", "success" | "error" | "info" | "warning")
 *   showToast({ title: "Título", description: "Descrição detalhada" }, "error")
 */
(function () {
  const THEMES = {
    success: {
      bg:        "#0d2b1a",
      border:    "#166534",
      iconBg:    "#14532d",
      iconColor: "#4ade80",
      titleColor:"#dcfce7",
      bodyColor: "#86efac",
      svg: '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg>',
    },
    error: {
      bg:        "#2d0f0f",
      border:    "#7f1d1d",
      iconBg:    "#450a0a",
      iconColor: "#f87171",
      titleColor:"#fee2e2",
      bodyColor: "#fca5a5",
      svg: '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd"/></svg>',
    },
    warning: {
      bg:        "#1c1800",
      border:    "#7a6000",
      iconBg:    "#2a2200",
      iconColor: "#facc15",
      titleColor:"#fef9c3",
      bodyColor: "#fde047",
      svg: '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>',
    },
    info: {
      bg:        "#0c1e35",
      border:    "#1e3a5f",
      iconBg:    "#172554",
      iconColor: "#60a5fa",
      titleColor:"#dbeafe",
      bodyColor: "#93c5fd",
      svg: '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd"/></svg>',
    },
  };

  const DURATION = { success: 3500, info: 4000, warning: 7000, error: 5000 };

  function getContainer() {
    let c = document.getElementById("crm-toast-container");
    if (!c) {
      c = document.createElement("div");
      c.id = "crm-toast-container";
      c.setAttribute("style",
        "position:fixed;" +
        "top:20px;" +
        "right:20px;" +
        "z-index:2147483647;" +
        "width:380px;" +
        "max-width:calc(100vw - 32px);" +
        "pointer-events:none;" +
        "display:block;" +
        "margin:0;" +
        "padding:0;" +
        "border:none;" +
        "background:none;"
      );
      document.body.appendChild(c);
    }
    return c;
  }

  window.showToast = function (message, type) {
    type = THEMES[type] ? type : "info";
    const th = THEMES[type];
    const container = getContainer();

    const isObj = typeof message === "object" && message !== null;
    const title = isObj ? (message.title || "")       : "";
    const body  = isObj ? (message.description || "") : String(message || "");

    const spacer = document.createElement("div");
    spacer.style.cssText = "height:10px;display:block;";

    const card = document.createElement("div");
    card.style.cssText =
      "display:block;" +
      "position:relative;" +
      "box-sizing:border-box;" +
      "width:100%;" +
      "padding:14px 40px 17px 56px;" +
      "background:" + th.bg + ";" +
      "border:1px solid " + th.border + ";" +
      "border-radius:10px;" +
      "box-shadow:0 8px 24px rgba(0,0,0,0.55),0 2px 8px rgba(0,0,0,0.3);" +
      "pointer-events:all;" +
      "opacity:0;" +
      "overflow:hidden;" +
      "transform:translateX(16px);" +
      "transition:opacity 0.22s ease,transform 0.22s ease;" +
      "margin:0;" +
      "word-break:normal;" +
      "overflow-wrap:break-word;";

    const icon = document.createElement("div");
    icon.style.cssText =
      "position:absolute;" +
      "left:14px;" +
      "top:14px;" +
      "width:28px;" +
      "height:28px;" +
      "border-radius:7px;" +
      "background:" + th.iconBg + ";" +
      "display:flex;" +
      "align-items:center;" +
      "justify-content:center;" +
      "color:" + th.iconColor + ";";
    icon.innerHTML = th.svg;

    const btn = document.createElement("button");
    btn.innerHTML = "&#x2715;";
    btn.setAttribute("aria-label", "Fechar");
    btn.className = "crm-toast-close";
    btn.style.cssText =
      "position:absolute;" +
      "top:12px;" +
      "right:12px;" +
      "background:none;" +
      "border:none;" +
      "cursor:pointer;" +
      "color:" + th.bodyColor + ";" +
      "font-size:14px;" +
      "opacity:0.5;" +
      "padding:2px 4px;" +
      "line-height:1;" +
      "transition:opacity 0.15s;";
    btn.addEventListener("mouseenter", () => { btn.style.opacity = "1"; });
    btn.addEventListener("mouseleave", () => { btn.style.opacity = "0.5"; });

    card.appendChild(icon);
    card.appendChild(btn);

    if (title) {
      const titleEl = document.createElement("div");
      titleEl.style.cssText =
        "display:block;" +
        "font-size:13px;" +
        "font-weight:600;" +
        "line-height:1.45;" +
        "color:" + th.titleColor + ";" +
        (body ? "margin-bottom:5px;" : "");
      titleEl.textContent = title;
      card.appendChild(titleEl);
    }

    if (body) {
      const bodyEl = document.createElement("div");
      bodyEl.style.cssText =
        "display:block;" +
        "font-size:" + (title ? "12.5px" : "13px") + ";" +
        "font-weight:" + (title ? "400" : "500") + ";" +
        "line-height:1.55;" +
        "color:" + (title ? th.bodyColor : th.titleColor) + ";";
      bodyEl.innerHTML = body;
      card.appendChild(bodyEl);
    }

    // barra de progresso
    const dur = DURATION[type] || 4000;
    const bar = document.createElement("div");
    bar.style.cssText =
      "position:absolute;bottom:0;left:0;height:3px;" +
      "background:" + th.border + ";width:100%;" +
      "transform-origin:left;transition:width " + dur + "ms linear;";
    card.appendChild(bar);

    container.appendChild(card);
    container.appendChild(spacer);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      card.style.opacity   = "1";
      card.style.transform = "translateX(0)";
      bar.style.width = "0%";
    }));

    const close = () => {
      card.style.opacity   = "0";
      card.style.transform = "translateX(16px)";
      setTimeout(() => { card.remove(); spacer.remove(); }, 260);
    };

    btn.addEventListener("click", close);
    setTimeout(close, dur);
  };

  // Lê variáveis CSS do tema atual para os dialogs JS
  function dialogTheme() {
    const cs  = getComputedStyle(document.body);
    const get = function (v) { return cs.getPropertyValue(v).trim(); };
    const dark = document.body.classList.contains("dark");
    return {
      dark:        dark,
      bgCard:      get("--bg-container"),
      border:      get("--border-soft"),
      textTitle:   get("--text-strong"),
      textMsg:     get("--text-muted"),
      bgSecondary: get("--bg-body"),
      bgHover:     dark ? "#1e2435" : get("--bg-sidebar-item-hover"),
    };
  }

  // ── showConfirm(message, { title, confirmText, cancelText, danger }) ──
  // Retorna Promise<boolean>
  window.showConfirm = function (message, opts) {
    opts = opts || {};
    const title       = opts.title       || "Confirmar";
    const confirmText = opts.confirmText || "Confirmar";
    const cancelText  = opts.cancelText  || "Cancelar";
    const danger      = opts.danger !== false; // default true
    const t           = dialogTheme();

    return new Promise(function (resolve) {
      const overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:2147483640;" +
        "background:rgba(0,0,0,0.55);backdrop-filter:blur(2px);" +
        "display:flex;align-items:center;justify-content:center;";

      const card = document.createElement("div");
      card.style.cssText =
        "background:" + t.bgCard + ";border:1px solid " + t.border + ";border-radius:14px;" +
        "box-shadow:0 24px 60px rgba(0,0,0,0.4);padding:28px 28px 24px;" +
        "width:380px;max-width:calc(100vw - 32px);box-sizing:border-box;" +
        "font-family:'Plus Jakarta Sans',sans-serif;";

      const titleEl = document.createElement("div");
      titleEl.style.cssText =
        "font-size:15px;font-weight:700;color:" + t.textTitle + ";margin-bottom:10px;";
      titleEl.textContent = title;

      const msgEl = document.createElement("div");
      msgEl.style.cssText =
        "font-size:13.5px;color:" + t.textMsg + ";line-height:1.6;margin-bottom:24px;white-space:pre-line;";
      msgEl.textContent = message;

      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:10px;justify-content:flex-end;";

      const btnCancel = document.createElement("button");
      btnCancel.textContent = cancelText;
      btnCancel.style.cssText =
        "padding:9px 20px;border-radius:8px;border:1px solid " + t.border + ";" +
        "background:" + t.bgSecondary + ";color:" + t.textMsg + ";font-size:13px;font-weight:600;" +
        "cursor:pointer;transition:background 0.15s;width:auto;box-shadow:none;";
      btnCancel.addEventListener("mouseenter", function () { btnCancel.style.background = t.bgHover; });
      btnCancel.addEventListener("mouseleave", function () { btnCancel.style.background = t.bgSecondary; });

      const btnOk = document.createElement("button");
      btnOk.textContent = confirmText;
      btnOk.style.cssText =
        "padding:9px 20px;border-radius:8px;border:none;" +
        "background:" + (danger ? "#dc2626" : "#2563eb") + ";" +
        "color:#fff;font-size:13px;font-weight:600;" +
        "cursor:pointer;transition:background 0.15s;width:auto;box-shadow:none;";
      btnOk.addEventListener("mouseenter", function () { btnOk.style.background = danger ? "#b91c1c" : "#1d4ed8"; });
      btnOk.addEventListener("mouseleave", function () { btnOk.style.background = danger ? "#dc2626" : "#2563eb"; });

      const close = function (result) {
        window._confirmAtivo = false;
        overlay.style.opacity = "0";
        overlay.style.transition = "opacity 0.18s";
        setTimeout(function () { overlay.remove(); }, 200);
        resolve(result);
      };

      btnCancel.addEventListener("click", function () { close(false); });
      btnOk.addEventListener("click",     function () { close(true);  });
      overlay.addEventListener("click",   function (e) { if (e.target === overlay) close(false); });
      document.addEventListener("keydown", function handler(e) {
        if (e.key === "Escape") { document.removeEventListener("keydown", handler); close(false); }
        if (e.key === "Enter")  { document.removeEventListener("keydown", handler); close(true);  }
      });

      row.appendChild(btnCancel);
      row.appendChild(btnOk);
      card.appendChild(titleEl);
      card.appendChild(msgEl);
      card.appendChild(row);
      overlay.appendChild(card);
      document.body.appendChild(overlay);

      window._confirmAtivo = true;
      requestAnimationFrame(function () { btnOk.focus(); });
    });
  };

  // ── showDuplicataAviso(message, { title }) ────────────────────────────────
  // Exibe aviso de possível duplicata com dois botões: "Visualizar outro registro" e "Ok".
  // Retorna Promise<"ver" | "ok">
  window.showDuplicataAviso = function (message, opts) {
    opts = opts || {};
    const title = opts.title || "Possível duplicata";
    const t     = dialogTheme();

    // Cores do ícone/título de aviso adaptadas ao tema
    const warnBorder  = t.dark ? "#7a6000"  : "#ca8a04";
    const warnIconBg  = t.dark ? "#2a2200"  : "#fef3c7";
    const warnTitle   = t.dark ? "#fef9c3"  : "#78350f";

    return new Promise(function (resolve) {
      const overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:2147483640;" +
        "background:rgba(0,0,0,0.55);backdrop-filter:blur(2px);" +
        "display:flex;align-items:center;justify-content:center;";

      const card = document.createElement("div");
      card.style.cssText =
        "background:" + t.bgCard + ";border:1px solid " + warnBorder + ";border-radius:14px;" +
        "box-shadow:0 24px 60px rgba(0,0,0,0.4);padding:28px 28px 24px;" +
        "width:420px;max-width:calc(100vw - 32px);box-sizing:border-box;" +
        "font-family:'Plus Jakarta Sans',sans-serif;";

      const iconRow = document.createElement("div");
      iconRow.style.cssText = "display:flex;align-items:center;gap:10px;margin-bottom:10px;";
      iconRow.innerHTML =
        '<div style="width:28px;height:28px;border-radius:7px;background:' + warnIconBg + ';' +
        'display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<svg width="16" height="16" viewBox="0 0 20 20" fill="#f59e0b"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>' +
        "</div>";

      const titleEl = document.createElement("div");
      titleEl.style.cssText = "font-size:15px;font-weight:700;color:" + warnTitle + ";";
      titleEl.textContent = title;
      iconRow.appendChild(titleEl);

      const msgEl = document.createElement("div");
      msgEl.style.cssText =
        "font-size:13.5px;color:" + t.textMsg + ";line-height:1.6;margin-bottom:24px;white-space:pre-line;";
      msgEl.textContent = message;

      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;";

      const btnVer = document.createElement("button");
      btnVer.textContent = "Visualizar outro registro";
      btnVer.style.cssText =
        "padding:9px 20px;border-radius:8px;border:1px solid " + t.border + ";" +
        "background:" + t.bgSecondary + ";color:" + t.textMsg + ";font-size:13px;font-weight:600;" +
        "cursor:pointer;transition:background 0.15s;width:auto;box-shadow:none;";
      btnVer.addEventListener("mouseenter", function () { btnVer.style.background = t.bgHover; });
      btnVer.addEventListener("mouseleave", function () { btnVer.style.background = t.bgSecondary; });

      const btnOk = document.createElement("button");
      btnOk.textContent = "Ok";
      btnOk.style.cssText =
        "padding:9px 20px;border-radius:8px;border:none;" +
        "background:#2563eb;color:#fff;font-size:13px;font-weight:600;" +
        "cursor:pointer;transition:background 0.15s;width:auto;box-shadow:none;";
      btnOk.addEventListener("mouseenter", function () { btnOk.style.background = "#1d4ed8"; });
      btnOk.addEventListener("mouseleave", function () { btnOk.style.background = "#2563eb"; });

      const close = function (result) {
        window._confirmAtivo = false;
        overlay.style.opacity = "0";
        overlay.style.transition = "opacity 0.18s";
        setTimeout(function () { overlay.remove(); }, 200);
        resolve(result);
      };

      function kbHandler(e) {
        if (e.key === "Escape") { document.removeEventListener("keydown", kbHandler); close("ok"); }
        if (e.key === "Enter")  { document.removeEventListener("keydown", kbHandler); close("ok"); }
      }

      btnVer.addEventListener("click", function () { document.removeEventListener("keydown", kbHandler); close("ver"); });
      btnOk.addEventListener("click",  function () { document.removeEventListener("keydown", kbHandler); close("ok"); });
      overlay.addEventListener("click", function (e) { if (e.target === overlay) { document.removeEventListener("keydown", kbHandler); close("ok"); } });
      document.addEventListener("keydown", kbHandler);

      row.appendChild(btnVer);
      row.appendChild(btnOk);
      card.appendChild(iconRow);
      card.appendChild(msgEl);
      card.appendChild(row);
      overlay.appendChild(card);
      document.body.appendChild(overlay);

      window._confirmAtivo = true;
      requestAnimationFrame(function () { btnOk.focus(); });
    });
  };
})();
