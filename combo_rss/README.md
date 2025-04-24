# Combo_RSS

## PRIMEIRA INSTALAÇÃO:

## Executar os comandos abaixo:
### Instalar vcredist
```
wget https://aka.ms/vs/17/release/vc_redist.x64.exe -O vcredist.exe
```
### Instalar appserv
```
wget https://sinalbr.dl.sourceforge.net/project/appserv/AppServ%20Open%20Project/9.3.0/appserv-x64-9.3.0.exe?viasf=1 -O appserv.exe
```

### Instalar git através do PowerShell

```
winget install --id Git.Git -e --source winget
```

### Clonar repositório através do Git Bash

```
git clone https://github.com/gustavolnx/combo_rss
```

> Token para autenticar na janelinha do GitHub
```
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
```

## ATUALIZAÇAO ATRAVÉS DO BASH
### (Para primeiras versões sem o autoDeploy)

> Executar o fetch através do Git Bash
```
git fetch
```
> Executar o update através do Git Bash
```
git reset --hard origin/main
```
> Após isso abrir o Executar (Win+D) e abrir o local:
```
shell:startup
```
> Copiar o start.bat como atalho nesse diretório
