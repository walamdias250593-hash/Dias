import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, "public");
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

// Lê ANTHROPIC_API_KEY (ou outra credencial configurada) do ambiente.
const client = new Anthropic();

const SYSTEM_PROMPT = `Você é Dias, um assistente pessoal de voz. Você conversa com o usuário em português do Brasil por voz.

Regras:
- Suas respostas serão lidas em voz alta. Responda de forma curta, natural e falada: normalmente uma a três frases.
- Nunca use markdown, listas, emojis, tabelas ou blocos de código. Escreva números e símbolos como seriam falados quando isso ajudar a leitura.
- Quando o usuário der um comando que uma ferramenta consegue executar (abrir site, pesquisar, tocar no YouTube, timer, notas, data e hora, ajustar voz, tema), use a ferramenta em vez de só descrever o que faria. Depois confirme em poucas palavras o que fez.
- Se nenhuma ferramenta consegue fazer o que foi pedido, diga isso com honestidade e ofereça a alternativa mais próxima.
- Se o pedido for ambíguo, faça uma pergunta curta antes de agir.`;

// Ferramentas executadas no navegador do usuário (veja public/app.js).
const TOOLS = [
  {
    name: "abrir_site",
    description: "Abre um site em uma nova aba do navegador do usuário.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Endereço completo, por exemplo https://www.google.com" },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "pesquisar_web",
    description: "Abre uma pesquisa no Google com os termos informados.",
    input_schema: {
      type: "object",
      properties: { consulta: { type: "string", description: "O que pesquisar." } },
      required: ["consulta"],
      additionalProperties: false,
    },
  },
  {
    name: "tocar_youtube",
    description: "Abre o YouTube com a busca de um vídeo ou música.",
    input_schema: {
      type: "object",
      properties: { consulta: { type: "string", description: "Vídeo, música ou artista." } },
      required: ["consulta"],
      additionalProperties: false,
    },
  },
  {
    name: "definir_timer",
    description: "Cria um timer que avisa por voz quando terminar.",
    input_schema: {
      type: "object",
      properties: {
        segundos: { type: "integer", description: "Duração total em segundos." },
        rotulo: { type: "string", description: "Nome curto do timer, por exemplo 'macarrão'." },
      },
      required: ["segundos", "rotulo"],
      additionalProperties: false,
    },
  },
  {
    name: "obter_data_hora",
    description: "Retorna a data, a hora e o fuso horário atuais do usuário.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "salvar_nota",
    description: "Salva uma nota ou lembrete na lista de notas do usuário.",
    input_schema: {
      type: "object",
      properties: { texto: { type: "string", description: "Conteúdo da nota." } },
      required: ["texto"],
      additionalProperties: false,
    },
  },
  {
    name: "listar_notas",
    description: "Lista todas as notas salvas pelo usuário.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "apagar_notas",
    description: "Apaga todas as notas salvas. Só use quando o usuário pedir claramente.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "ajustar_voz",
    description: "Ajusta a velocidade e o tom da voz do assistente.",
    input_schema: {
      type: "object",
      properties: {
        velocidade: { type: "number", description: "De 0.5 (lenta) a 2 (rápida). Normal é 1." },
        tom: { type: "number", description: "De 0.5 (grave) a 2 (aguda). Normal é 1." },
      },
      required: ["velocidade", "tom"],
      additionalProperties: false,
    },
  },
  {
    name: "mudar_tema",
    description: "Muda o tema visual da tela.",
    input_schema: {
      type: "object",
      properties: { tema: { type: "string", enum: ["claro", "escuro"] } },
      required: ["tema"],
      additionalProperties: false,
    },
  },
].map((tool) => ({ ...tool, strict: true }));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 2_000_000) throw new Error("Corpo da requisição grande demais");
  }
  return JSON.parse(raw);
}

async function handleChat(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { error: "JSON inválido" });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return sendJson(res, 400, { error: "Envie um array 'messages'." });
  }

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: body.messages,
      // Conversa por voz: respostas rápidas valem mais que raciocínio profundo.
      output_config: { effort: "low" },
      // Se o modelo recusar o pedido, a API tenta de novo no modelo recomendado.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    sendJson(res, 200, { content: response.content, stop_reason: response.stop_reason });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return sendJson(res, 500, { error: "Chave da API inválida ou ausente. Defina ANTHROPIC_API_KEY." });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return sendJson(res, 429, { error: "Muitas requisições. Tente de novo em instantes." });
    }
    if (err instanceof Anthropic.BadRequestError) {
      return sendJson(res, 400, { error: err.message });
    }
    if (err instanceof Anthropic.APIError) {
      return sendJson(res, 502, { error: `Erro da API: ${err.message}` });
    }
    console.error(err);
    sendJson(res, 500, { error: "Erro interno do servidor." });
  }
}

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const filePath = path.join(PUBLIC_DIR, urlPath === "/" ? "index.html" : urlPath);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404).end("Não encontrado");
  }
}

http
  .createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/chat") return handleChat(req, res);
    if (req.method === "GET") return serveStatic(req, res);
    res.writeHead(405).end();
  })
  .listen(PORT, () => {
    console.log(`Assistente Dias rodando em http://localhost:${PORT}`);
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      console.warn("Aviso: ANTHROPIC_API_KEY não está definida. O assistente não vai conseguir responder.");
    }
  });
