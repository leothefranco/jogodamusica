const qs = new URLSearchParams(location.search);
const identity = identities[qs.get("identity")] ? qs.get("identity") : "a";
let screen = screens.some((s) => s.id === qs.get("screen"))
  ? qs.get("screen")
  : "home";
const art = `assets/${identities[identity].art}.png`;
document.body.className = `identity-${identity}`;
const crown =
  '<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M6 29 3 12l10 7 7-13 7 13 10-7-3 17H6Z" fill="currentColor"/><path d="M7 34h26" stroke="currentColor" stroke-width="3"/></svg>';
const brand = () =>
  `<button class="brand" data-go="home" aria-label="Last Track Standing — início"><span class="brand-mark">${crown}</span><span class="brand-name">LAST<br>TRACK<br>STANDING</span></button>`;
const btn = (text, to, kind = "", extra = "") =>
  `<button class="btn ${kind}" ${to ? `data-go="${to}"` : ""} ${extra}>${text}</button>`;
const link = (text, to) =>
  `<button class="text-link" data-go="${to}">${text}</button>`;
const cover = (text = "LTS") =>
  `<div class="cover" aria-hidden="true"><span>${text}</span></div>`;
const covers = () =>
  `<div class="cover-row">${["SIDE A", "LATE<br>NIGHT", "GOLD", "SIDE B"].map(cover).join("")}</div>`;
const header = (admin = false) =>
  `<header class="header ${admin ? "admin-header" : ""}">${brand()}${admin ? `<nav class="header-links" aria-label="Administração"><button data-go="admin" class="${screen === "admin" ? "selected" : ""}">Visão geral</button><button data-go="topics" class="${screen !== "admin" ? "selected" : ""}">Temas</button><button data-go="home">Ver jogo ↗</button><button data-go="login">Sair</button></nav>` : `<p class="header-note">UM APARELHO · JOGO EM GRUPO</p><nav class="header-links"><button class="desktop-only" data-how>Como jogar</button><span class="language">PT-BR</span></nav>`}</header>`;
const footer = () =>
  `<footer class="footer"><span>LAST TRACK STANDING</span><span>Boas músicas. Ótimas companhias.</span><button class="text-link" data-go="login">Administração ↗</button></footer><p class="prototype-strip">Estudo visual · conteúdo demonstrativo · sem conexão com os dados do jogo</p>`;
const wrap = (body, admin = false) =>
  header(admin) +
  `<main class="content ${admin ? "admin-layout" : ""}" id="content">${body}</main>` +
  footer();
const pageHead = (eyebrow, title, desc = "", actions = "") =>
  `<div class="page-head"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${desc ? `<p>${desc}</p>` : ""}${actions ? `<div class="actions">${actions}</div>` : ""}</div>`;
const pill = (text, type = "") => `<span class="pill ${type}">${text}</span>`;
const field = (label, value = "", type = "text", help = "") =>
  `<label class="form-field">${label}<input type="${type}" value="${value}" ${type === "password" ? 'autocomplete="current-password"' : ""}>${help ? `<span class="help">${help}</span>` : ""}</label>`;
const themeCards = () =>
  ["Rock de todos os tempos", "Pop para cantar junto", "Noite de hip-hop"]
    .map(
      (name, i) =>
        `<a href="?identity=${identity}&screen=theme" data-go="theme" class="theme-card"><header><span class="number">0${i + 1} / COLEÇÃO</span><span aria-hidden="true">↗</span></header><h3>${name}</h3><p>${[128, 64, 32][i]} músicas · ${[6, 5, 4][i]} modalidades</p>${covers()}</a>`,
    )
    .join("");
function home(empty = false) {
  return wrap(
    `<section class="hero"><div class="hero-text"><p class="eyebrow">A PRÓXIMA CAMPEÃ COMEÇA AQUI</p><h1 class="display">LAST<em>TRACK</em><span class="last-word">STANDING</span></h1><p class="hero-subtitle">Só uma música pode vencer.</p><p class="hero-description">Escolha um tema. Reúna a turma. Comparem as músicas até encontrar a campeã.</p><div class="actions">${btn("Escolher um tema ↗", "", "", "data-catalog")}${btn("Como jogar", "", "secondary", "data-how")}</div><p class="hero-fineprint">Um único aparelho. A decisão é de todo mundo.</p></div><div class="hero-art"><img src="${art}" alt="Vinil com coroa em um pódio, cercado por linhas de chaveamento"><span class="hero-tag">ONLY ONE TRACK SURVIVES</span></div></section><section class="catalog" id="catalog"><div class="section-head"><h2>Escolha o tema</h2><span class="small muted">${empty ? "0" : "3"} coleções</span></div>${empty ? `<div class="panel"><h3>O próximo som está chegando.</h3><p class="muted" style="margin-top:12px">Ainda não há temas publicados. Volte em breve para começar uma partida.</p></div>` : `<div class="grid3">${themeCards()}</div>`}</section><section class="how" id="how">${[
      ["01", "Escolha o tema", "Encontre a coleção que combina com a turma."],
      ["02", "Ouça e compare", "Escolham uma música por confronto."],
      ["03", "Celebre a campeã", "Só uma chega ao topo do pódio."],
    ]
      .map(
        ([n, t, d]) =>
          `<div class="how-item"><strong>${n}</strong><div><h3>${t}</h3><p>${d}</p></div></div>`,
      )
      .join("")}</section>`,
  );
}
function theme() {
  return wrap(
    `${link("← Voltar aos temas", "home")}<section class="theme-layout"><div><p class="eyebrow">COLEÇÃO / 128 MÚSICAS DISPONÍVEIS</p><h1 class="display">Rock de todos<br>os tempos.</h1><p class="theme-description">Riffs inesquecíveis, refrões que atravessam gerações. Qual música merece ficar de pé até o final?</p><div class="theme-cover">${["SIDE A", "LOUD", "GOLD", "SIDE B"].map(cover).join("")}</div><div class="actions">${pill("Um aparelho · jogo em grupo")}${pill("Dois sons. Uma escolha.")}</div></div><section class="panel"><p class="eyebrow">PREPARE A PARTIDA</p><h2>Quantas rodadas?</h2><p class="muted">Escolha o tamanho da disputa.</p><div class="modes">${[4, 8, 16, 32, 64, 128].map((n, i) => `<label class="mode"><input type="radio" name="mode" value="${n}"><span><strong>${i + 2}</strong> <span class="small">rodadas</span><small>${n} músicas</small></span></label>`).join("")}</div>${btn("Escolha uma modalidade", "duel", "full", 'id="start-game" disabled')}<p class="fine">As músicas são sorteadas entre as disponíveis no tema.</p></section></section>`,
  );
}
function songCard(side, error = false) {
  const second = side === "B";
  return `<article class="song-card ${second ? "side-b" : ""}"><div class="song-head"><span class="contender">${side}</span><div><h2>${second ? "Golden Hour" : "Midnight Drive"}</h2><p>${second ? "The Satellites" : "The North"}</p></div><span class="playing">${second ? "FAIXA B" : "FAIXA A"}</span></div><div class="player"><div class="video-art"></div>${error ? `<div class="player-error"><strong>Não foi possível reproduzir este vídeo.</strong><p>Confira sua conexão ou tente carregar o vídeo novamente.</p><div class="actions" style="justify-content:center">${btn("Tentar novamente", "duel", "secondary compact")}</div></div>` : `<span class="video-label">${second ? "Golden Hour" : "Midnight Drive"} · prévia</span><button class="play-control" data-play aria-label="Reproduzir ${second ? "Golden Hour" : "Midnight Drive"}">▶</button><span class="video-bottom"><span>0:00 / 0:30</span><span>PLAYER YOUTUBE · MOCKUP</span></span>`}</div>${btn(`Votar na música ${side} →`, "vote", "", `data-song="${side}"`)}</article>`;
}
function duel(error = false) {
  return `<main class="game-container" id="content"><header class="game-top"><div><button class="text-link" data-go="home"><span class="eyebrow">LAST TRACK STANDING</span></button><h1>Rock de todos os tempos</h1></div>${pill("Semifinal · 1 de 2")}</header><div class="game-tools"><span class="small muted">Ouçam. Conversem. Escolham.</span>${btn("⤨ Sortear vencedora", "tie-confirm", "secondary compact")}</div>${songCard("A", error)}<div class="versus"><span>VS</span></div>${songCard("B")}<div class="progress-meta"><span>Confronto 1 de 3</span><span>4 músicas na disputa</span></div><div class="progress-line"><span></span></div><div class="game-exit">${link("Abandonar partida e voltar ao tema", "abandon")}</div></main>`;
}
function confirmation(kind) {
  const vote = kind === "vote",
    tie = kind === "tie-confirm";
  const title = vote
    ? "Confirmar voto"
    : tie
      ? "Confirmar desempate"
      : "Abandonar partida?";
  const desc = vote
    ? "Esta música avança e a outra sai da disputa. Esta decisão não poderá ser desfeita."
    : tie
      ? "Uma das duas músicas será escolhida ao acaso para avançar. Esta decisão não poderá ser desfeita."
      : "O progresso atual será encerrado e esta partida não poderá ser retomada. Você voltará para o tema.";
  return (
    duel() +
    `<div class="overlay-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><p class="eyebrow">${vote ? "A ESCOLHA DO GRUPO" : tie ? "DEIXAR COM A SORTE" : "ANTES DE SAIR"}</p><h1 id="dialog-title">${title}</h1>${vote ? `<div class="dialog-selection">${cover(selectedSongB() ? "SIDE B" : "SIDE A")}<div><h2>${selectedSongB() ? "Golden Hour" : "Midnight Drive"}</h2><p>${selectedSongB() ? "The Satellites · Música B" : "The North · Música A"}</p></div></div>` : ""}<p>${desc}</p><div class="actions">${btn(vote || tie ? "Cancelar" : "Continuar jogando", "duel", "secondary")}${btn(vote ? "Confirmar voto" : tie ? "Sortear vencedora" : "Abandonar partida", vote ? "round" : tie ? "tie" : "theme", vote || tie ? "" : "danger")}</div></section></div>`
  );
}
function reveal() {
  return (
    header() +
    `<main class="round-screen" id="content"><p class="eyebrow">DESEMPATE</p><h1 class="display" style="font-size:58px">A sorte escolheu.</h1><div class="roulette" aria-hidden="true"></div><p class="round-chip">MÚSICA A AVANÇA</p><div class="winner-pair"><div class="mini-track winner">${cover("SIDE A")}${pill("♛ Vencedora", "accent")}<h3>Midnight Drive</h3><p>The North</p></div><div class="mini-track">${cover("SIDE B")}${pill("Música B")}<h3>Golden Hour</h3><p>The Satellites</p></div></div><p class="muted">Desempate concluído. Uma música mais perto do topo.</p><div class="actions">${btn("Ver próxima rodada →", "round")}</div></main>`
  );
}
function round(final = false) {
  return (
    header() +
    `<main class="round-screen" id="content"><p class="round-chip">${final ? "ÚLTIMO CONFRONTO" : "RODADA CONCLUÍDA"}</p><h1 class="display">${final ? 'A GRANDE<br><span style="color:var(--brand)">FINAL.</span>' : 'A DISPUTA<br><span style="color:var(--brand)">CONTINUA.</span>'}</h1><img src="${art}" alt="Vinil no pódio"><p class="muted">${final ? "Duas músicas. Um lugar no topo. Qual fica de pé?" : "As vencedoras avançaram. Os confrontos da próxima rodada são sorteados entre elas."}</p><div class="actions">${btn(final ? "Ir para a final →" : "Continuar →", final ? "duel" : "final")}</div></main>`
  );
}
const match = (number, a, b, winner = 0) =>
  `<div class="match-box"><p class="match-number">CONFRONTO ${number}</p><div class="match-row ${winner === 0 ? "won" : "lost"}"><span>${a}</span>${winner === 0 ? '<span class="crown">♛</span>' : ""}</div><div class="match-row ${winner === 1 ? "won" : "lost"}"><span>${b}</span>${winner === 1 ? '<span class="crown">♛</span>' : ""}</div></div>`;
const bracket = () =>
  `<div class="bracket-grid"><div class="bracket-round"><h3>01 / Semifinais</h3>${match("01", "Midnight Drive", "Golden Hour")}${match("02", "After the Rain", "Northern Lights", 1)}</div><div class="bracket-round"><h3>02 / Final</h3>${match("03", "Northern Lights", "Midnight Drive", 1)}<p class="fine">♛ Midnight Drive — campeã</p></div></div>`;
function result(onlyBracket = false) {
  if (onlyBracket)
    return wrap(
      `${link("← Voltar à campeã", "result")}${pageHead("ROCK DE TODOS OS TEMPOS", "O caminho até o topo.", "Os confrontos que decidiram a campeã. A ordem de cada rodada respeita o sorteio das músicas classificadas.")}<section>${bracket()}</section><div class="actions">${btn("Jogar novamente", "theme")}${btn("Ver imagem da campeã", "story", "secondary")}</div>`,
    );
  return wrap(
    `<section class="result-hero"><div><p class="eyebrow">♛ CAMPEÃ / ROCK DE TODOS OS TEMPOS</p><h1 class="display">MIDNIGHT<br><span style="color:var(--brand)">DRIVE.</span></h1><p class="artist">The North</p><p class="muted">A última música de pé. A escolha da sua turma.</p><div class="result-stats"><span><strong>4</strong>músicas</span><span><strong>2</strong>rodadas</span><span><strong>1</strong>campeã</span></div><div class="actions">${btn("Jogar novamente ↗", "theme")}${btn("Ver outros temas", "home", "secondary")}</div></div><img src="${art}" alt="Vinil campeão no pódio"></section><section class="share-panel"><div><p class="eyebrow">LEVE A CAMPEÃ COM VOCÊ</p><h2>O resultado merece um bis.</h2><p>Uma imagem pronta para Stories e Status.</p></div><div class="actions">${btn("Ver imagem ↗", "story")}${btn("Baixar mockup ↓", "", "secondary", "data-download")}</div></section><section><div class="section-head"><h2>Chaveamento completo</h2>${link("Ampliar ↗", "bracket")}</div>${bracket()}</section>`,
  );
}
function story() {
  return wrap(
    `${link("← Voltar ao resultado", "result")}<section class="story-layout"><div><p class="eyebrow">COMPARTILHAMENTO / 9:16</p><h1>Uma campeã.<br>Uma boa história.</h1><p class="muted" style="margin-top:22px">A identidade também acompanha o resultado fora do jogo.</p><div class="actions">${btn("Baixar mockup ↓", "", "", "data-download")}${btn("Voltar à campeã", "result", "secondary")}</div><p class="fine">Imagem demonstrativa. Faixa e artista fictícios.</p></div><article class="story" aria-label="Imagem vertical da campeã">${brand()}<p class="story-heading">A ÚLTIMA MÚSICA DE PÉ.</p><img src="${art}" alt="Vinil campeão"><div><p class="eyebrow">♛ CAMPEÃ</p><h2 class="display">MIDNIGHT<br>DRIVE</h2><p class="muted small" style="margin-top:10px">The North</p></div><div><p class="story-theme">ROCK DE TODOS OS TEMPOS</p><p class="story-footer">4 MÚSICAS · 2 RODADAS · 1 CAMPEÃ</p></div></article></section>`,
  );
}
function login(error = false) {
  return wrap(
    `<div class="login-layout"><section class="login-art"><img src="${art}" alt="Vinil no pódio"><h2>Boas disputas começam<br>com boas coleções.</h2></section><section class="panel"><p class="eyebrow">ACESSO ADMINISTRATIVO</p><h1 style="font-size:32px">Prepare o próximo hit.</h1><p class="muted" style="margin-top:15px">Entre para cuidar dos temas e das músicas.</p>${error ? '<div class="notice bad" role="alert">Não foi possível entrar. Confira seu e-mail e sua senha.</div>' : ""}<form data-form="login">${field("E-mail", "", "email")}${field("Senha", "", "password")}<div class="actions"><button class="btn full" type="submit">Entrar →</button></div></form><div style="margin-top:20px">${link("← Voltar ao jogo", "home")}</div></section></div>`,
  );
}
const adminThemes = [
  [
    "Rock de todos os tempos",
    "rock-de-todos-os-tempos",
    "Publicado",
    "Saudável",
    128,
  ],
  [
    "Pop para cantar junto",
    "pop-para-cantar-junto",
    "Publicado",
    "Degradado",
    64,
  ],
  ["Noite de hip-hop", "noite-de-hip-hop", "Publicado", "Saudável", 32],
  [
    "Descobertas da semana",
    "descobertas-da-semana",
    "Rascunho",
    "2 músicas jogáveis",
    2,
  ],
];
function adminCard([name, slug, state, health, count]) {
  return `<article class="panel admin-theme"><div class="pills">${pill(state, state === "Publicado" ? "accent" : "")}${pill(health, health === "Saudável" ? "good" : health === "Degradado" ? "warn" : "")}</div><h2>${name}</h2><p class="slug">/${slug}</p><div class="meta"><span>${count} músicas jogáveis</span><span>${count >= 4 ? "Disponível para jogar" : "Mínimo: 4 músicas"}</span></div><div class="actions">${btn("Editar tema ↗", "edit-topic", "secondary compact")}${state === "Publicado" ? btn("Ver tema", "theme", "ghost compact") : ""}</div></article>`;
}
function admin() {
  return wrap(
    `${pageHead("PAINEL ADMINISTRATIVO", "Vamos preparar a próxima disputa.", "Organize coleções, revise músicas e publique novos temas.", btn("Gerenciar temas →", "topics") + btn("+ Novo tema", "new-topic", "secondary"))}<section class="stats"><div class="stat"><strong>4</strong><span>temas cadastrados</span></div><div class="stat"><strong>3</strong><span>temas publicados</span></div><div class="stat"><strong>228</strong><span>associações de músicas</span></div></section><div class="section-head"><h2>Seu catálogo</h2>${link("Ver todos ↗", "topics")}</div><div class="grid2">${adminThemes.slice(0, 2).map(adminCard).join("")}</div><section class="admin-quick"><div class="panel"><div><h3>Um tema precisa de atenção.</h3><p>Algumas músicas estão indisponíveis. Revise a saúde do catálogo.</p></div>${btn("Ver disponibilidade →", "health", "secondary")}</div></section>`,
    true,
  );
}
function topics(empty = false) {
  return wrap(
    `${pageHead("CONTEÚDO", "Temas", "Cada coleção é o começo de uma nova disputa.", btn("+ Novo tema", "new-topic") + (!empty ? btn("Ver disponibilidade", "health", "secondary") : ""))}${empty ? `<section class="state-screen" style="min-height:390px"><span class="state-symbol">＋</span><h2 style="margin:24px 0 15px">Seu primeiro tema começa aqui.</h2><p>Crie uma coleção e adicione pelo menos quatro músicas jogáveis para publicá-la.</p><div class="actions">${btn("Criar primeiro tema →", "new-topic")}</div></section>` : `<div class="grid2">${adminThemes.map(adminCard).join("")}</div>`}`,
    true,
  );
}
function themeForm(edit = false) {
  return `<form data-form="theme"><h2>Dados do tema</h2><p class="muted">Como a coleção aparece no catálogo.</p>${field("Nome", edit ? "Rock de todos os tempos" : "")}${field("Endereço", edit ? "rock-de-todos-os-tempos" : "", "text", "Usado no endereço público do tema.")}<label class="form-field">Descrição<textarea>${edit ? "Riffs inesquecíveis, refrões que atravessam gerações. Qual música merece ficar de pé até o final?" : ""}</textarea></label><div class="upload">Capa da coleção<label class="form-field">Selecionar imagem<input type="file" accept="image/*"></label><span class="help small">Uma imagem que represente o tema.</span></div><div class="actions"><button class="btn" type="submit">${edit ? "Salvar alterações" : "Criar tema →"}</button></div></form>`;
}
function newTopic() {
  return wrap(
    `${link("← Voltar aos temas", "topics")}${pageHead("NOVA COLEÇÃO", "Qual é o tema da vez?", "Comece pelos detalhes. Depois, adicione as músicas e publique a coleção.")}<div class="editor-grid"><section class="panel">${themeForm()}</section><aside><div class="panel"><p class="eyebrow">DA IDEIA À DISPUTA</p><h2>Um bom tema tem personalidade.</h2><p class="muted">Escolha um nome claro, uma descrição curta e uma capa que combine com a seleção.</p><div class="rule"></div><p class="small muted">O tema começa em rascunho. Para publicar, são necessárias pelo menos quatro músicas jogáveis.</p></div></aside></div>`,
    true,
  );
}
function trackRows() {
  return [
    ["Midnight Drive", "The North"],
    ["Golden Hour", "The Satellites"],
    ["Northern Lights", "Velvet Radio"],
  ]
    .map(
      ([t, a]) =>
        `<article class="track-row"><div class="track-info">${cover("LTS")}<div><h3>${t}</h3><p>${a} · início 0:45 · trecho 0:30</p></div></div><div class="actions">${pill("Ativa", "good")}${btn("Editar", "track-edit", "secondary compact")}${btn("Remover", "", "ghost compact", 'data-demo="Remoção simulada. O catálogo real não foi alterado."')}</div></article>`,
    )
    .join("");
}
function editTopic() {
  return wrap(
    `${link("← Voltar aos temas", "topics")}${pageHead("EDITAR COLEÇÃO", "Rock de todos os tempos", "/rock-de-todos-os-tempos", pill("Publicado", "accent") + pill("Saudável", "good") + pill("128 músicas jogáveis"))}<div class="actions" style="margin:0 0 28px">${btn("Importar playlist", "import", "secondary")}${btn("Voltar a rascunho", "", "secondary", 'data-demo="Mudança demonstrativa de publicação. Nada foi gravado."')}${btn("Excluir tema", "delete-topic", "ghost")}</div><div class="editor-grid"><section class="panel">${themeForm(true)}</section><section class="panel"><p class="eyebrow">AMPLIE A COLEÇÃO</p><h2>Adicionar música</h2><p class="muted">Busque no YouTube ou cole o endereço de um vídeo.</p><div class="search-row">${field("Pesquisar no YouTube", "")}${btn("Buscar →", "track-search")}</div><div class="rule"></div><div class="search-row">${field("URL ou ID do vídeo", "")}${btn("Abrir", "track-edit", "secondary")}</div><div class="notice good">Modalidades disponíveis: 4, 8, 16, 32, 64 e 128 músicas.</div><p class="small muted">Revise a faixa e o trecho antes de adicionar ao tema.</p></section></div><section class="panel editor-songs"><div class="section-head"><div><h2>Músicas do tema</h2><p class="small muted">128 associações · 128 ativas</p></div>${btn("Rever disponibilidade", "health", "secondary compact")}</div>${trackRows()}</section>`,
    true,
  );
}
function trackSearch() {
  return wrap(
    `${link("← Voltar ao tema", "edit-topic")}${pageHead("ROCK DE TODOS OS TEMPOS", "Encontre o próximo som.", "Pesquise no YouTube ou informe uma URL para revisar a faixa.")}<div class="panel"><div class="search-row">${field("Pesquisar no YouTube", "Midnight Drive")}${btn("Buscar", "", "", 'data-demo="Busca demonstrativa; os resultados abaixo são fictícios."')}</div><div class="search-results"><p class="eyebrow">RESULTADOS</p>${[
      ["Midnight Drive — Official Video", "The North · 3:42"],
      ["Midnight Drive — Live", "The North Live · 4:12"],
      ["Midnight Drive — Acoustic Session", "The North · 3:18"],
    ]
      .map(
        ([t, a]) =>
          `<article class="track-row"><div class="track-info">${cover("LTS")}<div><h3>${t}</h3><p>${a}</p></div></div>${btn("Revisar faixa →", "track-edit", "secondary compact")}</article>`,
      )
      .join("")}</div></div>`,
    true,
  );
}
function trackEdit() {
  return wrap(
    `${link("← Voltar ao tema", "edit-topic")}${pageHead("REVISÃO DA FAIXA", "O trecho certo faz diferença.", "Ajuste a apresentação da música e o momento que toca no confronto.")}<section class="panel track-editor"><div class="player"><div class="video-art"></div><button class="play-control" data-play aria-label="Reproduzir prévia">▶</button><span class="video-label">Midnight Drive — prévia demonstrativa</span></div><form data-form="track"><div class="grid2">${field("Título exibido", "Midnight Drive")}${field("Artista exibido", "The North")}${field("Início do trecho (segundos)", "45", "number")}${field("Duração do trecho (segundos)", "30", "number")}</div><label class="checkbox"><input type="checkbox" checked> Música ativa neste tema</label><div class="notice good">Vídeo disponível para reprodução.</div><div class="actions"><button type="submit" class="btn">Salvar música →</button>${btn("Cancelar", "edit-topic", "secondary")}</div></form></section>`,
    true,
  );
}
function importPage(stage = "input") {
  let preview = stage === "preview";
  if (stage === "success")
    return wrap(
      `${link("← Voltar ao tema", "edit-topic")}<section class="state-screen"><span class="state-symbol">✓</span><p class="eyebrow" style="margin-top:30px">IMPORTAÇÃO CONCLUÍDA</p><h1 class="display">Mais música.<br>Mais disputa.</h1><p>3 músicas adicionadas ao tema. As faixas já associadas foram preservadas.</p><div class="actions">${btn("Revisar músicas →", "edit-topic")}${btn("Importar outra playlist", "import", "secondary")}</div></section>`,
      true,
    );
  return wrap(
    `${link("← Voltar ao tema", "edit-topic")}${pageHead("ROCK DE TODOS OS TEMPOS", "Importar playlist", "Traga uma seleção inteira e revise as músicas antes de adicionar.")}<section class="import-box"><div class="stepper"><span><b>01</b> Playlist</span><span><b>${preview ? "02" : "○"}</b> Revisão</span><span>○ Conclusão</span></div><div class="panel"><div class="search-row">${field("URL ou ID da playlist", preview ? "Playlist de demonstração" : "")}${btn("Gerar prévia →", "import-preview")}</div><p class="fine">Use uma playlist pública ou não listada.</p></div>${
      preview
        ? `<section class="panel" style="margin-top:22px"><div class="section-head"><div><p class="eyebrow">PRÉVIA DA IMPORTAÇÃO</p><h2>Rock: seleção da turma</h2></div>${pill("5 vídeos")}</div><div class="import-summary"><span>3 disponíveis</span><span>1 já associado</span><span>1 indisponível</span></div>${[
            ["Electric Morning", "The Hours", "Disponível", true],
            ["City Lights", "Paper Planes", "Disponível", true],
            ["Last Train", "Analog Heart", "Disponível", true],
            ["Midnight Drive", "The North", "Já associada", false],
            ["Lost Signal", "Echo Park", "Indisponível", false],
          ]
            .map(
              ([t, a, s, ok]) =>
                `<label class="preview-row ${ok ? "" : "disabled"}"><input type="checkbox" ${ok ? "checked" : "disabled"}><span><h3>${t}</h3><p>${a}</p></span>${pill(s, ok ? "good" : "")}</label>`,
            )
            .join(
              "",
            )}<div class="actions">${btn("Importar 3 músicas →", "import-success", "", 'id="import-selected"')}${btn("Cancelar", "edit-topic", "secondary")}</div></section>`
        : ""
    }</section>`,
    true,
  );
}
function deleteTopic() {
  return (
    topics() +
    `<div class="overlay-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><p class="eyebrow">EXCLUIR RASCUNHO</p><h1 id="dialog-title">Excluir este tema?</h1><div class="dialog-selection"><div><h2>Descobertas da semana</h2><p>Rascunho · sem partidas relacionadas</p></div></div><p>O tema e suas associações serão removidos. Esta ação não poderá ser desfeita.</p><div class="actions">${btn("Cancelar", "topics", "secondary")}${btn("Excluir tema", "topics", "danger", 'data-demo="Exclusão apenas demonstrativa. Nenhum tema real foi removido."')}</div></section></div>`
  );
}
function health() {
  return wrap(
    `${link("← Voltar aos temas", "topics")}${pageHead("SAÚDE DO CATÁLOGO", "Tudo pronto para tocar?", "Publicação e disponibilidade são condições diferentes. A coleção pode continuar publicada e ficar temporariamente oculta.")}<section class="panel"><div class="health-table"><div class="health-row"><span>Tema</span><span>Estado operacional</span><span>Visibilidade</span></div>${[
      [
        "Rock de todos os tempos",
        "128 músicas jogáveis",
        "Saudável",
        "Visível",
        "good",
      ],
      [
        "Pop para cantar junto",
        "64 jogáveis · 2 indisponíveis",
        "Degradado",
        "Visível",
        "warn",
      ],
      [
        "Noite de hip-hop",
        "Verificação de músicas pendente",
        "Suspenso · verificação",
        "Oculto até recuperar",
        "warn",
      ],
      [
        "Acústicos",
        "2 músicas jogáveis",
        "Suspenso · insuficiente",
        "Oculto até recuperar",
        "bad",
      ],
      [
        "Descobertas da semana",
        "Rascunho editorial",
        "Não publicado",
        "Oculto",
        "",
      ],
    ]
      .map(
        ([n, d, s, v, k]) =>
          `<div class="health-row"><div><strong>${n}</strong><small>${d}</small></div>${pill(s, k)}<div>${v}</div></div>`,
      )
      .join(
        "",
      )}</div><div class="actions">${btn("Revisar tema →", "edit-topic")}${btn("Verificar novamente", "", "secondary", 'data-demo="Verificação demonstrativa. Nenhuma consulta externa foi realizada."')}</div></section>`,
    true,
  );
}
function statePage(kind) {
  const config = {
    offline: [
      "⌁",
      "O som deu<br>uma pausa.",
      "Você está sem conexão. O catálogo, a partida e os vídeos do YouTube precisam de internet. Reconecte-se para continuar.",
      "Tentar novamente",
      "home",
    ],
    error: [
      "!",
      "Algo saiu<br>do ritmo.",
      "Não foi possível carregar esta página. Tente novamente em alguns instantes.",
      "Tentar novamente",
      "home",
    ],
    "not-found": [
      "404",
      "Essa faixa<br>não está aqui.",
      "A página ou o tema que você procurou não foi encontrado.",
      "Voltar aos temas",
      "home",
    ],
    loading: [
      "◌",
      "Preparando<br>a próxima faixa.",
      "Só um instante enquanto carregamos o jogo.",
      "",
      "home",
    ],
  }[kind];
  return (
    header() +
    `<main class="state-screen" id="content"><span class="state-symbol">${config[0]}</span><h1 class="display">${config[1]}</h1><p>${config[2]}</p>${kind === "loading" ? `<div class="skeleton-grid">${[1, 2, 3].map(() => '<div class="panel"><div class="skeleton"></div><div class="skeleton" style="width:65%"></div><div class="skeleton big"></div></div>').join("")}</div>` : `<div class="actions">${btn(config[3], config[4])}</div>`}</main>` +
    footer()
  );
}
const renderers = {
  home: () => home(),
  theme,
  duel: () => duel(),
  vote: () => confirmation("vote"),
  "tie-confirm": () => confirmation("tie-confirm"),
  tie: reveal,
  round: () => round(),
  final: () => round(true),
  abandon: () => confirmation("abandon"),
  result: () => result(),
  bracket: () => result(true),
  story,
  login: () => login(),
  "login-error": () => login(true),
  admin,
  topics: () => topics(),
  "new-topic": newTopic,
  "edit-topic": editTopic,
  "track-search": trackSearch,
  "track-edit": trackEdit,
  import: () => importPage(),
  "import-preview": () => importPage("preview"),
  "import-success": () => importPage("success"),
  "delete-topic": deleteTopic,
  health,
  "empty-catalog": () => home(true),
  "empty-admin": () => topics(true),
  loading: () => statePage("loading"),
  error: () => statePage("error"),
  "not-found": () => statePage("not-found"),
  offline: () => statePage("offline"),
  "player-error": () => duel(true),
};

function selectedSongB() {
  try {
    return sessionStorage.getItem("lts-mock-song") === "B";
  } catch {
    return false;
  }
}
function installNotice(kind = "public") {
  const isAdmin = kind === "admin";
  return (
    (isAdmin ? admin() : home()) +
    `<aside class="install-notice" aria-label="Instalar aplicativo"><div><span class="eyebrow">LEVE A MÚSICA COM VOCÊ</span><h2>Instale o Last Track Standing${isAdmin ? " Admin" : ""}</h2><p>${kind === "ios" ? "No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”." : "Abra o jogo direto da sua tela inicial."}</p>${kind === "ios" ? "" : btn("Instalar aplicativo", "", "compact", 'data-demo="Instalação ilustrativa. Nenhum aplicativo será instalado pelo mockup."')}</div><button class="btn ghost compact" data-go="${isAdmin ? "admin" : "home"}" aria-label="Fechar aviso de instalação">×</button></aside>`
  );
}
function loginConfig() {
  return login()
    .replace(
      '<form data-form="login">',
      '<div class="notice warn">O acesso administrativo está indisponível neste ambiente.</div><form data-form="login">',
    )
    .replace(/<input /g, "<input disabled ")
    .replace('type="submit"', 'type="submit" disabled');
}
Object.assign(renderers, {
  install: () => installNotice(),
  "install-ios": () => installNotice("ios"),
  "install-admin": () => installNotice("admin"),
  "login-config": loginConfig,
});

document.getElementById("app").innerHTML = renderers[screen]();
document.title = `${screens.find((s) => s.id === screen).title} · ${identities[identity].name} · Last Track Standing`;
function navigate(to) {
  if (window.parent !== window) {
    window.parent.postMessage(
      { type: "navigate", screen: to },
      location.protocol === "file:" ? "*" : location.origin,
    );
  } else location.href = `screen.html?identity=${identity}&screen=${to}`;
}
let toastTimer;
function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
}
document.addEventListener("click", (event) => {
  const el = event.target.closest("button,a");
  if (!el) return;
  if (el.dataset.song) {
    try {
      sessionStorage.setItem("lts-mock-song", el.dataset.song);
    } catch {}
  }
  if (el.dataset.go) {
    event.preventDefault();
    navigate(el.dataset.go);
    return;
  }
  if (el.hasAttribute("data-catalog"))
    document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" });
  if (el.hasAttribute("data-how")) {
    const how = document.getElementById("how");
    if (how) how.scrollIntoView({ behavior: "smooth" });
    else navigate("home");
  }
  if (el.dataset.demo) toast(el.dataset.demo);
  if (el.hasAttribute("data-play")) {
    const active = el.textContent === "Ⅱ";
    document.querySelectorAll("[data-play]").forEach((e) => {
      e.textContent = "▶";
      e.setAttribute("aria-pressed", "false");
    });
    el.textContent = active ? "▶" : "Ⅱ";
    el.setAttribute("aria-pressed", String(!active));
    toast("Prévia visual do player. Não há reprodução de áudio neste mockup.");
  }
  if (el.hasAttribute("data-download")) {
    const a = document.createElement("a");
    a.href = `exports/${identity}/desktop/story.png`;
    a.download = `last-track-standing-${identities[identity].art}-story.png`;
    a.click();
  }
});
document.addEventListener("change", (event) => {
  if (event.target.name === "mode") {
    const start = document.getElementById("start-game");
    start.disabled = false;
    start.textContent = `Iniciar partida · ${event.target.value} músicas →`;
  }
  if (screen === "import-preview" && event.target.type === "checkbox") {
    const n = document.querySelectorAll(".preview-row input:checked").length;
    const b = document.getElementById("import-selected");
    b.textContent = `Importar ${n} ${n === 1 ? "música" : "músicas"} →`;
    b.disabled = !n;
  }
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  const type = e.target.dataset.form;
  if (type === "login") navigate("admin");
  else if (type === "theme" || type === "track") navigate("edit-topic");
});
const dialog = document.querySelector("[role=dialog]");
if (dialog) {
  const focusables = [...dialog.querySelectorAll("button,a,input")];
  focusables[0]?.focus({ preventScroll: true });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      navigate(screen === "delete-topic" ? "topics" : "duel");
    if (e.key === "Tab") {
      const first = focusables[0],
        last = focusables.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}
