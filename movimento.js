// movimento.js
// Pan/tilt da câmera. Por enquanto os ângulos só aparecem na tela (simulação).
// Quando o Arduino estiver pronto, o app lê "SERVO:giro,inclinação" no console
// e repassa ao Arduino pelo cabo OTG.
// Carregue este arquivo DEPOIS do script principal do camera.html.
(function () {
  // ===== Ajustes =====
  const PAN_MIN = 10, PAN_MAX = 170;     // limites do giro (graus)
  const TILT_MIN = 40, TILT_MAX = 140;   // limites da inclinação (graus)
  const VEL_MAX = 60;                    // graus por segundo com o joystick no máximo
  const SINAL_PAN = 1;                   // troque por -1 se o giro estiver invertido
  const SINAL_TILT = 1;                  // troque por -1 se a inclinação estiver invertida
  const PARAR_APOS = 500;                // ms sem comando = para (joystick solto ou conexão perdida)

  let pan = 90;
  let tilt = 90;
  let velX = 0;
  let velY = 0;
  let ultimoComando = 0;
  let ultimoTexto = "";

  const linha = document.createElement("p");
  linha.id = "m";
  document.getElementById("l").insertAdjacentElement("afterend", linha);

  function limitar(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function noLimite() {
    return pan <= PAN_MIN || pan >= PAN_MAX || tilt <= TILT_MIN || tilt >= TILT_MAX;
  }

  // Mostra na tela, avisa o console (para o app) e informa os visualizadores
  function publicar() {
    const p = Math.round(pan);
    const t = Math.round(tilt);
    const texto = p + "," + t;
    linha.textContent = "Giro " + p + "° · Inclinação " + t + "°";
    if (texto !== ultimoTexto) {
      ultimoTexto = texto;
      console.log("SERVO:" + texto);
    }
    avisarTodos({ tipo: "posicao", pan: p, tilt: t, limite: noLimite() });
  }

  // Comandos do visualizador (só de quem acertou a senha)
  peer.on("connection", conn => {
    conn.on("data", msg => {
      if (!msg || !autorizados.has(conn.peer)) return;

      if (msg.tipo === "mover") {
        velX = limitar(Number(msg.dx) || 0, -1, 1);
        velY = limitar(Number(msg.dy) || 0, -1, 1);
        ultimoComando = Date.now();
      }

      if (msg.tipo === "centro") {
        pan = 90;
        tilt = 90;
        velX = 0;
        velY = 0;
        publicar();
      }
    });
  });

  // A cada 100 ms: integra a velocidade em ângulo, respeitando os limites
  setInterval(() => {
    if (Date.now() - ultimoComando > PARAR_APOS) { velX = 0; velY = 0; }
    if (velX !== 0 || velY !== 0) {
      pan = limitar(pan + SINAL_PAN * velX * VEL_MAX * 0.1, PAN_MIN, PAN_MAX);
      tilt = limitar(tilt + SINAL_TILT * velY * VEL_MAX * 0.1, TILT_MIN, TILT_MAX);
      publicar();
    }
  }, 100);

  // Reenvia a posição a cada segundo (visualizadores novos ficam sabendo)
  setInterval(publicar, 1000);
  publicar();
})();
