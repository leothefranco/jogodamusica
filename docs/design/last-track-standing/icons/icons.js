const NS = "http://www.w3.org/2000/svg";
const iconOptions = [
  {
    id: "01",
    name: "Original elétrico",
    tag: "CONTINUIDADE",
    description:
      "A mesma geometria do ícone atual, em verde elétrico. A mudança fica na cor.",
    concept: "Preserva integralmente o desenho original.",
  },
  {
    id: "02",
    name: "Original Encore",
    tag: "EVOLUÇÃO DIRETA",
    description:
      "Azul e laranja nas laterais; verde no pulso central. A opção C dentro do ícone.",
    concept: "Mantém a silhueta atual e atribui uma função a cada cor.",
  },
  {
    id: "03",
    name: "Pulso",
    tag: "MÚSICA EM MOVIMENTO",
    description:
      "Colchetes mais abertos e uma onda central. Uma evolução mais leve do símbolo atual.",
    concept: "O confronto envolve a música; o pulso continua no centro.",
  },
  {
    id: "04",
    name: "Última faixa",
    tag: "UMA SOBREVIVE",
    description:
      "Uma faixa verde permanece mais alta entre as demais. Simples, vertical e fácil de reconhecer.",
    concept: "O nome do jogo vira uma forma: a última faixa de pé.",
  },
  {
    id: "05",
    name: "Vinil",
    tag: "ASSINATURA MUSICAL",
    description:
      "Dois lados envolvem um disco central. Conecta o ícone ao vinil e ao pódio da tela inicial.",
    concept: "O universo visual do vinil vira um símbolo compacto.",
  },
  {
    id: "06",
    name: "Chave final",
    tag: "COMPETIÇÃO",
    description:
      "Dois caminhos convergem para uma única faixa. O chaveamento faz parte da marca.",
    concept: "A progressão do torneio aparece sem recorrer a uma coroa.",
  },
];
function mark(id, mode = "color") {
  const lime =
    mode === "white" ? "#F5F3ED" : mode === "ink" ? "#101211" : "#D4FF46";
  const blue = mode === "color" ? "#38BDF8" : lime,
    orange = mode === "color" ? "#FF923D" : lime;
  const fill = (d, c) => `<path d="${d}" fill="${c}"/>`;
  const line = (d, c, w = 32) =>
    `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="square"/>`;
  if (id === "original")
    return (
      fill(
        "M104 152h100v32h-68v144h68v32H104z M184 224h32v64h-32z M232 192h24v128h-24z",
        blue,
      ) +
      fill(
        "M408 152H308v32h68v144h-68v32h100z M296 224h32v64h-32z M256 192h24v128h-24z",
        orange,
      )
    );
  if (id === "01")
    return fill(
      "M104 152h100v32h-68v144h68v32H104z M184 224h32v64h-32z M232 192h48v128h-48z M408 152H308v32h68v144h-68v32h100z M296 224h32v64h-32z",
      lime,
    );
  if (id === "02")
    return (
      fill("M104 152h100v32h-68v144h68v32H104z M184 224h32v64h-32z", blue) +
      fill("M408 152H308v32h68v144h-68v32h100z M296 224h32v64h-32z", orange) +
      fill("M232 192h48v128h-48z", lime)
    );
  if (id === "03")
    return (
      line("M172 136H112V376H172", blue, 28) +
      line("M340 136H400V376H340", orange, 28) +
      fill(
        "M182 221h32v70h-32z M240 164h32v184h-32z M298 201h32v110h-32z",
        lime,
      )
    );
  if (id === "04")
    return (
      fill("M104 278h40v90h-40z M166 230h40v138h-40z", blue) +
      fill("M306 230h40v138h-40z M368 278h40v90h-40z", orange) +
      fill("M232 130h48v238h-48z", lime)
    );
  if (id === "05")
    return `<path d="M202 126A141 141 0 0 0 202 386" fill="none" stroke="${blue}" stroke-width="32"/><path d="M310 126A141 141 0 0 1 310 386" fill="none" stroke="${orange}" stroke-width="32"/><circle cx="256" cy="256" r="82" stroke="${lime}" stroke-width="32" fill="none"/><circle cx="256" cy="256" r="20" fill="${lime}"/>`;
  if (id === "06")
    return (
      line("M104 132H168V380H104 M168 256H216", blue, 28) +
      line("M408 132H344V380H408 M344 256H296", orange, 28) +
      fill("M232 180h48v152h-48z", lime)
    );
  return "";
}
function svg(id, { size = 160, mode = "color", tile = true } = {}) {
  return `<svg xmlns="${NS}" width="${size}" height="${size}" viewBox="0 0 512 512" fill="none" role="img" aria-label="${id === "original" ? "Ícone atual" : iconOptions.find((o) => o.id === id)?.name}">${tile ? '<rect width="512" height="512" rx="112" fill="#101216"/>' : ""}${mark(id, mode)}</svg>`;
}
if (typeof window !== "undefined") {
  window.iconOptions = iconOptions;
  window.iconSvg = svg;
}
