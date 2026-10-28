// Abre o Dias em uma janela própria, sem barra de endereço (modo aplicativo do
// Chrome ou do Edge). Sem nenhum dos dois, usa o navegador padrão.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function candidatos() {
  if (process.platform === "win32") {
    const pastas = [process.env["PROGRAMFILES"], process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
    return pastas.flatMap((p) => [
      path.join(p, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(p, "Microsoft", "Edge", "Application", "msedge.exe"),
    ]);
  }
  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
  }
  return ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge"];
}

function iniciar(programa, args) {
  const filho = spawn(programa, args, { detached: true, stdio: "ignore", windowsHide: true });
  filho.on("error", () => {});
  filho.unref();
}

export function abrirJanela(url) {
  const navegador = candidatos().find((c) => existsSync(c));
  if (navegador) {
    iniciar(navegador, [`--app=${url}`, "--window-size=480,820"]);
  } else if (process.platform === "win32") {
    iniciar("cmd.exe", ["/c", "start", "", url]);
  } else {
    iniciar(process.platform === "darwin" ? "open" : "xdg-open", [url]);
  }
}
