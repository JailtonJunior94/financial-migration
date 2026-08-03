# Backup SQL Server

Fluxo operacional reutilizável para backup completo dos bancos configurados em `.env`.

## Escopo

- Executa `BACKUP DATABASE ... WITH COPY_ONLY, CHECKSUM` em cada instância remota.
- Executa `RESTORE VERIFYONLY` do arquivo físico no host remoto.
- Exporta backup lógico local com:
  - `logical/schema-pre-data.sql`
  - `logical/schema-post-data.sql`
  - `logical/schema.sql`
  - `logical/data/*.sql`
  - `logical/restore-logical.sql`
  - `logical/restore-portable.sql`
  - `logical/manifest.json`
- Gera `summary.json` por banco e `manifest.json` no diretório raiz da execução.

## Uso

```bash
bun run backup:sqlserver
```

Para definir um diretório específico:

```bash
BACKUP_OUTPUT_DIR=./backups/manual bun run backup:sqlserver
```

## Saída

Por padrão os artefatos ficam em:

```bash
./backups/<timestamp>/
```

Cada banco recebe uma pasta própria com:

- `physical-backup.json`: caminho remoto do `.bak` e status da verificação
- `logical/`: restore lógico autossuficiente
- `README.md`: resumo de restore

## Restore lógico

Use `sqlcmd` apontando para uma instância SQL Server vazia:

```bash
sqlcmd -S <host>,<porta> -d <database> -U <user> -P <password> -i logical/restore-logical.sql
```

## Restore em DBeaver ou cliente SQL genérico

Execute o arquivo único abaixo em um banco vazio:

```bash
logical/restore-portable.sql
```

Esse script concatena schema, dados e constraints finais sem depender dos comandos `:r` do `sqlcmd`.

## Limitação conhecida

O backup físico `.bak` é criado e verificado no filesystem do servidor remoto quando o provedor permite. Este fluxo não consegue materializar um `.bak` local quando a hospedagem bloqueia escrita ou leitura do device de backup; nessa situação a cópia portátil principal fica coberta pelo backup lógico exportado localmente.
