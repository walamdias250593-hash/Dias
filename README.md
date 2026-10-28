# Dias — assistente de IA por voz

Um assistente que conversa com você **por voz, em português**, e **obedece comandos**. Ele tem **acesso à internet** e ao **seu computador** (arquivos, programas, comandos e tudo que está conectado ao PC). Usa o Claude (da Anthropic) como cérebro e os recursos de voz do próprio navegador para ouvir e falar.

## O que ele faz

Fale naturalmente, por exemplo:

| Você diz | O que acontece |
|---|---|
| "Abre o Instagram" | Abre o site em uma nova aba |
| "Pesquisa receita de bolo de cenoura" | Abre a pesquisa no Google |
| "Toca Legião Urbana no YouTube" | Abre o YouTube com a busca |
| "Me avisa daqui a 5 minutos que o arroz está pronto" | Cria um timer que avisa falando |
| "Que dia é hoje?" / "Que horas são?" | Responde com a data e a hora |
| "Anota: comprar pão amanhã" | Salva uma nota |
| "Quais são minhas notas?" / "Apaga minhas notas" | Lê ou apaga as notas |
| "Fala mais devagar" / "Fala mais rápido" | Ajusta a velocidade e o tom da voz |
| "Coloca o tema escuro" | Muda o visual da tela |
| "Qual o resultado do jogo do Flamengo?" / "Como está o dólar hoje?" | Pesquisa na internet e resume |
| "Lê essa página e me resume: …" | Abre e lê a página |
| "O que tem na minha pasta Downloads?" | Lista a pasta |
| "Cria um arquivo lista.txt na área de trabalho com…" | Escreve o arquivo (pede aprovação) |
| "Abre o Spotify" / "Abre a planilha de gastos" | Abre o programa ou arquivo (pede aprovação) |
| "Quanto espaço livre tem no meu disco?" / "Aumenta o volume" | Executa um comando no PC (pede aprovação) |
| "O que está conectado no meu PC?" / "Meu fone Bluetooth está conectado?" | Lista USB, Bluetooth, pendrives, impressoras, monitores, som e rede |
| "Ejeta o pendrive" / "Imprime esse arquivo" | Controla o dispositivo por comando (pede aprovação) |

Além disso, ele conversa sobre qualquer assunto: tira dúvidas, dá ideias, explica coisas.

## Como instalar e usar

**Só na primeira vez:**

1. Instale o [Node.js](https://nodejs.org/pt) (versão LTS). É só avançar no instalador.
2. Baixe o Dias: na página do projeto no GitHub, clique em **Code → Download ZIP** e extraia a pasta.
3. Abra o atalho de acordo com o seu sistema:
   - **Windows:** `Iniciar Dias (Windows).bat`
   - **Mac:** `Iniciar Dias (Mac).command` (se o Mac bloquear, clique com o botão direito → Abrir)
   - **Linux:** `iniciar-dias.sh`

   Na primeira vez ele baixa o que precisa (leva um minuto). Depois o Dias abre em uma janela própria.
4. Na tela de configurações, cole sua **chave da API** (crie em [platform.claude.com](https://platform.claude.com/settings/keys)) e toque em **Salvar chave**. Ela fica guardada só no seu computador, em `~/.dias/config.json`.
5. Toque em **Instalar**, no canto da tela, para ganhar o ícone do Dias no menu Iniciar ou na área de trabalho, como um aplicativo.

**No dia a dia:** abra o atalho *Iniciar Dias* e fale. Se o Dias já estiver ligado, o atalho só traz a janela de volta.

**Ligar junto com o computador (Windows):** abra `Ligar com o Windows.bat` uma vez. Depois disso o Dias fica sempre pronto e é só abrir o app pelo menu Iniciar. Para desfazer, abra o arquivo de novo.

Com **Conversa contínua** marcada, ele volta a ouvir sozinho depois de responder, como em uma ligação. Para interromper a fala dele, toque no microfone. Também dá para digitar.

> Use o **Google Chrome** ou o **Microsoft Edge** (que já vem no Windows). O reconhecimento de voz não funciona no Firefox.

### Pelo terminal (para quem prefere)

```bash
npm install
npm start
```

## Acesso ao computador e segurança

O servidor roda no seu PC, então o Dias age **no computador onde você rodou `npm start`**.

- **Pede aprovação:** executar comandos, criar ou alterar arquivos e abrir programas. Aparece uma janela com o comando exato e uma explicação. Nada acontece até você tocar em **Permitir**.
- **Sem aprovação (só leitura):** ver pastas, ler arquivos e listar os dispositivos conectados.
- O servidor só aceita conexões do próprio computador (`127.0.0.1`) e recusa pedidos vindos de outros sites.
- Tudo que ele executa aparece na conversa e no terminal do servidor.
- O Dias trata o conteúdo de páginas e arquivos como informação, nunca como ordem. Mesmo assim, **leia o comando antes de aprovar**, principalmente depois de pedir para ele ler algo da internet.
- No Windows os comandos rodam no PowerShell; no Mac e no Linux, no terminal padrão. Eles rodam com as permissões do seu usuário (não como administrador).

Para desligar o acesso ao computador e deixar só a conversa e a internet:

```bash
DIAS_ACESSO_PC=0 npm start
```

## Como funciona

- `public/` é a página: reconhece sua voz (Web Speech API, `pt-BR`), mostra a conversa e lê as respostas em voz alta.
- `server.js` é um servidor Node pequeno que guarda a chave da API e repassa a conversa ao Claude, junto com a lista de comandos (ferramentas) que ele pode usar.
- `janela.js` abre o Dias em uma janela de aplicativo do Chrome ou do Edge.
- `public/manifest.webmanifest` e `public/sw.js` fazem o Dias poder ser instalado como aplicativo.
- `pc.js` contém as ferramentas que agem no computador (comandos, arquivos, dispositivos).
- A pesquisa e a leitura de páginas da internet são feitas pelos servidores da Anthropic (ferramentas `web_search` e `web_fetch`).
- Quando o Claude decide usar um comando, a página executa (no navegador ou, para o PC, pelo servidor, depois da sua aprovação) e devolve o resultado para ele.

As notas e as preferências ficam salvas só no seu navegador.

## Adicionar novos comandos

- **Comando do navegador:** adicione a ferramenta em `TOOLS` (`server.js`) e uma função com o mesmo nome em `ferramentas` (`public/app.js`).
- **Comando do PC:** adicione a ferramenta em `PC_TOOLS` e a função em `EXECUTORES` (`pc.js`). Se ela altera algo, coloque o nome em `PRECISA_CONFIRMAR`.

Pronto: o assistente passa a entender e executar o novo comando.

## Configuração opcional

| Variável | Padrão | Para quê |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `CLAUDE_MODEL` | `claude-opus-5-5` | Modelo do Claude usado |
| `DIAS_ACESSO_PC` | ligado | `0` desliga o acesso ao computador |
| `DIAS_ABRIR` | ligado | `0` não abre a janela ao iniciar |
| `ANTHROPIC_API_KEY` | — | Chave da API (no lugar da tela de configurações) |

## Observações

- O reconhecimento de voz funciona melhor no Chrome e no Edge. Firefox e alguns navegadores não têm esse recurso; nesse caso, use o campo de texto.
- O microfone só funciona em `localhost` ou em sites com `https`.
- Alguns navegadores bloqueiam abrir abas automaticamente. Se acontecer, aparece um link "abrir" na conversa.
- Cada mensagem usa a API da Anthropic, que é cobrada conforme o uso. Pesquisas na internet têm custo adicional por busca.
