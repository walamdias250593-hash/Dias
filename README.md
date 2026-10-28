# Dias — assistente de IA por voz

Um assistente que conversa com você **por voz, em português**, e **obedece comandos**. Ele usa o Claude (da Anthropic) como cérebro e os recursos de voz do próprio navegador para ouvir e falar.

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

Além disso, ele conversa sobre qualquer assunto: tira dúvidas, dá ideias, explica coisas.

## Como rodar

1. Instale o [Node.js](https://nodejs.org) 18 ou mais novo.
2. Crie uma chave de API em <https://platform.claude.com> (menu *API Keys*).
3. No terminal, dentro desta pasta:

   ```bash
   npm install
   export ANTHROPIC_API_KEY="sua-chave-aqui"   # no Windows (PowerShell): $env:ANTHROPIC_API_KEY="sua-chave-aqui"
   npm start
   ```

4. Abra <http://localhost:3000> no **Google Chrome** ou no **Microsoft Edge**.
5. Toque no microfone, permita o acesso e fale.

Com **Conversa contínua** marcada, ele volta a ouvir sozinho depois de responder, como em uma ligação. Para interromper a fala dele, toque no microfone. Também dá para digitar.

## Como funciona

- `public/` é a página: reconhece sua voz (Web Speech API, `pt-BR`), mostra a conversa e lê as respostas em voz alta.
- `server.js` é um servidor Node pequeno que guarda a chave da API e repassa a conversa ao Claude, junto com a lista de comandos (ferramentas) que ele pode usar.
- Quando o Claude decide usar um comando, a página executa no seu navegador (abrir site, timer, notas…) e devolve o resultado para ele confirmar.

As notas e as preferências ficam salvas só no seu navegador.

## Adicionar novos comandos

1. Em `server.js`, adicione uma ferramenta na lista `TOOLS` (nome, descrição e parâmetros).
2. Em `public/app.js`, adicione uma função com o mesmo nome no objeto `ferramentas`.

Pronto: o assistente passa a entender e executar o novo comando.

## Configuração opcional

| Variável | Padrão | Para quê |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `CLAUDE_MODEL` | `claude-opus-5-5` | Modelo do Claude usado |

## Observações

- O reconhecimento de voz funciona melhor no Chrome e no Edge. Firefox e alguns navegadores não têm esse recurso; nesse caso, use o campo de texto.
- O microfone só funciona em `localhost` ou em sites com `https`.
- Alguns navegadores bloqueiam abrir abas automaticamente. Se acontecer, aparece um link "abrir" na conversa.
- Cada mensagem usa a API da Anthropic, que é cobrada conforme o uso.
