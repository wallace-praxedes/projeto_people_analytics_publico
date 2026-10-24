// =====================================================================
// CORES (as mesmas tintas do CSS, repetidas aqui porque o gráfico
// é desenhado dentro de um "canvas" e não enxerga o CSS)
// =====================================================================
const COR_DESTAQUE = "#ff7a1a";
const COR_CLARA = "#c9c9d3";
const COR_FUNDO = "#0d0d10";
const COR_TEXTO = "#f2f2f5";
const COR_TEXTO_SUAVE = "#9a9aa6";
const COR_BORDA = "#2a2a32";
const COR_CARTAO = "#17171c";
const PALETA = ["#ff7a1a", "#c9c9d3", "#ffb27a", "#8a8a99", "#5a5a68", "#3a3a46"];
const FONTE_NEGRITO = '700 13px "Quicksand", Arial, sans-serif';
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const NOMES_NIVEL = ["Gerente", "Não gerente", "Estagiário(a)", "Jovem aprendiz"];
const NS_SVG = "http://www.w3.org/2000/svg";

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

// Igual ao anterior, mas para o arquivo de contorno do mapa (.geojson)
async function carregarGeoJSON(nome) {
  const resposta = await fetch("dados/" + nome + ".geojson");
  if (!resposta.ok) {
    throw new Error("Não achei dados/" + nome + ".geojson (código " + resposta.status + ")");
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

// Escreve um número no padrão brasileiro, com um número fixo de casas.
// Exemplo: formatarNumero(2.98, 1) devolve "3,0"
function formatarNumero(valor, casas) {
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

// Tira acentos e deixa em maiúsculas, para comparar textos sem se preocupar
// com escrita. Exemplo: "Não Gerente" vira "NAO GERENTE".
function semAcento(texto) {
  return String(texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

// Quebra um texto comprido em várias linhas, sem cortar palavras.
// Exemplo: "Prazo Indeterminado" vira ["Prazo", "Indeterminado"].
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

// Transforma "2024-03" em "mar/24"
function rotuloMes(mes) {
  const texto = String(mes);
  if (/^\d{4}-\d{2}/.test(texto)) {
    return MESES[Number(texto.substring(5, 7)) - 1] + "/" + texto.substring(2, 4);
  }
  return texto;
}

// Dá um "peso" a cada geração para ordenar da mais velha (em cima)
// para a mais nova (embaixo). Se não reconhecer o nome, mantém a ordem do JSON.
function pesoGeracao(rotulo) {
  const t = String(rotulo).toLowerCase();
  if (t.indexOf("boomer") !== -1) return 0;
  if (/(^|[^a-z])x([^a-z]|$)/.test(t)) return 1;
  if (/(^|[^a-z])y([^a-z]|$)/.test(t) || t.indexOf("millennial") !== -1) return 2;
  if (/(^|[^a-z])z([^a-z]|$)/.test(t)) return 3;
  if (t.indexOf("alpha") !== -1) return 4;
  return 99;
}

// Ordem dos níveis hierárquicos: Gerente, Não gerente, Estagiário, Jovem aprendiz
function pesoNivel(nivel) {
  const t = semAcento(nivel);
  if (t.indexOf("NAO") === 0) return 1;
  if (t.indexOf("GERENTE") !== -1) return 0;
  if (t.indexOf("ESTAGI") !== -1) return 2;
  if (t.indexOf("APRENDIZ") !== -1) return 3;
  return 99;
}

// Nome bonito do nível para mostrar na tela
function nomeNivel(nivel) {
  const peso = pesoNivel(nivel);
  return peso < 99 ? NOMES_NIVEL[peso] : String(nivel);
}

// Ordem da escolaridade, da menor para a maior
function pesoFormacao(formacao) {
  const t = semAcento(formacao);
  const incompleto = t.indexOf("INCOMPLETO") !== -1;
  if (t.indexOf("FUNDAMENTAL") !== -1) return incompleto ? -2 : -1;
  if (t.indexOf("MEDIO") !== -1) return incompleto ? 0 : 1;
  if (t.indexOf("SUPERIOR") !== -1) return incompleto ? 2 : 3;
  if (t.indexOf("POS") !== -1) return 4;
  if (t.indexOf("MESTRADO") !== -1) return 5;
  if (t.indexOf("DOUTORADO") !== -1) return 6;
  return 99;
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

  Chart.defaults.plugins.tooltip.backgroundColor = COR_FUNDO;
  Chart.defaults.plugins.tooltip.borderColor = COR_BORDA;
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.titleColor = COR_TEXTO;
  Chart.defaults.plugins.tooltip.bodyColor = COR_TEXTO;
  Chart.defaults.plugins.tooltip.footerColor = COR_TEXTO_SUAVE;
  Chart.defaults.plugins.tooltip.padding = 10;
}

// Pequeno "carimbo" que escreve o número no fim de cada barra horizontal
const pluginValorNaBarra = {
  id: "valorNaBarra",
  afterDatasetsDraw: function (grafico) {
    const ctx = grafico.ctx;
    const barras = grafico.getDatasetMeta(0).data;
    const valores = grafico.data.datasets[0].data;

    ctx.save();
    ctx.fillStyle = COR_TEXTO;
    ctx.font = FONTE_NEGRITO;
    ctx.textBaseline = "middle";
    barras.forEach(function (barra, i) {
      ctx.fillText(valores[i], barra.x + 8, barra.y);
    });
    ctx.restore();
  }
};

// Carimbo do gráfico "Ativos e liderança por área":
// escreve só o TOTAL de ativos da área (líderes + demais) no fim de cada barra.
// A quantidade de líderes aparece no balãozinho, ao passar o mouse.
const pluginValoresLideranca = {
  id: "valoresLideranca",
  afterDatasetsDraw: function (grafico) {
    const ctx = grafico.ctx;
    const lideres = grafico.data.datasets[0].data;
    const demais = grafico.data.datasets[1].data;
    const barrasDemais = grafico.getDatasetMeta(1).data;

    ctx.save();
    ctx.fillStyle = COR_TEXTO;
    ctx.font = FONTE_NEGRITO;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    barrasDemais.forEach(function (barra, i) {
      ctx.fillText(lideres[i] + demais[i], barra.x + 8, barra.y);
    });
    ctx.restore();
  }
};

// Carimbo das colunas: escreve a quantidade em cima de cada coluna
const pluginValorNaColuna = {
  id: "valorNaColuna",
  afterDatasetsDraw: function (grafico) {
    const ctx = grafico.ctx;

    ctx.save();
    ctx.fillStyle = COR_TEXTO;
    ctx.font = FONTE_NEGRITO;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    grafico.data.datasets.forEach(function (dataset, d) {
      grafico.getDatasetMeta(d).data.forEach(function (barra, i) {
        const valor = dataset.data[i];
        if (valor > 0) {
          ctx.fillText(valor, barra.x, barra.y - 6);
        }
      });
    });
    ctx.restore();
  }
};

// Carimbo da pirâmide: escreve a quantidade no meio de cada barra
const pluginValorPiramide = {
  id: "valorPiramide",
  afterDatasetsDraw: function (grafico) {
    const ctx = grafico.ctx;

    ctx.save();
    ctx.fillStyle = COR_FUNDO;
    ctx.font = FONTE_NEGRITO;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    grafico.data.datasets.forEach(function (dataset, d) {
      grafico.getDatasetMeta(d).data.forEach(function (barra, i) {
        const valor = Math.abs(dataset.data[i]);
        if (valor === 0 || Math.abs(barra.x - barra.base) < 20) {
          return;
        }
        const centro = barra.getCenterPoint();
        ctx.fillText(valor, centro.x, centro.y);
      });
    });
    ctx.restore();
  }
};

// =====================================================================
// TIPOS DE GRÁFICO
// =====================================================================

// Rosca (rosquinha): boa para poucas categorias (sexo, raça/cor, empresa)
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
          labels: { usePointStyle: true, padding: 14, color: COR_TEXTO }
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
            title: function (itens) { return itens[0].label; },
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

// Colunas lado a lado: sexo por nível hierárquico
function desenharColunasPorNivel(idCanvas, json) {
  const lista = json.dados;

  // Descobre os níveis e organiza na ordem certa
  const niveis = [];
  lista.forEach(function (item) {
    if (niveis.indexOf(item.nivel_hierarquico) === -1) {
      niveis.push(item.nivel_hierarquico);
    }
  });
  niveis.sort(function (a, b) { return pesoNivel(a) - pesoNivel(b); });

  // Soma por nível e sexo. Nível sem um dos sexos fica com zero.
  const masculino = niveis.map(function () { return 0; });
  const feminino = niveis.map(function () { return 0; });
  lista.forEach(function (item) {
    const posicao = niveis.indexOf(item.nivel_hierarquico);
    if (String(item.sexo).toLowerCase().charAt(0) === "m") {
      masculino[posicao] += item.quantidade;
    } else {
      feminino[posicao] += item.quantidade;
    }
  });

  new Chart(document.getElementById(idCanvas), {
    type: "bar",
    data: {
      labels: niveis.map(nomeNivel),
      datasets: [
        {
          label: "Masculino",
          data: masculino,
          backgroundColor: COR_DESTAQUE,
          borderRadius: 6,
          maxBarThickness: 44
        },
        {
          label: "Feminino",
          data: feminino,
          backgroundColor: COR_CLARA,
          borderRadius: 6,
          maxBarThickness: 44
        }
      ]
    },
    options: {
      layout: { padding: { top: 24 } },
      interaction: { mode: "index", intersect: false },
      plugins: {
        // Legenda centralizada embaixo do gráfico, longe dos números das colunas
        legend: {
          position: "bottom",
          align: "center",
          labels: { usePointStyle: true, padding: 16, color: COR_TEXTO }
        },
        tooltip: {
          callbacks: {
            label: function (item) {
              const i = item.dataIndex;
              const totalNivel = masculino[i] + feminino[i];
              return " " + item.dataset.label + ": " + item.parsed.y +
                " (" + percentual(item.parsed.y, totalNivel) + "% do nível)";
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: COR_TEXTO,
            autoSkip: false,
            callback: function (valor) {
              return quebrarTexto(this.getLabelForValue(valor), 12);
            }
          }
        },
        // "grace" dá uma folga em cima para o número da coluna mais alta não ser cortado
        y: { display: false, beginAtZero: true, grace: "12%" }
      }
    },
    plugins: [pluginValorNaColuna]
  });
}

// Pirâmide etária: masculino para a esquerda, feminino para a direita
function desenharPiramide(idCanvas, json) {
  const lista = json.dados;

  // Descobre as faixas (gerações) e organiza da mais velha para a mais nova
  const faixas = [];
  lista.forEach(function (item) {
    if (faixas.indexOf(item.faixa_etaria) === -1) {
      faixas.push(item.faixa_etaria);
    }
  });
  faixas.sort(function (a, b) { return pesoGeracao(a) - pesoGeracao(b); });

  // Soma por faixa e sexo. Faixa sem um dos sexos fica com zero.
  const masculino = faixas.map(function () { return 0; });
  const feminino = faixas.map(function () { return 0; });
  lista.forEach(function (item) {
    const posicao = faixas.indexOf(item.faixa_etaria);
    if (String(item.sexo).toLowerCase().charAt(0) === "m") {
      masculino[posicao] += item.quantidade;
    } else {
      feminino[posicao] += item.quantidade;
    }
  });

  // Limite igual dos dois lados, para a pirâmide ficar simétrica
  const maior = Math.max.apply(null, masculino.concat(feminino));
  const limite = Math.ceil(maior * 1.1);

  new Chart(document.getElementById(idCanvas), {
    type: "bar",
    data: {
      labels: faixas,
      datasets: [
        {
          label: "Masculino",
          data: masculino.map(function (v) { return -v; }),
          backgroundColor: COR_DESTAQUE,
          borderRadius: 6,
          maxBarThickness: 64
        },
        {
          label: "Feminino",
          data: feminino,
          backgroundColor: COR_CLARA,
          borderRadius: 6,
          maxBarThickness: 64
        }
      ]
    },
    options: {
      indexAxis: "y",
      interaction: { mode: "index", axis: "y", intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: { usePointStyle: true, padding: 16, color: COR_TEXTO }
        },
        tooltip: {
          callbacks: {
            label: function (item) {
              return " " + item.dataset.label + ": " + Math.abs(item.parsed.x);
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          min: -limite,
          max: limite,
          grid: { color: COR_BORDA },
          border: { display: false },
          ticks: {
            callback: function (valor) { return Math.abs(valor); }
          }
        },
        y: {
          stacked: true,
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: COR_TEXTO,
            autoSkip: false,
            // O nome da geração quebra em duas linhas, em vez de ser cortado
            callback: function (valor) {
              return quebrarTexto(this.getLabelForValue(valor), 14);
            }
          }
        }
      }
    },
    plugins: [pluginValorPiramide]
  });
}

// Evolução mensal: linha com área preenchida
function desenharEvolucao(idCanvas, json) {
  const lista = json.dados;

  new Chart(document.getElementById(idCanvas), {
    type: "line",
    data: {
      labels: lista.map(function (item) { return rotuloMes(item.mes); }),
      datasets: [{
        label: "Empregados ativos",
        data: lista.map(function (item) { return item.quantidade; }),
        borderColor: COR_DESTAQUE,
        backgroundColor: "rgba(255, 122, 26, 0.15)",
        borderWidth: 3,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: COR_DESTAQUE
      }]
    },
    options: {
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (item) { return " " + item.parsed.y + " empregados ativos"; }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            // Mostra só o ano, uma vez por ano (no mês de janeiro)
            callback: function (valor, indice) {
              const mes = String(lista[indice].mes);
              return mes.substring(5, 7) === "01" ? mes.substring(0, 4) : "";
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: COR_BORDA },
          border: { display: false }
        }
      }
    }
  });
}

// Ativos e liderança por área: uma barra por área, dividida em líderes (laranja)
// e demais (cinza). O comprimento total da barra é o total de ativos da área.
function desenharLideranca(idCanvas, json) {
  const lista = json.dados;

  new Chart(document.getElementById(idCanvas), {
    type: "bar",
    data: {
      labels: lista.map(function (item) { return item.categoria; }),
      datasets: [
        {
          label: "Líderes",
          data: lista.map(function (item) { return item.lideres; }),
          backgroundColor: COR_DESTAQUE,
          borderRadius: 4,
          maxBarThickness: 30
        },
        {
          label: "Demais",
          data: lista.map(function (item) { return item.total - item.lideres; }),
          backgroundColor: "#3a3a46",
          borderRadius: 4,
          maxBarThickness: 30
        }
      ]
    },
    options: {
      indexAxis: "y",
      // Espaço à direita para o número do total, escrito pelo carimbo
      layout: { padding: { right: 40 } },
      interaction: { mode: "index", axis: "y", intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: { usePointStyle: true, padding: 16, color: COR_TEXTO }
        },
        tooltip: {
          callbacks: {
            title: function (itens) { return itens[0].label; },
            label: function (item) { return " " + item.dataset.label + ": " + item.parsed.x; },
            footer: function (itens) {
              const linha = lista[itens[0].dataIndex];
              return "Total na área: " + linha.total + " (" + percentual(linha.lideres, linha.total) + "% líderes)";
            }
          }
        }
      },
      scales: {
        // Eixo de números escondido: o total já aparece no fim de cada barra
        x: { display: false, stacked: true, beginAtZero: true },
        y: {
          stacked: true,
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: COR_TEXTO,
            autoSkip: false,
            callback: function (valor) {
              return quebrarTexto(this.getLabelForValue(valor), 16);
            }
          }
        }
      }
    },
    plugins: [pluginValoresLideranca]
  });
}

// Matriz com mapa de calor: níveis nas linhas, formações nas colunas.
// A cor de cada célula mostra a % dentro do nível (o número é a quantidade).
// É uma tabela HTML (não usa a Chart.js) e os textos entram por textContent,
// o que impede que um texto vindo do JSON seja interpretado como código.
function desenharMatrizCalor(idContainer, json) {
  const lista = json.dados;
  const niveis = [];
  const formacoes = [];
  const valores = {};

  lista.forEach(function (item) {
    if (niveis.indexOf(item.nivel_hierarquico) === -1) {
      niveis.push(item.nivel_hierarquico);
    }
    if (formacoes.indexOf(item.formacao_academica) === -1) {
      formacoes.push(item.formacao_academica);
    }
    valores[item.nivel_hierarquico + "|" + item.formacao_academica] = item.quantidade;
  });

  niveis.sort(function (a, b) { return pesoNivel(a) - pesoNivel(b); });
  formacoes.sort(function (a, b) { return pesoFormacao(a) - pesoFormacao(b); });

  const container = document.getElementById(idContainer);
  container.textContent = "";

  const tabela = document.createElement("table");
  tabela.className = "matriz";

  // Cabeçalho: uma coluna por formação + uma coluna de total
  const cabecalho = document.createElement("thead");
  const linhaCabecalho = document.createElement("tr");
  linhaCabecalho.appendChild(document.createElement("th"));
  formacoes.forEach(function (formacao) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = formacao;
    linhaCabecalho.appendChild(th);
  });
  const thTotal = document.createElement("th");
  thTotal.scope = "col";
  thTotal.textContent = "Total";
  linhaCabecalho.appendChild(thTotal);
  cabecalho.appendChild(linhaCabecalho);
  tabela.appendChild(cabecalho);

  // Corpo: uma linha por nível
  const corpo = document.createElement("tbody");
  niveis.forEach(function (nivel) {
    const totalNivel = formacoes.reduce(function (soma, formacao) {
      return soma + (valores[nivel + "|" + formacao] || 0);
    }, 0);

    const linha = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = nomeNivel(nivel);
    linha.appendChild(th);

    formacoes.forEach(function (formacao) {
      const quantidade = valores[nivel + "|" + formacao] || 0;
      const proporcao = totalNivel > 0 ? quantidade / totalNivel : 0;
      const td = document.createElement("td");

      if (quantidade === 0) {
        td.className = "zero";
        td.textContent = "–";
      } else {
        const intensidade = 0.12 + 0.88 * proporcao;
        td.style.background = "rgba(255, 122, 26, " + intensidade.toFixed(2) + ")";
        td.style.color = intensidade > 0.55 ? COR_FUNDO : COR_TEXTO;
        td.textContent = quantidade;
        td.title = nomeNivel(nivel) + " · " + formacao + ": " + quantidade +
          " (" + percentual(quantidade, totalNivel) + "% do nível)";
      }
      linha.appendChild(td);
    });

    const tdTotal = document.createElement("td");
    tdTotal.className = "total";
    tdTotal.textContent = totalNivel;
    linha.appendChild(tdTotal);

    corpo.appendChild(linha);
  });
  tabela.appendChild(corpo);

  container.appendChild(tabela);
}

// =====================================================================
// MAPA DO BRASIL (círculos de densidade)
// =====================================================================
// O mapa é um desenho SVG montado aqui mesmo, sem biblioteca:
// 1) o contorno dos estados vem do arquivo brasil_estados.geojson;
// 2) cada município vira um círculo cuja ÁREA é proporcional à quantidade;
// 3) todos os textos entram por textContent (nada de innerHTML).

// Cria um elemento SVG com os atributos dados
function criarSVG(nome, atributos) {
  const elemento = document.createElementNS(NS_SVG, nome);
  Object.keys(atributos || {}).forEach(function (chave) {
    elemento.setAttribute(chave, atributos[chave]);
  });
  return elemento;
}

function desenharMapa(container, listaRanking, geojson, jsonMunicipios) {
  const cidades = jsonMunicipios.dados.slice().sort(function (a, b) {
    return b.quantidade - a.quantidade;
  });
  if (cidades.length === 0) {
    throw new Error("O arquivo municipio_mapa.json veio vazio");
  }
  const total = somar(cidades);
  const maximo = cidades[0].quantidade;

  // 1) Separa o contorno em estados; cada estado é uma lista de "anéis" (linhas fechadas)
  const estados = [];
  const feicoes = geojson.type === "FeatureCollection" ? geojson.features : [geojson];
  feicoes.forEach(function (feicao) {
    const geometria = feicao.geometry || feicao;
    const aneis = [];
    if (geometria.type === "Polygon") {
      geometria.coordinates.forEach(function (anel) { aneis.push(anel); });
    } else if (geometria.type === "MultiPolygon") {
      geometria.coordinates.forEach(function (poligono) {
        poligono.forEach(function (anel) { aneis.push(anel); });
      });
    }
    if (aneis.length > 0) {
      estados.push(aneis);
    }
  });
  if (estados.length === 0) {
    throw new Error("O contorno do mapa não tem polígonos");
  }

  // 2) Descobre os limites do Brasil (para enquadrar o desenho)
  let lonMin = Infinity;
  let lonMax = -Infinity;
  let latMin = Infinity;
  let latMax = -Infinity;
  estados.forEach(function (aneis) {
    aneis.forEach(function (anel) {
      anel.forEach(function (ponto) {
        if (ponto[0] < lonMin) lonMin = ponto[0];
        if (ponto[0] > lonMax) lonMax = ponto[0];
        if (ponto[1] < latMin) latMin = ponto[1];
        if (ponto[1] > latMax) latMax = ponto[1];
      });
    });
  });

  // 3) Projeção: transforma latitude/longitude em posição no desenho.
  // O "fator" corrige o fato de que, longe do equador, um grau de longitude é mais curto.
  const fator = Math.cos(((latMin + latMax) / 2) * Math.PI / 180);
  const escala = 1000 / ((lonMax - lonMin) * fator);
  const margem = 20;
  const largura = 1000 + 2 * margem;
  const altura = (latMax - latMin) * escala + 2 * margem;

  function posX(lon) { return margem + (lon - lonMin) * fator * escala; }
  function posY(lat) { return margem + (latMax - lat) * escala; }

  // Raio do círculo: a área cresce com a quantidade (por isso a raiz quadrada)
  const RAIO_MAXIMO = 70;
  const RAIO_MINIMO = 6;
  function raio(quantidade) {
    return Math.max(RAIO_MINIMO, RAIO_MAXIMO * Math.sqrt(quantidade / maximo));
  }

  // 4) Monta o SVG
  container.textContent = "";
  const svg = criarSVG("svg", {
    viewBox: "0 0 " + largura.toFixed(0) + " " + altura.toFixed(0),
    role: "img",
    "aria-label": "Mapa do Brasil com círculos proporcionais ao número de empregados ativos por município de nascimento",
    class: "mapa-svg"
  });

  // Gradiente dos círculos: centro claro, bordas laranja translúcidas
  const defs = criarSVG("defs");
  const gradiente = criarSVG("radialGradient", { id: "grad-bolha" });
  [
    ["0%", "#fff1e0", "1"],
    ["30%", "#ffb27a", "0.95"],
    ["65%", "#ff7a1a", "0.7"],
    ["100%", "#ff7a1a", "0.35"]
  ].forEach(function (parada) {
    gradiente.appendChild(criarSVG("stop", {
      offset: parada[0],
      "stop-color": parada[1],
      "stop-opacity": parada[2]
    }));
  });
  defs.appendChild(gradiente);
  svg.appendChild(defs);

  // Contorno dos estados
  estados.forEach(function (aneis) {
    const caminho = aneis.map(function (anel) {
      return "M" + anel.map(function (ponto) {
        return posX(ponto[0]).toFixed(1) + " " + posY(ponto[1]).toFixed(1);
      }).join("L") + "Z";
    }).join("");
    svg.appendChild(criarSVG("path", {
      d: caminho,
      class: "mapa-estado",
      "fill-rule": "evenodd"
    }));
  });

  // Caixinha que aparece ao passar o mouse
  const dica = document.createElement("div");
  dica.className = "mapa-dica";

  // Círculos (do maior para o menor, para os pequenos ficarem por cima)
  cidades.forEach(function (cidade) {
    const circulo = criarSVG("circle", {
      cx: posX(Number(cidade.longitude)).toFixed(1),
      cy: posY(Number(cidade.latitude)).toFixed(1),
      r: raio(cidade.quantidade).toFixed(1),
      fill: "url(#grad-bolha)",
      class: "mapa-bolha"
    });

    const texto = cidade.municipio + " · " + cidade.quantidade +
      (cidade.quantidade === 1 ? " pessoa" : " pessoas") +
      " (" + formatarNumero((cidade.quantidade / total) * 100, 1) + "%)";

    circulo.addEventListener("mouseenter", function () {
      dica.textContent = texto;
      dica.classList.add("visivel");
    });
    circulo.addEventListener("mousemove", function (evento) {
      const caixa = container.getBoundingClientRect();
      dica.style.left = (evento.clientX - caixa.left + 14) + "px";
      dica.style.top = (evento.clientY - caixa.top + 14) + "px";
    });
    circulo.addEventListener("mouseleave", function () {
      dica.classList.remove("visivel");
    });

    svg.appendChild(circulo);
  });

  // Legenda de tamanhos, no canto inferior esquerdo (área vazia do mapa)
  const valoresLegenda = [];
  [maximo, Math.round(maximo / 3), Math.max(1, Math.round(maximo / 10))].forEach(function (valor) {
    if (valoresLegenda.indexOf(valor) === -1) {
      valoresLegenda.push(valor);
    }
  });
  const raioGrande = raio(maximo);
  const centroX = margem + 10 + raioGrande;
  const baseY = altura - margem - 10;

  const tituloLegenda = criarSVG("text", {
    x: margem + 10,
    y: (baseY - 2 * raioGrande - 18).toFixed(1),
    class: "mapa-legenda-titulo"
  });
  tituloLegenda.textContent = "Pessoas";
  svg.appendChild(tituloLegenda);

  valoresLegenda.forEach(function (valor) {
    const r = raio(valor);
    const centroY = baseY - r;
    svg.appendChild(criarSVG("circle", {
      cx: centroX.toFixed(1),
      cy: centroY.toFixed(1),
      r: r.toFixed(1),
      class: "mapa-legenda-circulo"
    }));
    svg.appendChild(criarSVG("line", {
      x1: centroX.toFixed(1),
      y1: (centroY - r).toFixed(1),
      x2: (centroX + raioGrande + 16).toFixed(1),
      y2: (centroY - r).toFixed(1),
      class: "mapa-legenda-linha"
    }));
    const rotulo = criarSVG("text", {
      x: (centroX + raioGrande + 22).toFixed(1),
      y: (centroY - r + 11).toFixed(1),
      class: "mapa-legenda-texto"
    });
    rotulo.textContent = valor;
    svg.appendChild(rotulo);
  });

  container.appendChild(svg);
  container.appendChild(dica);

  // 5) Lista dos 5 municípios com mais empregados
  listaRanking.textContent = "";
  cidades.slice(0, 5).forEach(function (cidade) {
    const item = document.createElement("li");

    const nome = document.createElement("span");
    nome.className = "ranking-nome";
    nome.textContent = cidade.municipio;

    const valor = document.createElement("span");
    valor.className = "ranking-valor";
    valor.textContent = cidade.quantidade + " · " +
      formatarNumero((cidade.quantidade / total) * 100, 1) + "%";

    item.appendChild(nome);
    item.appendChild(valor);
    listaRanking.appendChild(item);
  });
}

// Lê o contorno e os municípios e desenha o mapa
async function montarMapa() {
  const caixa = document.getElementById("mapa-brasil");
  const ranking = document.getElementById("ranking-municipios");
  try {
    const resultados = await Promise.all([
      carregarGeoJSON("brasil_estados"),
      carregarJSON("municipio_mapa")
    ]);
    desenharMapa(caixa, ranking, resultados[0], resultados[1]);
  } catch (erro) {
    caixa.textContent = "Não consegui montar o mapa.";
    console.error("Falha no mapa:", erro);
  }
}

// =====================================================================
// NÚMEROS GRANDES E SELO
// =====================================================================

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

// % PCD: mostra o percentual sobre os ativos e quantas pessoas são
async function montarNumeroPCD() {
  const caixaValor = document.getElementById("numero-pcd");
  const caixaDetalhe = document.getElementById("detalhe-pcd");
  try {
    const resultados = await Promise.all([
      carregarJSON("pcd_total"),
      carregarJSON("empregados_ativos")
    ]);
    const pcd = Number(resultados[0].dados.valor);
    const ativos = Number(resultados[1].dados.valor);

    caixaValor.textContent = formatarNumero((pcd / ativos) * 100, 1) + "%";
    caixaDetalhe.textContent = pcd + " de " + ativos + " ativos";
  } catch (erro) {
    caixaValor.textContent = "erro";
    console.error("Falha no número de PCD:", erro);
  }
}

// Número com unidade ao lado (média de idade, tempo médio de casa).
// O JSON traz {valor, unidade}.
async function montarNumeroComUnidade(idValor, nomeJson) {
  const caixaValor = document.getElementById(idValor);
  try {
    const json = await carregarJSON(nomeJson);

    caixaValor.textContent = formatarNumero(json.dados.valor, 1);

    const spanUnidade = document.createElement("span");
    spanUnidade.className = "numero-unidade";
    spanUnidade.textContent = json.dados.unidade || "";
    caixaValor.appendChild(spanUnidade);
  } catch (erro) {
    caixaValor.textContent = "erro";
    console.error("Falha em " + nomeJson + ":", erro);
  }
}

// Selo "% mulheres na liderança"
async function montarSeloMulheres() {
  const caixa = document.getElementById("numero-mulheres-lideranca");
  try {
    const json = await carregarJSON("mulheres_lideranca");
    caixa.textContent = formatarNumero(json.dados.valor, 1) + (json.dados.unidade || "");
  } catch (erro) {
    caixa.textContent = "erro";
    console.error("Falha no selo de mulheres na liderança:", erro);
  }
}

// =====================================================================
// MONTAGEM DO PAINEL
// =====================================================================

// Lê o JSON e desenha o gráfico. Se um falhar, os outros continuam.
async function montarGrafico(nomeJson, idDestino, desenhar) {
  try {
    const json = await carregarJSON(nomeJson);
    desenhar(idDestino, json);
  } catch (erro) {
    console.error("Falha no gráfico " + idDestino + ":", erro);
  }
}

async function iniciar() {
  // Números, selo, matriz e mapa (não dependem da Chart.js)
  montarAbertura();
  montarNumeroPCD();
  montarNumeroComUnidade("numero-idade", "media_idade");
  montarNumeroComUnidade("numero-tempo-casa", "tempo_medio_casa");
  montarSeloMulheres();
  montarGrafico("formacao_por_nivel", "matriz-formacao", desenharMatrizCalor);
  montarMapa();

  try {
    await prepararFontes();
    configurarChartJS();
  } catch (erro) {
    console.error(erro);
    return;
  }

  // Tela 1: visão geral e diversidade
  montarGrafico("distribuicao_sexo", "grafico-sexo", desenharRosca);
  montarGrafico("distribuicao_raca_cor", "grafico-raca", desenharRosca);
  montarGrafico("sexo_por_nivel", "grafico-sexo-nivel", desenharColunasPorNivel);
  montarGrafico("evolucao_mensal", "grafico-evolucao", desenharEvolucao);

  // Tela 2: perfil demográfico
  montarGrafico("piramide_etaria", "grafico-piramide", desenharPiramide);

  // Estrutura organizacional
  montarGrafico("ativo_por_empresa", "grafico-empresa", desenharRosca);
  montarGrafico("ativo_por_diretoria", "grafico-diretoria", desenharBarras);
  montarGrafico("lideranca_por_area", "grafico-lideranca", desenharLideranca);
  montarGrafico("pcd_por_area", "grafico-pcd-area", desenharBarras);

  // Outros recortes
  montarGrafico("estado_civil", "grafico-estado-civil", desenharBarras);
  montarGrafico("formacao_academica", "grafico-formacao", desenharBarras);
  montarGrafico("vinculo_empregaticio", "grafico-vinculo", desenharBarras);
}

iniciar();