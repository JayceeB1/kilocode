# Comment tester / vérifier - KiloCode Local Supervisor

Ce guide fournit des commandes copier-coller pour tester et vérifier le Local Supervisor de KiloCode.

## Prérequis

- Node.js 20+ installé
- pnpm configuré (`corepack enable`)
- Ollama installé et modèle téléchargé
- VS Code avec extension KiloCode installée

## Linux/macOS

### 1. Configuration initiale

```bash
# Activer corepack pour pnpm
corepack enable

# Installer les dépendances
pnpm install

# Construire les packages
pnpm build
```

### 2. Démarrer le service Supervisor

```bash
# Démarrer le service en mode développement
pnpm supervisor:dev

# Dans un autre terminal, vérifier le service
curl http://127.0.0.1:43110/health
```

### 3. Tester l'extension

```bash
# Construire l'extension principale
pnpm vsix

# Installer l'extension localement
code --install-extension bin/kilo-code-*.vsix
```

### 4. Exécuter les tests

```bash
# Tests du service supervisor
cd packages/supervisor-service && npx vitest run

# Tests du sidecar
cd packages/supervisor-sidecar && npx vitest run

# Tous les tests
pnpm test
```

### 5. Vérification manuelle

```bash
# Vérifier que le service répond
curl -X POST http://127.0.0.1:43110/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"code":"console.log(\"test\");","language":"javascript"}'

# Vérifier la configuration
cat .kilocode/supervisor.config.json
```

## Windows (PowerShell)

### 1. Configuration initiale

```powershell
# Activer corepack pour pnpm
corepack enable

# Installer les dépendances
pnpm install

# Construire les packages
pnpm build
```

### 2. Démarrer le service Supervisor

```powershell
# Démarrer le service en mode développement
pnpm supervisor:dev

# Dans un autre terminal, vérifier le service
Invoke-RestMethod -Uri http://127.0.0.1:43110/health -Method GET
```

### 3. Tester l'extension

```powershell
# Construire l'extension principale
pnpm vsix

# Installer l'extension localement
code --install-extension bin/kilo-code-*.vsix
```

### 4. Exécuter les tests

```powershell
# Tests du service supervisor
cd packages/supervisor-service; npx vitest run

# Tests du sidecar
cd packages/supervisor-sidecar; npx vitest run

# Tous les tests
pnpm test
```

### 5. Vérification manuelle

```powershell
# Vérifier que le service répond
$body = @{
    code = "console.log('test');"
    language = "javascript"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://127.0.0.1:43110/v1/analyze `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

# Vérifier la configuration
Get-Content .kilocode/supervisor.config.json
```

## Dépannage

### Service ne démarre pas

```bash
# Vérifier le port
netstat -tlnp | grep 43110  # Linux/macOS
Get-NetTCPConnection -LocalPort 43110  # Windows

# Vérifier les logs
pnpm supervisor:dev 2>&1 | tee supervisor.log
```

### Extension ne se connecte pas

```bash
# Vérifier la configuration VS Code
# Settings > KiloCode Supervisor > Service URL doit être http://127.0.0.1:43110

# Tester la connexion manuellement
curl http://127.0.0.1:43110/health
```

### Tests échouent

```bash
# Nettoyer et réinstaller
pnpm clean
pnpm install
pnpm build

# Vérifier les versions
node --version  # Doit être 20+
pnpm --version  # Doit être 10.8.1+
```

## Vérification finale

Après avoir exécuté ces commandes, vérifiez que :

1. ✅ Le service Supervisor démarre sur `http://127.0.0.1:43110`
2. ✅ L'endpoint `/health` retourne `{"status":"healthy"}`
3. ✅ L'extension KiloCode apparaît dans VS Code
4. ✅ Les commandes de test passent sans erreur
5. ✅ La capture de terminal fonctionne

Si tous ces points sont vérifiés, le Local Supervisor est prêt à l'emploi !
