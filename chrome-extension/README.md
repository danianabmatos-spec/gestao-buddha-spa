# 🧘 Buddha Spa — Reembolso Auto (extensão Chrome)

Puxa **Vouchers, Omnichannel e Cortesias das 7 unidades** do WordPress para o ERP
(módulo **Reembolso**) — em **1 clique** ou automático todo mês. A extensão faz o
**login em cada unidade sozinha**, dentro do seu navegador (que passa pelo Cloudflare).

## 📦 Instalar (uma vez)

1. Abra `chrome://extensions/`
2. Ative **Modo do desenvolvedor** (canto superior direito)
3. **Carregar sem compactação** → selecione a pasta
   `C:\Users\MADISHAR\gestao-buddha-spa\chrome-extension`
4. Fixe o ícone 🧘 na barra do Chrome.

## ⚙️ Configurar (uma vez)

1. Clique no ícone 🧘 → abra **⚙️ Configurações**.
2. Confira a **URL do ERP** (padrão `https://gestao.solcentral.com.br`).
3. Digite a **senha de cada unidade** (o usuário já vem preenchido; ajuste se precisar).
4. **Salvar configurações**.

> 🔒 As senhas ficam **só no seu navegador** (chrome.storage). Nunca vão para o ERP,
> para arquivos do projeto, nem para lugar nenhum fora do seu Chrome.

## 🚀 Usar

- **Manual:** ícone 🧘 → escolha o mês → **▶ Sincronizar agora**. A extensão loga em
  cada unidade, puxa os dados e envia ao ERP. Acompanhe o progresso na janelinha.
- **Automático:** todo **dia 1º às 08:00** ela puxa o **mês anterior** sozinha e te
  notifica.

Depois é só abrir o ERP → **Reembolso Vouchers**, conferir, e digitar Compras/Treino.

## ℹ️ Observações

- Ao rodar, seu WordPress fica logado na **última unidade** da lista — é normal
  (a extensão troca de conta a cada unidade).
- Se o Cloudflare pedir verificação numa unidade, a extensão avisa `✖ [unidade]:
  Cloudflare pediu verificação`. Nesse caso, entre naquela unidade no WordPress,
  passe a verificação uma vez e rode de novo — ela costuma passar direto nas próximas.
- O ERP detecta a unidade pelo `unidadeId` enviado; não há risco de trocar os dados
  entre unidades.
