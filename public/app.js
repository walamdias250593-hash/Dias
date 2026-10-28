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

// ---------- Ferramentas do computador (executadas pelo servidor) ----------
let ferramentasPc = new Set();
let precisaConfirmar = new Set();

async function postarApi(rota, corpo) {
  const resposta = await fetch(rota, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Dias": "1" },
    body: JSON.stringify(corpo),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.error || `Erro ${resposta.status}`);
  return dados;
}

const avisoServidor = document.getElementById("aviso-servidor");

async function carregarConfig() {
  try {
    const cfg = await (await fetch("/api/config", { headers: { "X-Dias": "1" } })).json();
    avisoServidor.hidden = true;
    ferramentasPc = new Set(cfg.ferramentasPc || []);
    precisaConfirmar = new Set(cfg.precisaConfirmar || []);
    return cfg;
  } catch {
    // A tela abriu pelo cache, mas o servidor não está rodando.
    avisoServidor.hidden = false;
    return null;
  }
}

const configCarregada = carregarConfig().then((cfg) => {
  if (cfg && !cfg.temChave) abrirConfiguracoes(cfg);
});

const modal = document.getElementById("confirmacao");
const modalTitulo = document.getElementById("confirmacao-titulo");
const modalMotivo = document.getElementById("confirmacao-motivo");
const modalDetalhe = document.getElementById("confirmacao-detalhe");

function pedirConfirmacao(bloco) {
  const { name, input } = bloco;
  const textos = {
    executar_comando: () => ["Executar comando no seu PC?", input.motivo, input.comando],
    escrever_arquivo: () => ["Salvar arquivo no seu PC?", input.caminho, String(input.conteudo).slice(0, 2000)],
    abrir_no_pc: () => ["Abrir no seu PC?", "", input.alvo],
  };
  const [titulo, motivo, detalhe] = textos[name]?.() || [`Permitir ${name}?`, "", JSON.stringify(input)];
  modalTitulo.textContent = titulo;
  modalMotivo.textContent = motivo || "";
  modalDetalhe.textContent = detalhe || "";
  setStatus("Aguardando sua aprovação…");
  return new Promise((resolve) => {
    modal.onclose = () => resolve(modal.returnValue === "sim");
    modal.showModal();
  });
}

async function executarFerramentaPc(bloco) {
  if (precisaConfirmar.has(bloco.name) && !(await pedirConfirmacao(bloco))) {
    adicionarAcao("Ação recusada por você");
    return { type: "tool_result", tool_use_id: bloco.id, content: "O usuário recusou esta ação.", is_error: true };
  }
  const nomes = {
    executar_comando: `Executando: ${bloco.input.comando}`,
    dispositivos_conectados: "Verificando os dispositivos conectados",
    listar_pasta: `Vendo a pasta ${bloco.input.caminho}`,
    ler_arquivo: `Lendo ${bloco.input.caminho}`,
    escrever_arquivo: `Salvando ${bloco.input.caminho}`,
    abrir_no_pc: `Abrindo ${bloco.input.alvo}`,
  };
  adicionarAcao(nomes[bloco.name] || bloco.name);
  setStatus("Trabalhando no seu PC…");
  const { ok, texto } = await postarApi("/api/pc", { nome: bloco.name, input: bloco.input });
  return { type: "tool_result", tool_use_id: bloco.id, content: texto || "(sem saída)", is_error: !ok };
}

async function executarFerramenta(bloco) {
  await configCarregada;
  if (ferramentasPc.has(bloco.name)) {
    try {
      return await executarFerramentaPc(bloco);
    } catch (erro) {
      return { type: "tool_result", tool_use_id: bloco.id, content: `Erro: ${erro.message}`, is_error: true };
    }
  }
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
function chamarClaude() {
  return postarApi("/api/chat", { messages: historico });
}

function mostrarUsoDaInternet(content) {
  for (const bloco of content) {
    if (bloco.type !== "server_tool_use") continue;
    if (bloco.name === "web_search") adicionarAcao(`Pesquisando na internet: ${bloco.input?.query ?? ""}`);
    if (bloco.name === "web_fetch") adicionarAcao(`Lendo página: ${bloco.input?.url ?? ""}`, bloco.input?.url);
  }
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
    for (let rodada = 0; rodada < 30; rodada++) {
      const { content, stop_reason } = await chamarClaude();
      // Devolve o conteúdo completo (inclusive blocos de raciocínio) no próximo turno.
      historico.push({ role: "assistant", content });
      mostrarUsoDaInternet(content);

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

      // Pesquisa na internet longa: o servidor da Anthropic pede para continuar.
      if (stop_reason === "pause_turn") continue;

      const pedidos = content.filter((b) => b.type === "tool_use");
      if (stop_reason !== "tool_use" || pedidos.length === 0) break;

      setStatus("Executando comando…");
      // Um de cada vez (cada um pode pedir aprovação); todos os resultados
      // vão juntos em uma única mensagem.
      const resultados = [];
      for (const pedido of pedidos) resultados.push(await executarFerramenta(pedido));
      historico.push({ role: "user", content: resultados });
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

// ---------- Configurações ----------
const dialogoConfig = document.getElementById("config");
const campoChave = document.getElementById("chave");
const statusChave = document.getElementById("config-status");
const botaoSalvarChave = document.getElementById("salvar-chave");

async function abrirConfiguracoes(cfg) {
  cfg = cfg || (await carregarConfig());
  if (!cfg) return;
  document.getElementById("config-chave").hidden = cfg.chaveDoAmbiente;
  document.getElementById("config-ambiente").hidden = !cfg.chaveDoAmbiente;
  botaoSalvarChave.hidden = cfg.chaveDoAmbiente;
  document.getElementById("config-pc").textContent = cfg.acessoPc ? "ligado (com aprovação)" : "desligado";
  statusChave.textContent = cfg.temChave ? "Chave configurada. Cole outra para trocar." : "Falta configurar a chave para o Dias responder.";
  campoChave.value = "";
  if (!dialogoConfig.open) dialogoConfig.showModal();
}

document.getElementById("abrir-config").addEventListener("click", () => abrirConfiguracoes());

document.getElementById("fechar-config").addEventListener("click", () => dialogoConfig.close());

// O botão Salvar é o "submit" do formulário, então Enter também salva.
document.getElementById("form-config").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  statusChave.textContent = "Testando a chave…";
  botaoSalvarChave.disabled = true;
  try {
    await postarApi("/api/chave", { chave: campoChave.value });
    statusChave.textContent = "Chave salva!";
    setTimeout(() => dialogoConfig.close(), 600);
    falar("Pronto! Agora é só tocar no microfone e falar comigo.");
  } catch (erro) {
    statusChave.textContent = erro.message;
  } finally {
    botaoSalvarChave.disabled = false;
  }
});

// ---------- Aplicativo instalável ----------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

const botaoInstalar = document.getElementById("instalar");
let pedidoInstalacao = null;

window.addEventListener("beforeinstallprompt", (evento) => {
  evento.preventDefault();
  pedidoInstalacao = evento;
  botaoInstalar.hidden = false;
});

botaoInstalar.addEventListener("click", async () => {
  if (!pedidoInstalacao) return;
  pedidoInstalacao.prompt();
  await pedidoInstalacao.userChoice;
  pedidoInstalacao = null;
  botaoInstalar.hidden = true;
});

window.addEventListener("appinstalled", () => {
  botaoInstalar.hidden = true;
});
