// Ferramentas que agem no computador onde o servidor está rodando.
// Ações que alteram algo (executar, escrever, abrir) só chegam aqui depois
// de o usuário confirmar na tela (veja PRECISA_CONFIRMAR e public/app.js).
import { exec, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const LIMITE_SAIDA = 20_000; // caracteres devolvidos ao Claude
const LIMITE_LEITURA = 500_000; // bytes lidos de um arquivo
const TEMPO_COMANDO = 120_000; // ms

const NO_WINDOWS = process.platform === "win32";
const SHELL = NO_WINDOWS ? "powershell.exe" : process.env.SHELL || "/bin/sh";

export const PRECISA_CONFIRMAR = new Set(["executar_comando", "escrever_arquivo", "abrir_no_pc"]);

export function descreverPc() {
  return [
    `Sistema: ${os.type()} ${os.release()} (${process.platform}, ${os.arch()})`,
    `Usuário: ${os.userInfo().username}`,
    `Pasta pessoal: ${os.homedir()}`,
    `Shell dos comandos: ${SHELL}`,
  ].join("\n");
}

export const PC_TOOLS = [
  {
    name: "executar_comando",
    description: `Executa um comando no terminal do computador do usuário (${SHELL}) e devolve a saída. Use para tarefas no PC: instalar ou abrir programas, mexer em arquivos e pastas, ver informações do sistema, controlar volume, desligar e assim por diante. O usuário vê o comando e precisa aprovar antes de rodar. Prefira comandos que terminam sozinhos; o limite é de ${TEMPO_COMANDO / 1000} segundos.`,
    input_schema: {
      type: "object",
      properties: {
        comando: { type: "string", description: "O comando exato a executar." },
        motivo: { type: "string", description: "Explicação curta, em português simples, do que o comando faz. É mostrada ao usuário na confirmação." },
      },
      required: ["comando", "motivo"],
      additionalProperties: false,
    },
  },
  {
    name: "dispositivos_conectados",
    description: "Mostra tudo que está conectado ao computador: dispositivos USB, Bluetooth, discos e pendrives, impressoras, monitores, áudio, câmeras, placas de rede e aparelhos encontrados na mesma rede. Só lê informações, não altera nada. Use antes de controlar um dispositivo com executar_comando.",
    input_schema: {
      type: "object",
      properties: {
        categoria: {
          type: "string",
          enum: ["todos", "usb", "bluetooth", "discos", "impressoras", "monitores", "audio", "rede"],
          description: "Que tipo de dispositivo listar.",
        },
      },
      required: ["categoria"],
      additionalProperties: false,
    },
  },
  {
    name: "listar_pasta",
    description: "Lista arquivos e subpastas de uma pasta do computador, com tamanho e data de modificação.",
    input_schema: {
      type: "object",
      properties: { caminho: { type: "string", description: "Caminho da pasta. Use ~ para a pasta pessoal." } },
      required: ["caminho"],
      additionalProperties: false,
    },
  },
  {
    name: "ler_arquivo",
    description: `Lê o conteúdo de um arquivo de texto do computador (até ${LIMITE_LEITURA / 1000} KB).`,
    input_schema: {
      type: "object",
      properties: { caminho: { type: "string", description: "Caminho do arquivo. Use ~ para a pasta pessoal." } },
      required: ["caminho"],
      additionalProperties: false,
    },
  },
  {
    name: "escrever_arquivo",
    description: "Cria ou substitui um arquivo de texto no computador. O usuário precisa aprovar antes.",
    input_schema: {
      type: "object",
      properties: {
        caminho: { type: "string", description: "Caminho do arquivo. Use ~ para a pasta pessoal." },
        conteudo: { type: "string", description: "Conteúdo completo do arquivo." },
      },
      required: ["caminho", "conteudo"],
      additionalProperties: false,
    },
  },
  {
    name: "abrir_no_pc",
    description: "Abre um arquivo, uma pasta ou um programa no computador com o aplicativo padrão (como dar dois cliques). O usuário precisa aprovar antes.",
    input_schema: {
      type: "object",
      properties: { alvo: { type: "string", description: "Caminho do arquivo, pasta ou programa." } },
      required: ["alvo"],
      additionalProperties: false,
    },
  },
];

function resolverCaminho(caminho) {
  if (caminho === "~" || caminho.startsWith("~/") || caminho.startsWith("~\\")) {
    caminho = path.join(os.homedir(), caminho.slice(1));
  }
  return path.resolve(os.homedir(), caminho);
}

function cortar(texto) {
  return texto.length > LIMITE_SAIDA
    ? `${texto.slice(0, LIMITE_SAIDA)}\n[... saída cortada, ${texto.length - LIMITE_SAIDA} caracteres omitidos]`
    : texto;
}

function executarComando({ comando }) {
  return new Promise((resolve) => {
    exec(
      comando,
      { shell: SHELL, cwd: os.homedir(), timeout: TEMPO_COMANDO, maxBuffer: 10 * 1024 * 1024, windowsHide: true },
      (erro, stdout, stderr) => {
        const partes = [];
        if (stdout) partes.push(`Saída:\n${stdout}`);
        if (stderr) partes.push(`Erros:\n${stderr}`);
        if (erro?.killed) partes.push(`O comando foi interrompido após ${TEMPO_COMANDO / 1000} segundos.`);
        partes.push(`Código de saída: ${erro ? (erro.code ?? "desconhecido") : 0}`);
        resolve({ ok: !erro, texto: cortar(partes.join("\n\n")) });
      }
    );
  });
}

const PS_PNP = (classes) =>
  `Get-PnpDevice -PresentOnly | Where-Object { $_.Class -in @(${classes.map((c) => `'${c}'`).join(",")}) } | Sort-Object Class | Format-Table Class, FriendlyName, Status -AutoSize | Out-String -Width 200`;

// Comandos só de leitura para cada sistema operacional.
const COMANDOS_DISPOSITIVOS = {
  win32: {
    usb: [PS_PNP(["USB", "HIDClass", "Keyboard", "Mouse", "WPD", "Image", "Camera"])],
    bluetooth: [PS_PNP(["Bluetooth"])],
    discos: ["Get-Volume | Format-Table DriveLetter, FileSystemLabel, DriveType, SizeRemaining, Size -AutoSize | Out-String -Width 200"],
    impressoras: ["Get-Printer | Format-Table Name, PrinterStatus, PortName -AutoSize | Out-String -Width 200"],
    monitores: [PS_PNP(["Monitor"])],
    audio: [PS_PNP(["AudioEndpoint", "MEDIA"])],
    rede: [
      "Get-NetAdapter | Format-Table Name, InterfaceDescription, Status, LinkSpeed -AutoSize | Out-String -Width 200",
      "Get-NetNeighbor -AddressFamily IPv4 -State Reachable,Stale -ErrorAction SilentlyContinue | Format-Table IPAddress, LinkLayerAddress, State -AutoSize | Out-String -Width 200",
    ],
  },
  darwin: {
    usb: ["system_profiler SPUSBDataType -detailLevel mini"],
    bluetooth: ["system_profiler SPBluetoothDataType -detailLevel mini"],
    discos: ["df -h", "diskutil list external"],
    impressoras: ["lpstat -p -d"],
    monitores: ["system_profiler SPDisplaysDataType -detailLevel mini"],
    audio: ["system_profiler SPAudioDataType -detailLevel mini"],
    rede: ["networksetup -listallhardwareports", "arp -a"],
  },
  linux: {
    usb: ["lsusb"],
    bluetooth: ["bluetoothctl devices Connected || bluetoothctl devices"],
    discos: ["lsblk -o NAME,SIZE,TYPE,MOUNTPOINT,LABEL,MODEL"],
    impressoras: ["lpstat -p -d"],
    monitores: ["xrandr --listmonitors"],
    audio: ["pactl list short sinks; pactl list short sources"],
    rede: ["ip -br addr", "ip neigh"],
  },
};

async function dispositivosConectados({ categoria }) {
  const comandos = COMANDOS_DISPOSITIVOS[process.platform] || COMANDOS_DISPOSITIVOS.linux;
  const categorias = categoria === "todos" || !comandos[categoria] ? Object.keys(comandos) : [categoria];
  const blocos = [];
  for (const cat of categorias) {
    for (const comando of comandos[cat]) {
      const { texto } = await executarComando({ comando });
      blocos.push(`=== ${cat} ===\n${texto}`);
    }
  }
  return { ok: true, texto: cortar(blocos.join("\n\n")) };
}

async function listarPasta({ caminho }) {
  const pasta = resolverCaminho(caminho);
  const itens = await fs.readdir(pasta, { withFileTypes: true });
  const linhas = await Promise.all(
    itens.map(async (item) => {
      try {
        const info = await fs.stat(path.join(pasta, item.name));
        const tipo = item.isDirectory() ? "[pasta]" : `${info.size} bytes`;
        return `${item.name}  ${tipo}  ${info.mtime.toLocaleString("pt-BR")}`;
      } catch {
        return `${item.name}  [sem acesso]`;
      }
    })
  );
  return { ok: true, texto: cortar(`${pasta} (${itens.length} itens)\n${linhas.join("\n")}`) };
}

async function lerArquivo({ caminho }) {
  const arquivo = resolverCaminho(caminho);
  const handle = await fs.open(arquivo, "r");
  try {
    const { size } = await handle.stat();
    const buffer = Buffer.alloc(Math.min(size, LIMITE_LEITURA));
    await handle.read(buffer, 0, buffer.length, 0);
    const aviso = size > LIMITE_LEITURA ? `\n[... arquivo cortado: ${size} bytes no total]` : "";
    return { ok: true, texto: cortar(buffer.toString("utf8") + aviso) };
  } finally {
    await handle.close();
  }
}

async function escreverArquivo({ caminho, conteudo }) {
  const arquivo = resolverCaminho(caminho);
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  await fs.writeFile(arquivo, conteudo, "utf8");
  return { ok: true, texto: `Arquivo salvo: ${arquivo} (${Buffer.byteLength(conteudo)} bytes)` };
}

function abrirNoPc({ alvo }) {
  const caminho = /^[a-z]+:\/\//i.test(alvo) ? alvo : resolverCaminho(alvo);
  const [programa, args] =
    process.platform === "win32"
      ? ["cmd.exe", ["/c", "start", "", caminho]]
      : process.platform === "darwin"
        ? ["open", [caminho]]
        : ["xdg-open", [caminho]];
  return new Promise((resolve) => {
    const filho = spawn(programa, args, { detached: true, stdio: "ignore", windowsHide: true });
    filho.on("error", (erro) => resolve({ ok: false, texto: `Não consegui abrir: ${erro.message}` }));
    filho.on("spawn", () => {
      filho.unref();
      resolve({ ok: true, texto: `Aberto: ${caminho}` });
    });
  });
}

const EXECUTORES = {
  executar_comando: executarComando,
  dispositivos_conectados: dispositivosConectados,
  listar_pasta: listarPasta,
  ler_arquivo: lerArquivo,
  escrever_arquivo: escreverArquivo,
  abrir_no_pc: abrirNoPc,
};

export async function executarFerramentaPc(nome, input) {
  const executor = EXECUTORES[nome];
  if (!executor) return { ok: false, texto: `Ferramenta desconhecida: ${nome}` };
  try {
    return await executor(input ?? {});
  } catch (erro) {
    return { ok: false, texto: `Erro: ${erro.message}` };
  }
}
