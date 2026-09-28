# Pesquisa: breakeven para publicação do Jogo da Música

> Registro histórico preservado em 28/09/2026. Preços, câmbio, limites e políticas abaixo não foram revalidados nesta consolidação. Revalidar nas fontes antes de uma decisão de contratação ou monetização; esta pesquisa não autoriza despesas ou mudanças comerciais. Consulte o [índice dos planos](./planos.md).

Pesquisa realizada em 10 de agosto de 2026. Todos os preços e limites abaixo vieram de fontes oficiais. Valores em reais derivados de preços em dólar são apenas uma referência de planejamento, não uma cotação de cobrança.

## Resumo executivo

- O beta pode operar com custo de plataforma de **R$ 0**, usando Vercel Hobby, Supabase Free, Cloudflare Free e o subdomínio da Vercel. A Vercel Hobby é restrita a uso pessoal e não comercial; portanto, esse cenário deixa de ser apropriado quando começarem cobranças, patrocínios ou outra exploração comercial.
- Para o pós-beta com banco gerenciado, um orçamento prudente é de **R$ 320/mês** para DigitalOcean + Supabase Pro + domínio, incluindo backup semanal do VPS e margem de 15% sobre conversão/impostos. Uma alternativa econômica na Europa fica perto de **R$ 195/mês** com Hetzner + Supabase Pro, mas adiciona latência e exposição cambial/tributária.
- Um VPS all-in-one pode custar nominalmente **R$ 81,32/mês** com Hostinger (renovação) + domínio; para planejamento, arredondar para **R$ 120/mês**. É o menor custo, mas concentra app, autenticação e banco numa máquina e transfere integralmente para a equipe backups, restauração, segurança, atualizações e disponibilidade.
- Com custo fixo de R$ 320, o ponto de equilíbrio puramente operacional seria, por exemplo, **23 assinaturas de R$ 14,90/mês** no cartão via Stripe, **18 passes de R$ 19,90**, ou **2 patrocínios de R$ 299**. Isso é antes de tributos sobre receita, atendimento, marketing e remuneração do trabalho.
- Receita publicitária não deve ser tratada como previsão sem dados reais de inventário e RPM. A fórmula e cenários hipotéticos estão abaixo.

## Premissas de câmbio e arredondamento

Para tornar comparáveis os preços em dólar, os exemplos usam **US$ 1 = R$ 5,10**. A referência oficial mais recente encontrada durante a pesquisa foi a PTAX de venda de R$ 5,1005 em 27/07/2026. A cobrança real pode incluir spread do cartão, IOF e impostos indiretos conforme o endereço de faturamento. Por isso, os orçamentos recomendados usam margem, e não apenas a conversão seca.

Fonte: [Banco Central do Brasil — última cotação do dólar](https://ptax.bcb.gov.br/ptax_internet/consultarUltimaCotacaoDolar.do).

## Custos oficiais

### Vercel

- **Hobby: US$ 0/mês.** Somente para uso pessoal e não comercial. Inclui 4 CPU-h, 360 GB-h de memória provisionada, 1 milhão de invocações e 100 GB de Fast Data Transfer. Em geral, ao atingir limites do Hobby, o serviço correspondente é pausado até a renovação do ciclo.
- **Pro: US$ 20/mês**, com US$ 20 de crédito de uso. Consumo excedente é pay-as-you-go e assentos pagos adicionais custam US$ 20/mês cada.

Fontes: [Vercel Pricing](https://vercel.com/pricing), [Hobby plan](https://vercel.com/docs/plans/hobby), [planos](https://vercel.com/docs/plans) e [cobrança por uso](https://vercel.com/docs/pricing).

### Supabase

- **Free: US$ 0.** Dois projetos ativos, 50 mil usuários ativos mensais, banco de 500 MB, CPU compartilhada com 500 MB de RAM, 5 GB de egress + 5 GB cached e 1 GB de storage. Projetos gratuitos podem ser pausados após uma semana de baixa atividade.
- **Pro: a partir de US$ 25/mês.** O primeiro projeto fica coberto pelo plano e o preço inclui US$ 10 de crédito de compute, suficientes para uma instância Micro de 2 núcleos ARM/1 GB. Inclui 100 mil MAU, banco de 8 GB, 250 GB de egress, 250 GB cached, 100 GB de storage e backups diários por 7 dias. Excedentes relevantes: US$ 0,00325 por MAU, US$ 0,125/GB de banco, US$ 0,09/GB de egress, US$ 0,03/GB cached e US$ 0,0213/GB de storage.
- A cobrança é em USD. Desde junho de 2026, impostos indiretos aplicáveis são calculados a partir do endereço de faturamento; o valor final brasileiro deve ser conferido na fatura.

Fontes: [Supabase Pricing](https://supabase.com/pricing) e [Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq).

### VPS

| Provedor/plano         |                                              Recursos |                                        Preço oficial | Observações                                                                                                            |
| ---------------------- | ----------------------------------------------------: | ---------------------------------------------------: | ---------------------------------------------------------------------------------------------------------------------- |
| DigitalOcean Basic     |         2 vCPU, 4 GiB, SSD 80 GiB, transferência 4 TB |                                           US$ 24/mês | Backup semanal adiciona 20% (US$ 4,80); diário, 30%. Droplet desligado continua sendo cobrado até ser destruído.       |
| Hetzner CX23           | 2 vCPU compartilhadas, 4 GB, SSD 40 GB, tráfego 20 TB | US$ 6,49 + cerca de US$ 0,60 por IPv4 = US$ 7,09/mês | Preço após reajuste de 15/06/2026, antes de VAT/impostos. Regiões europeias, sem região no Brasil.                     |
| Hostinger Brasil KVM 2 |               2 vCPU, 8 GB, NVMe 100 GB, tráfego 8 TB |                            R$ 77,99/mês na renovação | A oferta de R$ 42,99/mês é promocional e exige compromisso; não deve ser usada como run-rate. Backup semanal incluído. |

Fontes: [DigitalOcean Droplets](https://www.digitalocean.com/pricing/droplets), [detalhes de cobrança DigitalOcean](https://docs.digitalocean.com/products/droplets/details/pricing/), [reajuste Hetzner de 2026](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/), [Hetzner cost-optimized](https://www.hetzner.com/cloud/cost-optimized), [VAT da Hetzner](https://docs.hetzner.com/general/billing-and-account-management/billing-at-hetzner/value-added-tax/) e [Hostinger VPS Brasil](https://www.hostinger.com/br/servidor-vps).

### Domínio e Cloudflare

- Um domínio `.com.br` no Registro.br custa **R$ 40 por um ano**, equivalente a R$ 3,33/mês. Planos plurianuais têm desconto.
- O plano Cloudflare Free custa **US$ 0** e inclui DNS, CDN, SSL universal, mitigação DDoS não medida e ruleset gerenciado gratuito. Não oferece SLA nem créditos de indisponibilidade. Registro do domínio não está incluído.

Fontes: [Registro.br — processo e valores de manutenção](https://registro.br/dominio/processo-de-liberacao/) e [Cloudflare Plans](https://www.cloudflare.com/plans/).

### YouTube Data API

A API não gera custo financeiro por chamada neste modelo; o controle é por cota:

- 100 chamadas `search.list` por dia, em bucket próprio;
- 100 chamadas `videos.insert` por dia, em bucket próprio;
- 10 mil unidades diárias combinadas para os demais endpoints;
- `videos.list`, `playlists.list` e `playlistItems.list` custam 1 unidade por chamada/página;
- toda chamada, inclusive inválida, consome ao menos um ponto; as cotas reiniciam à meia-noite no horário do Pacífico.

Ao acabar a cota, é possível pedir extensão, mas não há um preço público por unidade que possa ser incluído como custo variável. O uso atual do jogo — reprodução pelo IFrame Player e consultas administrativas — não sugere custo monetário de API; o risco é indisponibilidade temporária de busca/importação ao atingir a cota.

Fontes: [calculadora oficial de cota](https://developers.google.com/youtube/v3/determine_quota_cost) e [referência de `search.list`](https://developers.google.com/youtube/v3/docs/search/list).

### Processamento de pagamentos no Brasil

Não há mensalidade obrigatória nos preços padrão abaixo; o custo acompanha cada transação.

| Provedor/meio           |            Tarifa oficial usada no modelo | Outras condições relevantes                                         |
| ----------------------- | ----------------------------------------: | ------------------------------------------------------------------- |
| Stripe, cartão nacional |    3,99% + R$ 0,39 por transação aprovada | Cartão internacional adiciona 2%; contestação recebida custa R$ 55. |
| Stripe, Pix             |                        1,19% por Pix pago | Disponível somente por convite na página consultada.                |
| Mercado Pago, Pix       |                0,99%, recebimento na hora | Taxas podem variar por modalidade/conta.                            |
| Mercado Pago, cartão    | 4,99% na hora/14 dias ou 3,99% em 30 dias | Parcelamento sem acréscimo soma tarifa adicional.                   |
| Mercado Pago, boleto    |                   R$ 3,49 por boleto pago | Recebimento em 3 dias.                                              |

Fontes: [Stripe Brasil — preços](https://stripe.com/br/pricing), [Mercado Pago — tarifas para vender online](https://www.mercadopago.com.br/blog/quanto-custa-vender-on-line-com-mercado-pago) e [Mercado Pago Developers — Checkout Pro](https://www.mercadopago.com.br/developers/pt/docs/loja-integrada/payment-methods/configure-checkout).

## Cenários de custo fixo mensal

### 1. Beta gratuito

| Item                    | Custo mensal |
| ----------------------- | -----------: |
| Vercel Hobby            |         R$ 0 |
| Supabase Free           |         R$ 0 |
| Cloudflare Free         |         R$ 0 |
| Subdomínio `vercel.app` |         R$ 0 |
| **Total**               |     **R$ 0** |

Com `.com.br`, o custo econômico passa a R$ 3,33/mês, pago como R$ 40 anuais. Este cenário vale apenas para beta pessoal/não comercial e aceita pausa/limites dos serviços gratuitos.

### 2. VPS para o app + Supabase Pro gerenciado

**Opção econômica na Europa**

- Hetzner CX23 + IPv4: US$ 7,09
- Supabase Pro: US$ 25
- Conversão seca a R$ 5,10: R$ 163,66
- Domínio: R$ 3,33
- Total nominal: **R$ 166,99/mês**
- Orçamento sugerido com ~15% de margem cambial/tributária: **R$ 195/mês**

**Opção conservadora com DigitalOcean e backup semanal**

- DigitalOcean: US$ 24
- Backup semanal: US$ 4,80
- Supabase Pro: US$ 25
- Conversão seca a R$ 5,10: R$ 274,38
- Domínio: R$ 3,33
- Total nominal: **R$ 277,71/mês**
- Orçamento sugerido com ~15% de margem cambial/tributária: **R$ 320/mês**

O backup do VPS protege configuração/artefatos locais; o banco no Supabase Pro já tem backup diário. Se o app for totalmente stateless e o deploy for reproduzível, o backup do VPS pode ser dispensado, reduzindo o nominal para R$ 253,23/mês.

### 3. VPS all-in-one

- Hostinger KVM 2 na renovação: R$ 77,99
- Domínio: R$ 3,33
- Cloudflare Free: R$ 0
- Total nominal: **R$ 81,32/mês**
- Orçamento de planejamento: **R$ 120/mês**

O host tem 8 GB de RAM, atendendo a recomendação de memória do Supabase self-hosted, mas só 2 vCPU, enquanto a recomendação é 4 núcleos ou mais. A documentação informa mínimo de 2 cores/4 GB/40 GB e recomendado de 4 cores/8 GB/80 GB para todos os componentes. O app Next.js competiria pelos mesmos recursos.

Mais importante: no self-hosting, ficam por conta da equipe provisionamento, hardening, atualizações, Postgres, alta disponibilidade, backups, recuperação de desastre, monitoramento e uptime. Recursos da plataforma gerenciada como backups/PITR, métricas avançadas e suporte não estão incluídos. Uma falha única pode derrubar simultaneamente app, login e banco. Este cenário deve ter backup externo e restauração ensaiada; esses custos e horas operacionais não estão incluídos nos R$ 81,32.

Fontes: [Supabase self-hosted com Docker e requisitos](https://supabase.com/docs/guides/self-hosting/docker) e [responsabilidades no self-hosting](https://supabase.com/docs/guides/self-hosting).

## Modelo de receita e ponto de equilíbrio

### Fórmula geral

Para uma cobrança unitária de preço `P`:

```text
receita líquida por venda = P × (1 - tarifa_percentual) - tarifa_fixa
vendas para breakeven = teto(custo_fixo_mensal ÷ receita_líquida_por_venda)
```

Se houver alíquota efetiva de tributos sobre faturamento `t`, usar:

```text
receita líquida por venda = P × (1 - tarifa_percentual - t) - tarifa_fixa
```

Não foi presumida alíquota tributária: ela depende de titularidade, atividade, município e regime fiscal. Também não foram incluídos pró-labore, contador, suporte, marketing, produção de conteúdo, perdas com chargeback nem valor das horas de desenvolvimento.

### Cobranças no cartão via Stripe

Usando 3,99% + R$ 0,39 e ignorando tributos sobre faturamento:

| Preço hipotético | Líquido/venda | Breakeven R$ 120 | Breakeven R$ 195 | Breakeven R$ 320 |
| ---------------: | ------------: | ---------------: | ---------------: | ---------------: |
|          R$ 9,90 |       R$ 9,11 |               14 |               22 |               36 |
|         R$ 14,90 |      R$ 13,92 |                9 |               15 |               23 |
|         R$ 19,90 |      R$ 18,72 |                7 |               11 |               18 |
|         R$ 29,90 |      R$ 28,32 |                5 |                7 |               12 |

Esses preços são hipóteses para testar assinaturas, passes de anfitrião ou pacotes — não são estimativas de disposição a pagar.

### Cobranças por Pix via Mercado Pago

Usando 0,99% e ignorando tributos:

| Preço hipotético | Líquido/venda | Breakeven R$ 120 | Breakeven R$ 195 | Breakeven R$ 320 |
| ---------------: | ------------: | ---------------: | ---------------: | ---------------: |
|          R$ 9,90 |       R$ 9,80 |               13 |               20 |               33 |
|         R$ 14,90 |      R$ 14,75 |                9 |               14 |               22 |
|         R$ 19,90 |      R$ 19,70 |                7 |               10 |               17 |
|         R$ 29,90 |      R$ 29,60 |                5 |                7 |               11 |

### Patrocínio

Hipótese simples: uma cota de R$ 299 paga no cartão Stripe deixa cerca de **R$ 286,68** antes de tributos. Assim:

- uma cota cobre o VPS all-in-one e a opção Hetzner + Supabase Pro;
- duas cotas cobrem a opção DigitalOcean + Supabase Pro de R$ 320.

Em transferência bancária ou Pix empresarial direto, a taxa pode ser diferente ou zero, mas precisa ser verificada com a instituição e conciliada fiscalmente.

### Publicidade: fórmula, não previsão

Não existe um RPM garantido. Para um RPM hipotético `R`, o volume mensal necessário é:

```text
pageviews para breakeven = 1.000 × custo_fixo_mensal ÷ RPM
```

| RPM hipotético |       R$ 120/mês | R$ 195/mês | R$ 320/mês |
| -------------: | ---------------: | ---------: | ---------: |
|           R$ 2 | 60.000 pageviews |     97.500 |    160.000 |
|           R$ 5 | 24.000 pageviews |     39.000 |     64.000 |
|          R$ 10 | 12.000 pageviews |     19.500 |     32.000 |

Essas faixas são cenários matemáticos, não fatos de mercado. O RPM real varia por rede, formato, país, consentimento, preenchimento e sazonalidade. O dado correto deve vir de um teste controlado no próprio tráfego.

### Combinações ilustrativas

Com o cenário conservador de R$ 320/mês, antes de tributos:

- 23 assinaturas de R$ 14,90 no cartão deixam aproximadamente R$ 320,06;
- 18 passes de R$ 19,90 no cartão deixam aproximadamente R$ 336,89;
- 1 patrocínio de R$ 299 + 10 assinaturas de R$ 14,90 no cartão deixam aproximadamente R$ 425,84;
- 50 assinaturas de R$ 14,90 deixam aproximadamente R$ 695,77, dos quais R$ 375,77 restariam depois da infraestrutura.

## Restrição de monetização do YouTube

As políticas permitem vender um API Client e operar um cliente financiado por publicidade, desde que todas as demais regras sejam cumpridas. Porém:

- não se pode cobrar o usuário para assistir a conteúdo num player incorporado do YouTube;
- não se pode vender acesso aos componentes dos serviços de API do YouTube sem aprovação prévia;
- publicidade/patrocínio não pode ser colocada dentro do conteúdo ou do player;
- anúncios numa tela que contenha dados do YouTube exigem que a tela tenha material independente suficiente para justificar a publicidade sem os dados do YouTube;
- o produto precisa agregar valor independente e não pode bloquear, modificar ou substituir anúncios do YouTube.

Logo, qualquer plano pago deve remunerar claramente o **valor independente do jogo** — por exemplo, ferramentas de organização, curadoria própria, administração, estatísticas próprias ou serviços para eventos — e não o direito de ouvir/ver vídeos do YouTube. Antes de lançar paywall, assinatura ou patrocínio na tela do player, recomenda-se revisão de conformidade e, se ainda houver dúvida, solicitar auditoria de conformidade ao YouTube.

Fonte: [YouTube API Services — Developer Policies](https://developers.google.com/youtube/terms/developer-policies) e [guia oficial de conformidade](https://developers.google.com/youtube/terms/developer-policies-guide).

## Recomendação

1. Rodar o beta pessoal e não comercial a R$ 0, ou R$ 40/ano com domínio.
2. Instrumentar usuários ativos, partidas, pageviews, retenção e intenção de pagamento.
3. Testar primeiro uma receita que não dependa de volume publicitário: patrocínio ou passe/assinatura para funcionalidades próprias, sujeito à revisão das políticas do YouTube.
4. Para go-live, usar como meta de caixa **R$ 320/mês** no cenário de menor risco operacional (VPS + Supabase Pro). O breakeven mínimo é baixo — dezenas de pagantes, não milhares — mas o teste decisivo será conversão e retenção.
5. Considerar all-in-one somente depois de automatizar backup externo, restauração, atualização e monitoramento; contabilizar horas de operação como custo real, mesmo que não saiam da conta bancária.
