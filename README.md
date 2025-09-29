# Roleta dos Estados (HTML/CSS/JS)

## Como usar
Abra `index.html` no navegador.

## Editar perguntas
As perguntas ficam no arquivo `questions.json` com o seguinte formato por item:

```json
{
  "state": "São Paulo",
  "question": "Qual é a capital do estado de São Paulo?",
  "options": ["Campinas", "Santos", "São Paulo", "Sorocaba"],
  "answerIndex": 2
}
```

- **state**: Nome do estado exatamente como aparece na roleta.
- **question**: Enunciado.
- **options**: Quatro alternativas (ordem livre).
- **answerIndex**: Índice (0-3) da alternativa correta dentro de `options`.

Pode adicionar quantas perguntas quiser por estado. O app escolhe uma aleatória.

## Dicas
- Se abrir via `file://`, alguns navegadores bloqueiam `fetch` do JSON. Use um servidor local simples, por exemplo:

```bash
# Python 3
python3 -m http.server 5500
# depois acesse http://localhost:5500/
```

- A pontuação é salva em `localStorage`. Use o botão "Reiniciar" para zerar.
