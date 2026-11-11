<div align="center">

<img src="assets/atanor-logo.png" width="220" alt="ATANOR">

# ATANOR

Leitor e organizador de e-books. Execução local, sem conexão externa.

![Plataforma](https://img.shields.io/badge/plataforma-Android%20%7C%20iOS-1A1F26?labelColor=1A1F26&color=8B5CF6)
![Stack](https://img.shields.io/badge/stack-React%20Native%20%2B%20Expo-1A1F26?labelColor=1A1F26&color=8B5CF6)

</div>

## I. O Abismo

ATANOR importa arquivos EPUB, PDF e CBZ, converte PDF em EPUB com um conversor próprio (sem OCR) e organiza a biblioteca por status de leitura. Todo o processamento ocorre no aparelho. Não há revisão por IA e não há saída online.

Limite por arquivo: 100 MB. Arquivos protegidos por DRM ou senha não são suportados.

## II. Arquitetura do Núcleo

```text
App.js              interface: biblioteca, abas por status, tela de status, leitor
src/engine.js       motor em WebView: importação, conversor PDF→EPUB, leitor de texto e de imagens
src/engine.css      tema do leitor (Void Black, Moonlight; papel claro opcional)
src/theme.js        tokens CHAOS v1.2
scripts/build-engine.js   embute JSZip, pdf.js e o motor em src/engineHtml.js (offline)
assets/             logo, ícone, splash
```

## III. Rituais de Configuração

```bash
npm install          # o postinstall gera src/engineHtml.js
npx expo start       # Expo Go, ou: npx expo run:android | run:ios
```

## IV. Inscrições e Registros

- `1.0.0`: biblioteca com seis abas, importação em lote, conversão local de PDF, leitor de texto e de imagens, progresso persistido.
- Pendente: importação de pasta, coleções, backup, marcadores e busca no livro, MOBI, AZW3 e CBR.

## V. Selos Finais

Licença: a definir.

Vitor Araújo · [GitHub](https://github.com/jvitoraraujo) · [LinkedIn](https://www.linkedin.com/in/vitor-ara%C3%BAjo-55a98942b) · vitoraraujo02@gmail.com

*A massa informe onde os elementos repousam em eterno conflito.*

C H A O S
