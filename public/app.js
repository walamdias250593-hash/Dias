"use strict";

// ---------- Elementos da tela ----------
const conversaEl = document.getElementById("conversa");
const statusEl = document.getElementById("status");
const micBtn = document.getElementById("mic");
const continuoEl = document.getElementById("continuo");
const formTexto = document.getElementById("form-texto");
const inputTexto = document.getElementById("texto");

// Histórico completo enviado ao Claude a cada turno.
const historico = [];
let ocupado = false;

const config = { velocidade: 1, tom: 1 };

// ---------- Armazenamento local seguro ----------
function lerLocal(chave, padrao) {
  try {
    const valor = localStorage.getItem(chave);
    return valor === null ? padrao : JSON.parse(valor);
  } catch {
    return padrao;
  }
}
function gravarLocal(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* armazenamento indisponível: segue sem persistir */
  }
}

Object.assign(config, lerLocal("dias-voz", {}));
document.documentElement.dataset.theme = lerLocal("dias-tema", "claro");

// ---------- Interface ----------
function adicionarMensagem(texto, tipo) {
  const div = document.createElement("div");
  div.className = `msg ${tipo}`;
  div.textContent = texto;
  conversaEl.appendChild(div);
  conversaEl.scrollTop = conversaEl.scrollHeight;
  return div;
}

function adicionarAcao(texto, link) {
  const div = adicionarMensagem(texto, "acao");
  if (link) {
    div.append(" — ");
    const a = document.createElement("a");
    a.href = link;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "abrir";
    div.appendChild(a);
  }
}

function setStatus(texto) {
  statusEl.textContent = texto;
}

// ---------- Fala (texto para voz) ----------
let vozPtBr = null;
function escolherVoz() {
  const vozes = speechSynthesis.getVoices();
  vozPtBr =
    vozes.find((v) => v.lang === "pt-BR" && /google|natural|online/i.test(v.name)) ||
    vozes.find((v) => v.lang === "pt-BR") ||
    vozes.find((v) => v.lang.startsWith("pt")) ||
    null;
}
if ("speechSynthesis" in window) {
  escolherVoz();
  speechSynthesis.onvoiceschanged = escolherVoz;
}

function falar(texto) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window) || !texto) return resolve();
    speechSynthesis.cancel();
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = "pt-BR";
    if (vozPtBr) fala.voice = vozPtBr;
    fala.rate = config.velocidade;
    fala.pitch = config.tom;
    fala.onend = resolve;
    fala.onerror = resolve;
    setStatus("Falando…");
    speechSynthesis.speak(fala);
  });
}

// ---------- Reconhecimento de voz ----------
const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;
let reconhecimento = null;
let ouvindo = false;
let ouvirDepois = false; // usuário tocou no microfone enquanto o assistente falava

if (Reconhecimento) {
  reconhecimento = new Reconhecimento();
  reconhecimento.lang = "pt-BR";
  reconhecimento.interimResults = true;
  reconhecimento.continuous = false;

  let parcial = null;

  reconhecimento.onstart = () => {
    ouvindo = true;
    micBtn.classList.add("ouvindo");
    setStatus("Ouvindo…");
  };

  reconhecimento.onresult = (evento) => {
    let textoFinal = "";
    let textoParcial = "";
    for (const resultado of evento.results) {
      if (resultado.isFinal) textoFinal += resultado[0].transcript;
      else textoParcial += resultado[0].transcript;
    }
    if (textoFinal) {
      if (parcial) parcial.remove();
      parcial = null;
      enviar(textoFinal.trim());
    } else if (textoParcial) {
      if (!parcial) parcial = adicionarMensagem("", "usuario");
      parcial.textContent = textoParcial;
    }
  };

  reconhecimento.onerror = (evento) => {
    if (evento.error === "not-allowed" || evento.error === "service-not-allowed") {
      setStatus("Permita o uso do microfone no navegador.");
    } else if (evento.error === "no-speech") {
      setStatus("Não ouvi nada. Toque no microfone para tentar de novo.");
    } else if (evento.error !== "aborted") {
      setStatus(`Erro no microfone: ${evento.error}`);
    }
  };

  reconhecimento.onend = () => {
    ouvindo = false;
    micBtn.classList.remove("ouvindo");
    if (parcial) {
      parcial.remove();
      parcial = null;
    }
    if (!ocupado && statusEl.textContent === "Ouvindo…") setStatus("Pronto");
  };
} else {
  setStatus("Seu navegador não reconhece voz. Use o Chrome ou o Edge, ou digite abaixo.");
  micBtn.disabled = true;
}

function comecarAOuvir() {
  if (!reconhecimento || ouvindo || ocupado) return;
  try {
    reconhecimento.start();
  } catch {
    /* já estava iniciando */
  }
}

micBtn.addEventListener("click", () => {
  if ("speechSynthesis" in window && speechSynthesis.speaking) {
    speechSynthesis.cancel(); // interrompe a fala e passa a ouvir
    if (ocupado) {
      ouvirDepois = true;
      return;
    }
  }
  if (ouvindo) reconhecimento.stop();
  else comecarAOuvir();
});

formTexto.addEventListener("submit", (evento) => {
  evento.preventDefault();
  const texto = inputTexto.value.trim();
  if (!texto) return;
  inputTexto.value = "";
  enviar(texto);
});

// ---------- Ferramentas (comandos executados no navegador) ----------
function abrirUrl(url, descricao) {
  const janela = window.open(url, "_blank", "noopener");
  adicionarAcao(descricao, url);
  // Com "noopener" o navegador pode retornar null mesmo quando abre a aba.
  return janela === null
    ? `Tentei abrir ${url}. Se o navegador bloqueou a janela, há um link na tela para o usuário tocar.`
    : `Aberto: ${url}`;
}

const ferramentas = {
  abrir_site({ url }) {
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    return abrirUrl(url, `Abrindo ${url}`);
  },
  pesquisar_web({ consulta }) {
    return abrirUrl(
      `https://www.google.com/search?q=${encodeURIComponent(consulta)}`,
      `Pesquisando "${consulta}"`
    );
  },
  tocar_youtube({ consulta }) {
    return abrirUrl(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(consulta)}`,
      `YouTube: "${consulta}"`
    );
  },
  definir_timer({ segundos, rotulo }) {
    if (!(segundos > 0)) throw new Error("A duração precisa ser maior que zero.");
    setTimeout(() => {
      const aviso = `Seu timer ${rotulo} terminou!`;
      adicionarMensagem(aviso, "assistente");
      falar(aviso);
    }, segundos * 1000);
    adicionarAcao(`Timer "${rotulo}" de ${segundos}s criado`);
    return `Timer "${rotulo}" criado para ${segundos} segundos.`;
  },
  obter_data_hora() {
    const agora = new Date();
    return JSON.stringify({
      data_hora: agora.toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" }),
      fuso: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  },
  salvar_nota({ texto }) {
    const notas = lerLocal("dias-notas", []);
    notas.push({ texto, quando: new Date().toLocaleString("pt-BR") });
    gravarLocal("dias-notas", notas);
    adicionarAcao(`Nota salva: ${texto}`);
    return `Nota salva. Total de notas: ${notas.length}.`;
  },
  listar_notas() {
    const notas = lerLocal("dias-notas", []);
    if (notas.length === 0) return "Não há notas salvas.";
    return notas.map((n, i) => `${i + 1}. ${n.texto} (${n.quando})`).join("\n");
  },
  apagar_notas() {
    gravarLocal("dias-notas", []);
    adicionarAcao("Todas as notas foram apagadas");
    return "Todas as notas foram apagadas.";
  },
  ajustar_voz({ velocidade, tom }) {
    const limitar = (v) => Math.min(2, Math.max(0.5, Number(v) || 1));
    config.velocidade = limitar(velocidade);
    config.tom = limitar(tom);
    gravarLocal("dias-voz", config);
    adicionarAcao(`Voz: velocidade ${config.velocidade}, tom ${config.tom}`);
    return `Voz ajustada: velocidade ${config.velocidade}, tom ${config.tom}.`;
  },
  mudar_tema({ tema }) {
    document.documentElement.dataset.theme = tema;
    gravarLocal("dias-tema", tema);
    return `Tema alterado para ${tema}.`;
  },
};

function executarFerramenta(bloco) {
  const funcao = ferramentas[bloco.name];
  if (!funcao) {
    return { type: "tool_result", tool_use_id: bloco.id, content: `Ferramenta desconhecida: ${bloco.name}`, is_error: true };
  }
  try {
    const resultado = funcao(bloco.input || {});
    return { type: "tool_result", tool_use_id: bloco.id, content: String(resultado) };
  } catch (erro) {
    return { type: "tool_result", tool_use_id: bloco.id, content: `Erro: ${erro.message}`, is_error: true };
  }
}

// ---------- Conversa com o Claude ----------
async function chamarClaude() {
  const resposta = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: historico }),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.error || `Erro ${resposta.status}`);
  return dados;
}

async function enviar(texto) {
  if (ocupado || !texto) return;
  ocupado = true;
  adicionarMensagem(texto, "usuario");
  setStatus("Pensando…");

  const tamanhoAntes = historico.length;
  historico.push({ role: "user", content: texto });

  let textoParaFalar = "";
  try {
    for (let rodada = 0; rodada < 10; rodada++) {
      const { content, stop_reason } = await chamarClaude();
      // Devolve o conteúdo completo (inclusive blocos de raciocínio) no próximo turno.
      historico.push({ role: "assistant", content });

      if (stop_reason === "refusal") {
        textoParaFalar = "Desculpe, não posso ajudar com isso.";
        adicionarMensagem(textoParaFalar, "assistente");
        break;
      }

      const textos = content.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
      if (textos) {
        adicionarMensagem(textos, "assistente");
        textoParaFalar = textos;
      }

      const pedidos = content.filter((b) => b.type === "tool_use");
      if (stop_reason !== "tool_use" || pedidos.length === 0) break;

      setStatus("Executando comando…");
      // Todos os resultados vão juntos em uma única mensagem.
      historico.push({ role: "user", content: pedidos.map(executarFerramenta) });
      setStatus("Pensando…");
    }
  } catch (erro) {
    // Desfaz o turno incompleto para manter o histórico válido.
    historico.length = tamanhoAntes;
    textoParaFalar = "Tive um problema para responder. Tente de novo.";
    adicionarMensagem(`${textoParaFalar} (${erro.message})`, "assistente");
  }

  await falar(limparParaFala(textoParaFalar));
  ocupado = false;
  setStatus("Pronto");
  if (continuoEl.checked || ouvirDepois) comecarAOuvir();
  ouvirDepois = false;
}

function limparParaFala(texto) {
  return texto
    .replace(/https?:\/\/\S+/g, "o link")
    .replace(/[*_#`>~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
