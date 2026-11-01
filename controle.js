// controle.js
// Tela cheia, joystick transparente, modo limpo e menu "⋮" para o viewer.html.
// Carregue este arquivo DEPOIS do script principal do viewer.html.
(function () {
  // ===== Ajustes =====
  const LADO_JOYSTICK = "esquerda";   // "esquerda" ou "direita"
  const TEMPO_OCULTAR = 4000;         // ms sem toque até esconder os controles
  const ZONA_MORTA = 0.15;            // fração do raio, no centro, que não move a câmera
  const INTERVALO_ENVIO = 100;        // ms entre comandos enquanto o dedo está no joystick
  const TAM_JOY = 150;                // diâmetro do joystick, em pixels
  const TAM_BOLA = 64;                // diâmetro da bolinha, em pixels

  const el = id => document.getElementById(id);
  const doLado = LADO_JOYSTICK === "direita" ? "right" : "left";

  // ===== Estilo =====
  const estilo = document.createElement("style");
  estilo.textContent = `
    html, body { margin: 0; height: 100%; background: #000; color: #fff; overflow: hidden;
                 font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    h3 { display: none; }

    #v { position: fixed; top: 0; left: 0; width: 100%; height: 100%; max-width: none;
         object-fit: contain; background: #000; pointer-events: none; z-index: 0; }

    /* Status: com a câmera online vira só um ponto verde; nos outros casos mostra o texto */
    #estado { position: fixed; top: 12px; left: 12px; z-index: 30; margin: 0 !important;
              padding: 4px 12px !important; border-radius: 14px; font-size: 12px;
              max-width: 60vw; opacity: .92; box-sizing: border-box; }
    #estado.compacto { font-size: 0; padding: 0 !important; width: 12px; height: 12px;
                       border-radius: 50%; }

    #login { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 40;
             background: rgba(0,0,0,.78); padding: 16px 18px; border-radius: 10px; text-align: center; }

    #controles { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10;
                 pointer-events: none; transition: opacity .35s; }
    #controles > * { pointer-events: auto; }
    #controles.oculto { opacity: 0; }
    #controles.oculto, #controles.oculto * { pointer-events: none !important; }

    #mais { position: fixed; top: 6px; right: 8px; width: 40px; height: 40px; border-radius: 50%;
            border: 1px solid rgba(255,255,255,.35); background: rgba(0,0,0,.45); color: #fff;
            font-size: 22px; line-height: 1; padding: 0; }

    #menu { position: fixed; top: 52px; right: 8px; width: min(300px, calc(100vw - 16px));
            max-height: calc(100vh - 64px); overflow: auto; box-sizing: border-box; padding: 12px;
            border-radius: 12px; background: rgba(0,0,0,.78); display: none;
            flex-direction: column; gap: 10px; }
    #menu.aberto { display: flex; }

    #s { margin: 0; font-size: 13px; }
    #pos { font-size: 13px; display: none; }
    #botoes { display: flex; flex-direction: column; gap: 8px; }
    #botoes button { font-size: 15px !important; padding: 10px 14px !important;
                     background: rgba(255,255,255,.14); color: #fff;
                     border: 1px solid rgba(255,255,255,.4); border-radius: 8px; }

    #mov { margin: 0 !important; padding: 0 !important; border: none !important;
           background: transparent !important; font-size: 13px; color: #fff; }
    #mov button { background: rgba(255,255,255,.14); color: #fff;
                  border: 1px solid rgba(255,255,255,.4); border-radius: 6px; padding: 8px 12px; }
    #mov canvas { width: 100%; height: auto; }

    #joy { position: fixed; bottom: 28px; ${doLado}: 28px; width: ${TAM_JOY}px; height: ${TAM_JOY}px;
           border-radius: 50%; background: rgba(255,255,255,.10);
           border: 2px solid rgba(255,255,255,.35); touch-action: none; display: none;
           user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
    #knob { position: absolute; width: ${TAM_BOLA}px; height: ${TAM_BOLA}px; border-radius: 50%;
            left: ${(TAM_JOY - TAM_BOLA) / 2 - 2}px; top: ${(TAM_JOY - TAM_BOLA) / 2 - 2}px;
            background: rgba(255,255,255,.45); pointer-events: none; }

    button:focus-visible, input:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) { #controles { transition: none; } }
  `;
  document.head.appendChild(estilo);

  // ===== Montagem da tela =====
  const video = el("v");
  video.removeAttribute("controls");
  video.controls = false;

  const grupo = document.createElement("div");   // o que some na inatividade: joystick e "⋮"
  grupo.id = "controles";
  document.body.appendChild(grupo);

  const mais = document.createElement("button");
  mais.id = "mais";
  mais.textContent = "⋮";
  mais.setAttribute("aria-label", "Menu");
  mais.setAttribute("aria-expanded", "false");
  grupo.appendChild(mais);

  const menu = document.createElement("div");
  menu.id = "menu";
  grupo.appendChild(menu);

  const pos = document.createElement("div");
  pos.id = "pos";

  const btnCentro = document.createElement("button");
  btnCentro.id = "centro";
  btnCentro.textContent = "Centralizar";
  btnCentro.style.display = "none";

  const botoes = document.createElement("div");
  botoes.id = "botoes";
  botoes.appendChild(btnCentro);
  ["alt", "lan", "esq", "atu"].forEach(id => botoes.appendChild(el(id)));

  menu.appendChild(el("s"));
  menu.appendChild(pos);
  menu.appendChild(botoes);
  menu.appendChild(el("mov"));

  const joy = document.createElement("div");
  joy.id = "joy";
  const bola = document.createElement("div");
  bola.id = "knob";
  joy.appendChild(bola);
  grupo.appendChild(joy);
  joy.addEventListener("contextmenu", e => e.preventDefault());

  // Status compacto: só um ponto verde quando está tudo bem
  const estadoEl = el("estado");
  function ajustarEstado() {
    estadoEl.classList.toggle("compacto", estadoEl.textContent.indexOf("● Câmera online") === 0);
  }
  new MutationObserver(ajustarEstado).observe(estadoEl, { childList: true, characterData: true, subtree: true });
  ajustarEstado();

  // ===== Menu "⋮" =====
  let menuAberto = false;
  function abrirMenu(abrir) {
    menuAberto = abrir;
    menu.classList.toggle("aberto", abrir);
    mais.setAttribute("aria-expanded", String(abrir));
    reiniciarTimer();
  }
  mais.onclick = () => abrirMenu(!menuAberto);

  // ===== Joystick (modo velocidade) =====
  let ativo = false;
  let idPonteiro = null;
  let dx = 0;   // -1 (esquerda) .. 1 (direita)
  let dy = 0;   // -1 (baixo) .. 1 (cima)

  function atualizarJoystick(e) {
    const r = joy.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const limite = r.width / 2 - bola.offsetWidth / 2;

    let x = e.clientX - cx;
    let y = e.clientY - cy;
    const dist = Math.hypot(x, y);
    if (dist > limite) { x = x / dist * limite; y = y / dist * limite; }
    bola.style.transform = "translate(" + x + "px," + y + "px)";

    const modulo = Math.min(1, Math.hypot(x, y) / limite);
    if (modulo < ZONA_MORTA) { dx = 0; dy = 0; return; }

    // Curva suave: pouco movimento perto do centro, velocidade total na borda
    const f = (modulo - ZONA_MORTA) / (1 - ZONA_MORTA);
    const escala = f * f;
    const norma = Math.hypot(x, y);
    dx = (x / norma) * escala;
    dy = -(y / norma) * escala;   // para cima = positivo
  }

  function enviarMover() {
    if (!conn || !conn.open) return;
    try {
      conn.send({ tipo: "mover", dx: Number(dx.toFixed(2)), dy: Number(dy.toFixed(2)) });
    } catch (e) {}
  }

  joy.addEventListener("pointerdown", e => {
    if (ativo) return;
    ativo = true;
    idPonteiro = e.pointerId;
    try { joy.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
    atualizarJoystick(e);
  });
  joy.addEventListener("pointermove", e => {
    if (ativo && e.pointerId === idPonteiro) atualizarJoystick(e);
  });

  function soltar(e) {
    if (!ativo || e.pointerId !== idPonteiro) return;
    ativo = false;
    idPonteiro = null;
    bola.style.transform = "translate(0,0)";
    dx = 0;
    dy = 0;
    enviarMover();          // avisa a câmera para parar
    reiniciarTimer();
  }
  joy.addEventListener("pointerup", soltar);
  joy.addEventListener("pointercancel", soltar);

  // Enquanto o dedo estiver no joystick, repete o comando
  setInterval(() => {
    if (!ativo) return;
    enviarMover();
    // a imagem muda quando a câmera gira: evita falso alarme de movimento
    if ((dx !== 0 || dy !== 0) && typeof pausarMovimento === "function") pausarMovimento(2000);
  }, INTERVALO_ENVIO);

  btnCentro.onclick = () => {
    if (typeof pausarMovimento === "function") pausarMovimento(3000);
    if (conn && conn.open) conn.send({ tipo: "centro" });
  };

  // ===== Modo limpo: joystick e "⋮" somem na inatividade =====
  let timerOcultar = null;
  let visivel = true;

  function esconder() {
    // só esconde com a câmera conectada, sem dedo no joystick e com o menu fechado
    if (ativo || !conectado || menuAberto) { reiniciarTimer(); return; }
    grupo.classList.add("oculto");
    visivel = false;
  }
  function reiniciarTimer() {
    clearTimeout(timerOcultar);
    timerOcultar = setTimeout(esconder, TEMPO_OCULTAR);
  }
  function mostrar() {
    grupo.classList.remove("oculto");
    visivel = true;
    reiniciarTimer();
  }

  document.addEventListener("pointerdown", e => {
    if (!visivel) {
      // Escondidos: o primeiro toque só acorda os controles, sem mover a câmera
      e.preventDefault();
      e.stopPropagation();
      mostrar();
      return;
    }
    // Toque fora do menu o fecha
    if (menuAberto && !menu.contains(e.target) && e.target !== mais) abrirMenu(false);
    reiniciarTimer();
  }, true);
  document.addEventListener("pointermove", e => {
    if (e.pointerType === "mouse") mostrar();   // no computador, mexer o mouse também mostra
  }, true);
  mostrar();

  // ===== Posição enviada pela câmera =====
  let temServos = false;
  let ultimaPos = "";
  let ultimaConn = null;

  function aoReceber(msg) {
    if (!msg || msg.tipo !== "posicao") return;
    temServos = true;
    pos.textContent = "Giro " + msg.pan + "° · Inclinação " + msg.tilt + "°" +
                      (msg.limite ? "  ⚠ limite" : "");
    pos.style.color = msg.limite ? "#ffb74d" : "#fff";
    const chave = msg.pan + "," + msg.tilt;
    if (chave !== ultimaPos) {
      ultimaPos = chave;
      if (typeof pausarMovimento === "function") pausarMovimento(2000);
    }
  }

  // A conexão é recriada a cada reconexão: liga o ouvinte na nova
  setInterval(() => {
    if (conn && conn !== ultimaConn) {
      ultimaConn = conn;
      conn.on("data", aoReceber);
    }
    const comServos = conectado && temServos;
    joy.style.display = comServos ? "block" : "none";
    pos.style.display = comServos ? "block" : "none";
    btnCentro.style.display = comServos ? "inline-block" : "none";
    if (!conectado && !visivel) mostrar();   // câmera caiu: mostra os controles
  }, 300);
})();
