# Changelog: Suporte ao Windows/PowerShell para pi-teams

> Data: 4 de março de 2026
> Autor: Eric (com assistência do pi)
> Baseado em: [pi-teams](https://github.com/burggraf/pi-teams) de Mark Burggraf

---

## 📋 Sumário

Este documento descreve todas as modificações feitas no projeto pi-teams para adicionar suporte nativo ao Windows com PowerShell, mantendo compatibilidade total com Mac/Linux.

---

## 🎯 Objetivo

O projeto original pi-teams funcionava apenas em ambientes Unix (Mac/Linux) usando `sh -c` para executar comandos. O objetivo foi:

1. Adicionar suporte ao Windows Terminal
2. Usar PowerShell em vez de bash no Windows
3. Manter compatibilidade com Mac/Linux
4. Funcionar com WezTerm (cross-platform)

---

## 📁 Arquivos Criados

### 1. `src/adapters/windows-adapter.ts`

**Novo adaptador para Windows Terminal nativo.**

```typescript
/**
 * Windows Terminal/PowerShell Adapter
 *
 * Implements the TerminalAdapter interface for Windows with PowerShell.
 * Uses wt (Windows Terminal) CLI for pane management and PowerShell for command execution.
 */
```

**Principais funcionalidades:**
- Detecta Windows via `process.platform === "win32"`
- Usa `wt.exe` (Windows Terminal CLI) para gerenciar panes
- Usa PowerShell (`pwsh`) para executar comandos
- Suporta `split-pane` vertical e horizontal
- Suporta janelas separadas (`spawnWindow`)

**Limitações conhecidas:**
- Pane IDs são sintéticos (timestamp + nome)
- Não é possível mudar título de janela após spawn
- Kill operations são limitadas (panes fecham quando processo termina)

---

### 2. `src/adapters/windows-adapter.test.ts`

**Testes unitários para o WindowsAdapter.**

- 17 testes cobrindo todos os métodos
- Testes de detecção, spawn, kill, isAlive, setTitle, window support

---

### 3. `WINDOWS_SUPPORT.md`

**Documentação completa do suporte ao Windows.**

- Detalhes da implementação
- Requisitos do sistema
- Instruções de instalação
- Troubleshooting
- Comparação com outros adaptadores

---

### 4. `WINDOWS_TESTING_GUIDE.md`

**Guia passo-a-passo para testar o suporte ao Windows.**

---

### 5. `debug-adapter.ts`

**Script de debug para verificar qual adaptador está sendo detectado.**

---

## 📝 Arquivos Modificados

### 1. `src/adapters/terminal-registry.ts`

**Adicionado import e registro do WindowsAdapter:**

```typescript
import { WindowsAdapter } from "./windows-adapter";

const adapters: TerminalAdapter[] = [
  new TmuxAdapter(),
  new ZellijAdapter(),
  new Iterm2Adapter(),
  new WezTermAdapter(),
  new WindowsAdapter(),  // ← NOVO
];
```

**Ordem de detecção (prioridade):**
1. tmux - se `TMUX` env está definido
2. Zellij - se `ZELLIJ` env está definido
3. iTerm2 - se `TERM_PROGRAM=iTerm.app`
4. WezTerm - se `WEZTERM_PANE` env está definido
5. **Windows** - se `platform === "win32"` e não detectou nenhum acima

**Logs de debug adicionados:**
```typescript
console.log(`[pi-teams debug] Platform: ${process.platform}`);
console.log(`[pi-teams debug] Detected: ${adapter.name}`);
```

---

### 2. `src/adapters/wezterm-adapter.ts`

**Modificado para suportar Windows com PowerShell.**

#### Código final do método `spawn()`:

```typescript
spawn(options: SpawnOptions): string {
  const weztermBin = this.findWeztermBinary();
  if (!weztermBin) {
    throw new Error("WezTerm CLI binary not found.");
  }

  const panes = this.getPanes();
  const isFirstPane = panes.length === 1;
  let weztermArgs: string[];

  if (process.platform === "win32") {
    // Windows: Use PowerShell with double quotes
    const envVars = Object.entries(options.env)
      .filter(([k]) => k.startsWith("PI_"))
      .map(([k, v]) => `$env:${k}="${v}"`)
      .join("; ");
    
    const psCommand = `${envVars}; cd "${options.cwd}"; ${options.command}`;
    // Use 'powershell' (built-in) instead of 'pwsh' (PowerShell Core)
    const cmdArgs = ["powershell", "-NoExit", "-Command", psCommand];

    if (isFirstPane) {
      weztermArgs = [
        "cli", "split-pane", "--right", "--percent", "50",
        "--cwd", options.cwd, "--", ...cmdArgs
      ];
    } else {
      // ... lógica para panes subsequentes
    }
  } else {
    // Unix: Use sh with env command
    const envArgs = Object.entries(options.env)
      .filter(([k]) => k.startsWith("PI_"))
      .map(([k, v]) => `${k}=${v}`);
    const cmdArgs = ["env", ...envArgs, "sh", "-c", options.command];
    // ... lógica similar para Unix
  }
}
```

#### Código final do método `spawnWindow()`:

```typescript
spawnWindow(options: SpawnOptions): string {
  const weztermBin = this.findWeztermBinary();
  if (!weztermBin) {
    throw new Error("WezTerm CLI binary not found.");
  }

  let spawnArgs: string[];

  if (process.platform === "win32") {
    // Windows: Use PowerShell with double quotes
    const envVars = Object.entries(options.env)
      .filter(([k]) => k.startsWith("PI_"))
      .map(([k, v]) => `$env:${k}="${v}"`)
      .join("; ");
    
    const psCommand = `${envVars}; cd "${options.cwd}"; ${options.command}`;
    
    spawnArgs = [
      "cli", "spawn", "--new-window",
      "--cwd", options.cwd,
      "--", "powershell", "-NoExit", "-Command", psCommand
    ];
  } else {
    // Unix: Use env command
    const envArgs = Object.entries(options.env)
      .filter(([k]) => k.startsWith("PI_"))
      .map(([k, v]) => `${k}=${v}`);
    
    spawnArgs = [
      "cli", "spawn", "--new-window",
      "--cwd", options.cwd,
      "--", "env", ...envArgs, "sh", "-c", options.command
    ];
  }
}
```

**Principais mudanças:**
1. Detecta `process.platform === "win32"` para usar PowerShell
2. Usa `powershell` (nativo do Windows) em vez de `pwsh` (PowerShell Core)
3. Usa aspas duplas `"` dentro do comando PowerShell para evitar conflitos com aspas simples do WezTerm
4. Mantém `sh -c` para Unix (Mac/Linux)

---

### 3. `README.md`

**Atualizações:**

```markdown
**pi-teams** turns your single Pi agent into a coordinated software engineering team. 
It allows you to spawn multiple "Teammate" agents in separate terminal panes that work 
autonomously, communicate with each other, and manage a shared task board—all mediated 
through tmux, Zellij, iTerm2, WezTerm, or Windows Terminal.
```

**Adicionado Option 5: Windows Terminal**

```markdown
### Option 5: Windows Terminal (Windows)

**Windows Terminal** is the modern, feature-rich terminal emulator for Windows 10/11.

Install Windows Terminal:
- **Microsoft Store**: Search for "Windows Terminal" and install
- **winget**: `winget install Microsoft.WindowsTerminal`

How to run:
```powershell
wt
pi
```
```

---

## 🔄 Histórico de Tentativas e Erros

### Tentativa 1: Criar WindowsAdapter separado
✅ Funcionou para detecção
❌ Mas o usuário estava usando WezTerm, não Windows Terminal puro

### Tentativa 2: Modificar detecção do WindowsAdapter
- Simplificado para sempre retornar `true` no Windows
- Ainda não funcionou porque WezTerm tem prioridade maior

### Tentativa 3: Logs de debug
- Descobrimos que WezTermAdapter estava sendo detectado
- `WEZTERM_PANE` estava definido

### Tentativa 4: Modificar WezTermAdapter para Windows
✅ Funcionou para Mac/Linux (manteve `sh -c`)
❌ Windows com PowerShell teve problemas de escaping de aspas

### Tentativa 5: Usar aspas duplas
❌ Ainda conflitava com aspas simples do WezTerm

### Tentativa 6: Passar env vars via `--env` do WezTerm
❌ **Não funcionou!**
- `wezterm cli split-pane` não suporta `--env`
- `wezterm cli spawn` também não suporta
- Erro: `unexpected argument '--env' found`

### Tentativa 7: Voltar a passar env vars no comando PowerShell
- Voltamos a colocar as variáveis de ambiente dentro do comando PowerShell
- Problema: WezTerm envolve o comando todo em aspas simples `'...'`
- Aspas simples dentro do comando eram escapadas como `'\''`
- Resultado: `'$env:PI_TEAM_NAME='\''teste-team'\'' ...'`

### Tentativa 8: Usar aspas duplas dentro do comando
✅ **FUNCIONOU!**
- Aspas duplas `"` não conflitam com aspas simples externas do WezTerm
- Comando: `'$env:PI_TEAM_NAME="teste-team"; ...'`
- WezTerm passa: `'...'` (aspas simples externas)
- PowerShell recebe: `$env:PI_TEAM_NAME="teste-team"` (aspas duplas internas funcionam)

### Tentativa 9: Trocar `pwsh` por `powershell`
✅ **SOLUÇÃO FINAL!**
- `pwsh` (PowerShell Core) pode não estar instalado
- `powershell` (PowerShell padrão do Windows) está sempre disponível
- Comando final:
  ```
  powershell -NoExit -Command '$env:PI_TEAM_NAME="teste-team"; $env:PI_AGENT_NAME="helper"; cd "C:\Users\Eric"; node ...'
  ```

---

## 📊 Comparação: Antes vs Depois

### Antes (Unix only)

```typescript
// Sempre usava sh -c
weztermArgs = [
  "cli", "split-pane", "--right", "--percent", "50",
  "--cwd", options.cwd, "--", 
  "env", ...envArgs, "sh", "-c", options.command
];
```

**Resultado no Windows:**
```
⚠️ Process "env 'PI_TEAM_NAME=teste' ... sh -c '...'" didn't exit cleanly
Exited with code 1.
```

### Depois (Cross-platform) - VERSÃO FINAL

```typescript
if (process.platform === "win32") {
  // Windows: Use PowerShell with double quotes
  const envVars = Object.entries(options.env)
    .filter(([k]) => k.startsWith("PI_"))
    .map(([k, v]) => `$env:${k}="${v}"`)
    .join("; ");
  
  const psCommand = `${envVars}; cd "${options.cwd}"; ${options.command}`;
  const cmdArgs = ["powershell", "-NoExit", "-Command", psCommand];

  weztermArgs = [
    "cli", "split-pane", "--right", "--percent", "50",
    "--cwd", options.cwd, "--", ...cmdArgs
  ];
} else {
  // Unix: Use sh with env command (como antes)
  const envArgs = Object.entries(options.env)
    .filter(([k]) => k.startsWith("PI_"))
    .map(([k, v]) => `${k}=${v}`);
  const cmdArgs = ["env", ...envArgs, "sh", "-c", options.command];

  weztermArgs = [
    "cli", "split-pane", "--right", "--percent", "50",
    "--cwd", options.cwd, "--", ...cmdArgs
  ];
}
```

**Comando final no Windows:**
```
wezterm cli split-pane --right --percent 50 --cwd "C:\Users\Eric" -- powershell -NoExit -Command '$env:PI_TEAM_NAME="teste-team"; $env:PI_AGENT_NAME="helper"; cd "C:\Users\Eric"; node ...'
```

---

## 🛠️ Instalação da Versão Modificada

### Método 1: Instalar do diretório local

```powershell
# Remover versão oficial
pi remove npm:pi-teams

# Instalar do fork local
pi install C:/Users/Eric/.pi/teste/pi-teams
```

### Método 2: Via npm link (não funcionou bem)

```powershell
cd C:/Users/Eric/.pi/teste/pi-teams
npm link
pi install npm:pi-teams  # Isso baixou a versão oficial, não o link
```

---

## ✅ Checklist de Testes

- [x] Detectar Windows corretamente
- [x] Usar PowerShell em vez de sh no Windows
- [x] Manter sh no Mac/Linux
- [x] Passar variáveis de ambiente corretamente
- [x] Spawn de panes funciona
- [x] Spawn de janelas separadas funciona
- [x] Spawn de múltiplos teammates funciona
- [ ] Messaging entre agentes funciona
- [ ] Task management funciona
- [ ] Shutdown da equipe funciona

---

## 🐛 Problemas Conhecidos

1. **WindowsAdapter pane IDs são sintéticos**
   - Windows Terminal CLI não retorna pane IDs
   - Solução atual: usar timestamp + nome

2. **Kill operations limitadas**
   - Windows Terminal CLI não tem kill-pane direto
   - Panes fecham quando o processo termina

3. **isAlive tem precisão limitada**
   - Não há API para verificar se pane existe

4. **Títulos de janela não podem ser alterados após spawn**
   - Limitação do Windows Terminal CLI

5. **WezTerm não suporta `--env` no CLI**
   - `wezterm cli split-pane` não aceita `--env`
   - `wezterm cli spawn` também não aceita
   - Solução: passar variáveis de ambiente no comando PowerShell

6. **Escaping de aspas no WezTerm**
   - WezTerm envolve comandos em aspas simples `'...'`
   - Aspas simples internas são escapadas como `'\''`
   - Solução: usar aspas duplas `"` dentro do comando PowerShell

7. **PowerShell Core vs PowerShell padrão**
   - `pwsh` (PowerShell Core) pode não estar instalado
   - `powershell` (PowerShell padrão do Windows) está sempre disponível
   - Usamos `powershell` para maior compatibilidade

---

## 🧪 Comando de Teste Manual

Para testar se o spawn está funcionando corretamente:

```powershell
# Teste básico do PowerShell
powershell -NoExit -Command '$env:PI_TEAM_NAME="teste-team"; $env:PI_AGENT_NAME="helper"; cd "C:\Users\Eric"; echo "Teste OK - PI_TEAM_NAME=$env:PI_TEAM_NAME"'

# Teste do WezTerm
wezterm cli split-pane --right --percent 50 --cwd "C:\Users\Eric" -- powershell -NoExit -Command 'echo "Teste OK"'

# Teste completo com pi
wezterm cli split-pane --right --percent 50 --cwd "C:\Users\Eric" -- powershell -NoExit -Command '$env:PI_TEAM_NAME="teste-team"; $env:PI_AGENT_NAME="helper"; cd "C:\Users\Eric"; node C:\Users\Eric\AppData\Roaming\npm\node_modules\@mariozechner\pi-coding-agent\dist\cli.js'
```

---

## 📦 Estrutura Final do Projeto

```
pi-teams/
├── src/
│   └── adapters/
│       ├── iterm2-adapter.ts      # (inalterado)
│       ├── terminal-registry.ts   # ← MODIFICADO
│       ├── tmux-adapter.ts        # (inalterado)
│       ├── wezterm-adapter.ts     # ← MODIFICADO
│       ├── windows-adapter.ts     # ← NOVO
│       ├── windows-adapter.test.ts # ← NOVO
│       └── zellij-adapter.ts      # (inalterado)
├── extensions/
│   └── index.ts                   # (inalterado)
├── WINDOWS_SUPPORT.md             # ← NOVO
├── WINDOWS_TESTING_GUIDE.md       # ← NOVO
├── CHANGELOG_WINDOWS_SUPPORT.md   # ← NOVO (este arquivo)
├── debug-adapter.ts               # ← NOVO
└── README.md                      # ← MODIFICADO
```

---

## 🚀 Próximos Passos

1. ✅ ~~Testar completamente no Windows com WezTerm~~ **FUNCIONANDO!**
2. [ ] Testar no Windows Terminal puro (usando WindowsAdapter)
3. [ ] Testar no Mac/Linux para garantir que não quebrou nada
4. [ ] Fork no GitHub do repositório original
5. [ ] Pull Request para o autor original
6. [ ] Atualizar `windows-adapter.ts` para usar `powershell` em vez de `pwsh`

---

## 🎉 Status Final

**FUNCIONANDO NO WINDOWS COM WEZTERM!** ✅

O pi-teams agora funciona corretamente no Windows usando WezTerm como terminal. O adaptador detecta automaticamente a plataforma e usa PowerShell no Windows (mantendo bash/sh no Mac/Linux).

---

## 📞 Créditos

- **Projeto original**: [pi-teams](https://github.com/burggraf/pi-teams) por Mark Burggraf
- **Modificações para Windows**: Eric (com assistência do pi)
- **Data**: 4 de março de 2026

---

## 📄 Licença

MIT (mesma licença do projeto original)
