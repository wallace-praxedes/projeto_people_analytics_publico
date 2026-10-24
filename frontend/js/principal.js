// =====================================================================
// CORES (as mesmas tintas do CSS, repetidas aqui porque o gráfico
// é desenhado dentro de um "canvas" e não enxerga o CSS)
// =====================================================================
const COR_DESTAQUE = "#ff7a1a";
const COR_TEXTO = "#f2f2f5";
const COR_TEXTO_SUAVE = "#9a9aa6";
const COR_BORDA = "#2a2a32";
const COR_CARTAO = "#17171c";
const PALETA = ["#ff7a1a", "#c9c9d3", "#ffb27a", "#8a8a99", "#5a5a68", "#3a3a46"];

// =====================================================================
// AJUDANTES
// =====================================================================

// Lê um arquivo .json da pasta dados/ e devolve o conteúdo.
// É como pedir uma caixa ao almoxarifado: você diz o nome, ele entrega.
async function carregarJSON(nome) {
  const resposta = await fetch("dados/" + nome + ".json");
  if (!resposta.ok) {
    throw new Error("Não achei dados/" + nome + ".json (código " + resposta.status + ")");
  }
  return await resposta.json();
}

// Soma todas as quantidades de uma lista [{categoria, quantidade}, ...]
function somar(lista) {
  return lista.reduce(function (total, item) {
    return total + item.quantidade;
  }, 0);
}

// Calcula quantos % um valor representa do total
function percentual(valor, total) {
  return Math.round((valor / total) * 100);
}

// Quebra um texto comprido em várias linhas, sem cortar palavras.
// Exemplo: "Prazo Indeterminado" vira ["Prazo", "Indeterminado"].
// É como a quebra de linha de um caderno: a palavra que não cabe vai para a linha de baixo.
function quebrarTexto(texto, limite) {
  const palavras = String(texto).split(" ");
  const linhas = [];
  let atual = "";

  palavras.forEach(function (palavra) {
    const tentativa = (atual + " " + palavra).trim();
    if (tentativa.length > limite && atual !== "") {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  });

  if (atual !== "") {
    linhas.push(atual);
  }
  return linhas;
}

// A Chart.js desenha em um "canvas", que só usa a Quicksand se ela já
// estiver carregada. Aqui esperamos a fonte chegar antes de desenhar.
async function prepararFontes() {
  try {
    await Promise.all([
      document.fonts.load("400 14px Quicksand"),
      document.fonts.load("700 14px Quicksand")
    ]);
  } catch (erro) {
    console.warn("Não consegui confirmar o carregamento da fonte:", erro);
  }
}

// Ajustes gerais da Chart.js: fonte, cores, sem animação própria
// (a animação de entrada será comandada pelo GSAP na Etapa 7)
function configurarChartJS() {
  if (typeof Chart === "undefined") {
    throw new Error("A Chart.js não foi carregada. Confira frontend/js/vendor/chart.umd.js");
  }

  Chart.defaults.font.family = '"Quicksand", Arial, sans-serif';
  Chart.defaults.font.size = 13;
  Chart.defaults.color = COR_TEXTO_SUAVE;
  Chart.defaults.animation = false;
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;

  Chart.defaults.plugins.tooltip.backgroundColor = "#0d0d10";
  Chart.defaults.plugins.tooltip.borderColor = COR_BORDA;
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.titleColor = COR_TEXTO;
  Chart.defaults.plugins.tooltip.bodyColor = COR_TEXTO;
  Chart.defaults.plugins.tooltip.padding = 10;
}

// Pequeno "carimbo" que escreve o número no fim de cada barra
const pluginValorNaBarra = {
  id: "valorNaBarra",
  afterDatasetsDraw: function (grafico) {
    const ctx = grafico.ctx;
    const barras = grafico.getDatasetMeta(0).data;
    const valores = grafico.data.datasets[0].data;

    ctx.save();
    ctx.fillStyle = COR_TEXTO;
    ctx.font = '700 13px "Quicksand", Arial, sans-serif';
    ctx.textBaseline = "middle";
    barras.forEach(function (barra, i) {
      ctx.fillText(valores[i], barra.x + 8, barra.y);
    });
    ctx.restore();
  }
};

// =====================================================================
// TIPOS DE GRÁFICO
// =====================================================================

// Rosca (rosquinha): boa para poucas categorias, como sexo
function desenharRosca(idCanvas, json) {
  const lista = json.dados;
  const total = somar(lista);

  new Chart(document.getElementById(idCanvas), {
    type: "doughnut",
    data: {
      labels: lista.map(function (item) { return item.categoria; }),
      datasets: [{
        data: lista.map(function (item) { return item.quantidade; }),
        backgroundColor: PALETA.slice(0, lista.length),
        borderColor: COR_CARTAO,
        borderWidth: 3
      }]
    },
    options: {
      cutout: "62%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, padding: 16, color: COR_TEXTO }
        },
        tooltip: {
          callbacks: {
            label: function (item) {
              return " " + item.parsed + " (" + percentual(item.parsed, total) + "%)";
            }
          }
        }
      }
    }
  });
}

// Barras horizontais: boas para categorias com nomes longos
function desenharBarras(idCanvas, json) {
  const lista = json.dados;
  const total = somar(lista);

  new Chart(document.getElementById(idCanvas), {
    type: "bar",
    data: {
      labels: lista.map(function (item) { return item.categoria; }),
      datasets: [{
        data: lista.map(function (item) { return item.quantidade; }),
        backgroundColor: COR_DESTAQUE,
        borderRadius: 6,
        maxBarThickness: 28
      }]
    },
    options: {
      indexAxis: "y",
      layout: { padding: { right: 48 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (item) {
              return " " + item.parsed.x + " (" + percentual(item.parsed.x, total) + "%)";
            }
          }
        }
      },
      scales: {
        x: { display: false, beginAtZero: true },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: COR_TEXTO,
            autoSkip: false,
            // Nomes compridos quebram em duas linhas (o nome completo continua no tooltip)
            callback: function (valor) {
              return quebrarTexto(this.getLabelForValue(valor), 16);
            }
          }
        }
      }
    },
    plugins: [pluginValorNaBarra]
  });
}

// =====================================================================
// MONTAGEM DO PAINEL
// =====================================================================

// Lê o JSON e desenha o gráfico. Se um falhar, os outros continuam.
async function montarGrafico(nomeJson, idCanvas, desenhar) {
  try {
    const json = await carregarJSON(nomeJson);
    desenhar(idCanvas, json);
  } catch (erro) {
    console.error("Falha no gráfico " + idCanvas + ":", erro);
  }
}

// Abertura: mostra o número de empregados ativos
async function montarAbertura() {
  const caixa = document.getElementById("numero-ativos");
  try {
    const json = await carregarJSON("empregados_ativos");
    caixa.textContent = json.dados.valor;
    console.log("Indicador:", json.indicador, "| Competência:", json.competencia);
  } catch (erro) {
    caixa.textContent = "erro ao carregar";
    console.error(erro);
  }
}

async function iniciar() {
  montarAbertura();

  try {
    await prepararFontes();
    configurarChartJS();
  } catch (erro) {
    console.error(erro);
    return;
  }

  // Lote 1 de gráficos (Etapa 6)
  montarGrafico("distribuicao_sexo", "grafico-sexo", desenharRosca);
  montarGrafico("estado_civil", "grafico-estado-civil", desenharBarras);
  montarGrafico("vinculo_empregaticio", "grafico-vinculo", desenharBarras);
}

iniciar();