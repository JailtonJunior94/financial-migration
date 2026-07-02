@AGENTS.md

# Claude Code

Use `AGENTS.md` como base compartilhada deste repositorio.

## Regras adicionais

- Mantenha este arquivo curto; regras permanentes do projeto devem viver primeiro em `AGENTS.md`.
- Se uma instrucao passar a valer so para uma area do codigo, mova-a para `.claude/rules/` em vez de inflar este arquivo.
- Para tarefas de implementacao, carregue apenas o minimo necessario: `AGENTS.md`, `agent-governance` e a skill operacional relevante.
- Para tarefas em TypeScript/Bun, a skill padrao adicional e `.agents/skills/node-implementation/SKILL.md`.
- Para planejamento ou descoberta arquitetural, use as skills do harness apenas quando o pedido realmente exigir esse fluxo.

## Preferencias operacionais

- Antes de mudar varios arquivos, confirme o fluxo entre `domain`, `application` e `adapters`.
- Em caso de conflito entre conveniencia e fronteira arquitetural, preserve a fronteira arquitetural.
- Ao sugerir ou aplicar validacoes, prefira os comandos Bun reais do projeto, nao equivalentes em npm.
