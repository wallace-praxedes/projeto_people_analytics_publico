// =====================================================================
// FILTROS DO PAINEL (Etapa 8)
// =====================================================================
// Como funciona: a cada escolha de filtro, o navegador pede UM arquivo
// pronto da pasta dados/filtros/ (o backend já calculou todas as
// combinações). O nome do arquivo é montado só com os códigos que estão
// na lista de opções, nunca com texto digitado. Depois, redesenhamos o
// painel inteiro com os números daquele arquivo, com uma transição:
// o conteúdo escurece, é trocado e volta repetindo a animação de entrada.
//
// Usa as funções do principal.js (desenharRosca, desenharBarras, etc.).
(function () {
  "use strict";

  const PASTA_FILTROS = "dados/filtros/";
  const ID_VALIDO = /^[a-z0-9-]+$/;
  const TEXTO_SEM_DADOS = "Sem dados para esta seleção";
  const TEXTO_PROTEGIDO = "Dados protegidos: grupo muito pequeno";

  // Gráficos de rosca (revelados como um círculo que se abre)
  const ROSCAS = ["grafico-sexo", "grafico-raca", "grafico-empresa"];

  // Números que contam do zero a cada troca de filtro
  const IDS_NUMEROS = [
    "numero-ativos",
    "numero-pcd",
    "numero-idade",
    "numero-tempo-casa",
    "numero-mulheres-lideranca"
  ];

  // O que escurece e volta durante a troca de filtro
  const ALVOS_TRANSICAO = ".painel .grade, #numero-ativos";

  // Sem GSAP, ou com "reduzir movimento" ativado no sistema, a troca é instantânea
  const PODE_ANIMAR = typeof gsap !== "undefined" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const selectEmpresa = document.getElementById("filtro-empresa");
  const selectCentro = document.getElementById("filtro-centro");
  const selectGerencia = document.getElementById("filtro-gerencia");
  const botaoLimpar = document.getElementById("filtro-limpar");
  const status = document.getElementById("filtros-status");
  const painel = document.querySelector(".painel");

  if (!selectEmpresa || !selectCentro || !selectGerencia || !painel) {
    return;
  }

  const cache = {};
  let geojsonMapa = null;
  let pedido = 0;

  // ---------------------------------------------------------------
  // Ajudantes
  // ---------------------------------------------------------------
  function definirStatus(texto) {
    if (status) {
      status.textContent = texto;
    }
  }

  function numeroOuNulo(dados) {
    if (dados && dados.valor !== null && dados.valor !== undefined) {
      return Number(dados.valor);
    }
    return null;
  }

  async function carregarArquivo(nome) {
    if (cache[nome]) {
      return cache[nome];
    }
    const resposta = await fetch(PASTA_FILTROS + nome + ".json");
    if (!resposta.ok) {
      throw new Error("Não achei " + PASTA_FILTROS + nome + ".json (código " + resposta.status + ")");
    }
    const json = await resposta.json();
    cache[nome] = json;
    return json;
  }

  // ---------------------------------------------------------------
  // Números e selo
  // ---------------------------------------------------------------
  function numeroComUnidade(id, dados) {
    const caixa = document.getElementById(id);
    if (!caixa) {
      return;
    }
    const valor = numeroOuNulo(dados);
    if (valor === null) {
      caixa.textContent = "—";
      return;
    }
    caixa.textContent = formatarNumero(valor, 1);
    const span = document.createElement("span");
    span.className = "numero-unidade";
    span.textContent = (dados && dados.unidade) || "";
    caixa.appendChild(span);
  }

  function renderizarNumeros(ind, motivo) {
    // Abertura
    const ativos = numeroOuNulo(ind.empregados_ativos);
    const abertura = document.getElementById("numero-ativos");
    if (abertura) {
      abertura.textContent = ativos !== null ? String(ativos) : (motivo === "sem_ativos" ? "0" : "—");
    }

    // % PCD
    const pcd = numeroOuNulo(ind.pcd_total);
    const caixaPcd = document.getElementById("numero-pcd");
    const detalhePcd = document.getElementById("detalhe-pcd");
    if (pcd !== null && ativos) {
      caixaPcd.textContent = formatarNumero((pcd / ativos) * 100, 1) + "%";
      detalhePcd.textContent = pcd + " de " + ativos + " ativos";
    } else {
      caixaPcd.textContent = "—";
      detalhePcd.textContent = "";
    }

    // Média de idade e tempo médio de casa
    numeroComUnidade("numero-idade", ind.media_idade);
    numeroComUnidade("numero-tempo-casa", ind.tempo_medio_casa);

    // Selo "mulheres na liderança"
    const selo = document.getElementById("numero-mulheres-lideranca");
    const mulheres = numeroOuNulo(ind.mulheres_lideranca);
    if (selo) {
      selo.textContent = mulheres !== null
        ? formatarNumero(mulheres, 1) + ((ind.mulheres_lideranca && ind.mulheres_lideranca.unidade) || "")
        : "—";
    }
  }

  // ---------------------------------------------------------------
  // Gráficos da Chart.js
  // ---------------------------------------------------------------
  function marcarSemDados(idCanvas, vazio, texto) {
    const canvas = document.getElementById(idCanvas);
    if (!canvas) {
      return;
    }
    const area = canvas.parentElement;
    let aviso = area.querySelector(".sem-dados");

    if (!vazio) {
      if (aviso) {
        aviso.remove();
      }
      return;
    }
    if (!aviso) {
      aviso = document.createElement("div");
      aviso.className = "sem-dados";
      area.appendChild(aviso);
    }
    aviso.textContent = texto;
  }

  function renderizarGraficos(ind, textoVazio) {
    if (typeof Chart === "undefined") {
      return;
    }

    const lista = [
      ["distribuicao_sexo", "grafico-sexo", desenharRosca],
      ["distribuicao_raca_cor", "grafico-raca", desenharRosca],
      ["sexo_por_nivel", "grafico-sexo-nivel", desenharColunasPorNivel],
      ["evolucao_mensal", "grafico-evolucao", desenharEvolucao],
      ["piramide_etaria", "grafico-piramide", desenharPiramide],
      ["ativo_por_empresa", "grafico-empresa", desenharRosca],
      ["ativo_por_diretoria", "grafico-diretoria", desenharBarras],
      ["lideranca_por_area", "grafico-lideranca", desenharLideranca],
      ["pcd_por_area", "grafico-pcd-area", desenharBarras],
      ["estado_civil", "grafico-estado-civil", desenharBarras],
      ["formacao_academica", "grafico-formacao", desenharBarras],
      ["vinculo_empregaticio", "grafico-vinculo", desenharBarras]
    ];

    lista.forEach(function (item) {
      const idCanvas = item[1];
      const dados = ind[item[0]];
      try {
        // Apaga o gráfico antigo antes de desenhar o novo no mesmo lugar
        const anterior = Chart.getChart(idCanvas);
        if (anterior) {
          anterior.destroy();
        }
        const vazio = !Array.isArray(dados) || dados.length === 0;
        marcarSemDados(idCanvas, vazio, textoVazio);
        if (!vazio) {
          item[2](idCanvas, { dados: dados });
        }
      } catch (erro) {
        console.error("Falha ao atualizar " + idCanvas + ":", erro);
      }
    });
  }

  // ---------------------------------------------------------------
  // Matriz de calor e mapa
  // ---------------------------------------------------------------
  function mostrarAvisoEm(container, texto) {
    container.textContent = "";
    const aviso = document.createElement("div");
    aviso.className = "sem-dados";
    aviso.textContent = texto;
    container.appendChild(aviso);
  }

  function renderizarMatriz(dados, textoVazio) {
    const container = document.getElementById("matriz-formacao");
    if (!container) {
      return;
    }
    try {
      if (!Array.isArray(dados) || dados.length === 0) {
        mostrarAvisoEm(container, textoVazio);
        return;
      }
      desenharMatrizCalor("matriz-formacao", { dados: dados });
    } catch (erro) {
      console.error("Falha ao atualizar a matriz:", erro);
    }
  }

  async function renderizarMapa(dados, textoVazio) {
    const caixa = document.getElementById("mapa-brasil");
    const ranking = document.getElementById("ranking-municipios");
    if (!caixa || !ranking) {
      return;
    }
    try {
      if (!Array.isArray(dados) || dados.length === 0) {
        mostrarAvisoEm(caixa, textoVazio);
        ranking.textContent = "";
        return;
      }
      if (!geojsonMapa) {
        geojsonMapa = await carregarGeoJSON("brasil_estados");
      }
      desenharMapa(caixa, ranking, geojsonMapa, { dados: dados });
    } catch (erro) {
      console.error("Falha ao atualizar o mapa:", erro);
    }
  }

  // ---------------------------------------------------------------
  // Transição: sai de cena, troca o conteúdo e volta com a entrada
  // ---------------------------------------------------------------

  // Só anima o que está visível na tela agora
  function naTela(elemento) {
    const caixa = elemento.getBoundingClientRect();
    return caixa.bottom > 0 && caixa.top < window.innerHeight;
  }

  // Faz o número "contar" de zero até o valor, mantendo vírgula, casas
  // decimais e sufixo (ex.: "3,6%"). A unidade ("anos"), que fica num
  // <span> à parte, não é tocada.
  function contarAte(elemento, duracao) {
    const no = elemento.firstChild;
    if (!no || no.nodeType !== 3) {
      return;
    }

    const original = no.nodeValue;
    const partes = original.match(/^(\d[\d.,]*)(.*)$/);
    if (!partes) {
      return;
    }

    const casas = (partes[1].split(",")[1] || "").length;
    const alvo = parseFloat(partes[1].replace(/\./g, "").replace(",", "."));
    const sufixo = partes[2];
    const contador = { v: 0 };

    no.nodeValue = formatarNumero(0, casas) + sufixo;
    gsap.to(contador, {
      v: alvo,
      duration: duracao,
      ease: "power2.out",
      onUpdate: function () {
        no.nodeValue = formatarNumero(contador.v, casas) + sufixo;
      },
      onComplete: function () {
        no.nodeValue = original;
      }
    });
  }

  // Cada tipo de gráfico é revelado de um jeito (máscara que se abre)
  function revelarGrafico(area, id) {
    let de = "inset(0% 100% 0% 0%)";   // barras: da esquerda para a direita
    let para = "inset(0% 0% 0% 0%)";

    if (ROSCAS.indexOf(id) !== -1) {
      de = "circle(0% at 50% 45%)";    // rosca: círculo que se abre
      para = "circle(80% at 50% 45%)";
    } else if (id === "grafico-piramide") {
      de = "inset(0% 50% 0% 50%)";     // pirâmide: abre do centro para fora
    } else if (id === "grafico-sexo-nivel") {
      de = "inset(100% 0% 0% 0%)";     // colunas: crescem de baixo para cima
    }

    gsap.fromTo(area,
      { clipPath: de },
      {
        clipPath: para,
        duration: 0.9,
        ease: "power2.out",
        overwrite: "auto",
        clearProps: "clipPath"
      }
    );
  }

  function revelarMapa() {
    const caixa = document.getElementById("mapa-brasil");
    if (!caixa || !naTela(caixa)) {
      return;
    }
    const bolhas = caixa.querySelectorAll(".mapa-bolha");
    if (bolhas.length === 0) {
      return;
    }

    gsap.from(caixa.querySelectorAll(".mapa-estado"), {
      opacity: 0,
      duration: 0.4,
      stagger: { amount: 0.5 },
      ease: "power1.out"
    });
    gsap.from(bolhas, {
      scale: 0,
      transformOrigin: "50% 50%",
      duration: 0.7,
      delay: 0.25,
      stagger: { amount: 0.7 },
      ease: "back.out(1.8)",
      clearProps: "transform"
    });
    gsap.from(caixa.querySelectorAll(
      ".mapa-legenda-circulo, .mapa-legenda-linha, .mapa-legenda-texto, .mapa-legenda-titulo"
    ), { opacity: 0, duration: 0.5, delay: 0.8 });
    gsap.from(document.querySelectorAll("#ranking-municipios li"), {
      opacity: 0,
      x: -20,
      duration: 0.4,
      delay: 0.5,
      stagger: 0.08,
      ease: "power2.out"
    });
  }

  function revelarMatriz() {
    const container = document.getElementById("matriz-formacao");
    if (!container || !naTela(container)) {
      return;
    }
    const celulas = container.querySelectorAll("td, th");
    if (celulas.length === 0) {
      return;
    }
    gsap.from(celulas, {
      opacity: 0,
      y: 12,
      duration: 0.4,
      stagger: { amount: 0.6 },
      ease: "power2.out",
      clearProps: "transform"
    });
  }

  function revelarConteudo() {
    IDS_NUMEROS.forEach(function (id) {
      const elemento = document.getElementById(id);
      if (elemento && naTela(elemento)) {
        contarAte(elemento, 1.0);
      }
    });

    document.querySelectorAll(".grafico-area").forEach(function (area) {
      const canvas = area.querySelector("canvas");
      if (canvas && naTela(area)) {
        revelarGrafico(area, canvas.id);
      }
    });

    revelarMapa();
    revelarMatriz();
  }

  // 1) O painel escurece rapidamente. Devolve uma promessa que se cumpre
  //    quando o escurecimento termina.
  function sairDeCena() {
    if (!PODE_ANIMAR) {
      return Promise.resolve();
    }
    return new Promise(function (resolver) {
      gsap.to(ALVOS_TRANSICAO, {
        opacity: 0.12,
        duration: 0.2,
        ease: "power1.in",
        overwrite: "auto",
        onComplete: resolver
      });
    });
  }

  // 3) O painel volta e, se der tudo certo, repete a animação de entrada
  function entrarEmCena(revelar) {
    if (!PODE_ANIMAR) {
      return;
    }
    gsap.to(ALVOS_TRANSICAO, {
      opacity: 1,
      duration: 0.5,
      ease: "power2.out",
      overwrite: "auto",
      clearProps: "opacity"
    });
    if (revelar) {
      revelarConteudo();
    }
  }

  // ---------------------------------------------------------------
  // Atualização do painel inteiro
  // ---------------------------------------------------------------
  async function renderizar(pacote) {
    const ind = pacote.indicadores || {};
    const textoVazio = pacote.motivo === "grupo_pequeno" ? TEXTO_PROTEGIDO : TEXTO_SEM_DADOS;

    renderizarNumeros(ind, pacote.motivo);
    renderizarGraficos(ind, textoVazio);
    renderizarMatriz(ind.formacao_por_nivel, textoVazio);
    await renderizarMapa(ind.municipio_mapa, textoVazio);
  }

  function marcarFiltrosAtivos() {
    let algum = false;
    [selectEmpresa, selectCentro, selectGerencia].forEach(function (select) {
      const ativo = select.value !== "todos";
      select.parentElement.classList.toggle("ativo", ativo);
      if (ativo) {
        algum = true;
      }
    });
    if (botaoLimpar) {
      botaoLimpar.disabled = !algum;
    }
    return algum;
  }

  async function atualizar() {
    const valores = [selectEmpresa.value, selectCentro.value, selectGerencia.value];
    const valido = valores.every(function (v) { return ID_VALIDO.test(v); });
    if (!valido) {
      return;
    }

    const minhaVez = ++pedido;
    const algumFiltro = marcarFiltrosAtivos();
    painel.classList.add("atualizando");

    // O painel escurece enquanto o arquivo novo é lido
    const saida = sairDeCena();

    try {
      const resultados = await Promise.all([carregarArquivo(valores.join("__")), saida]);
      const pacote = resultados[0];
      if (minhaVez !== pedido) {
        return;
      }

      await renderizar(pacote);

      // Mensagem de status
      const ativos = numeroOuNulo((pacote.indicadores || {}).empregados_ativos);
      if (!algumFiltro) {
        definirStatus("Mostrando todos os empregados ativos");
      } else if (ativos !== null) {
        definirStatus("Mostrando " + ativos + (ativos === 1 ? " empregado ativo" : " empregados ativos"));
      } else if (pacote.motivo === "grupo_pequeno") {
        definirStatus(TEXTO_PROTEGIDO);
      } else {
        definirStatus("Nenhum empregado ativo nesta combinação");
      }

      entrarEmCena(true);
    } catch (erro) {
      console.error("Falha ao aplicar filtros:", erro);
      definirStatus("Não consegui carregar esta combinação de filtros");
      entrarEmCena(false);
    } finally {
      if (minhaVez === pedido) {
        painel.classList.remove("atualizando");
      }
    }
  }

  // ---------------------------------------------------------------
  // Início: lê a lista de opções e liga os filtros
  // ---------------------------------------------------------------
  function preencherSelect(select, opcoes, rotuloTodos, formatarNome) {
    select.textContent = "";

    const todos = document.createElement("option");
    todos.value = "todos";
    todos.textContent = rotuloTodos;
    select.appendChild(todos);

    opcoes.forEach(function (opcao) {
      if (!ID_VALIDO.test(opcao.id)) {
        return;
      }
      const elemento = document.createElement("option");
      elemento.value = opcao.id;
      elemento.textContent = formatarNome ? formatarNome(opcao.nome) : opcao.nome;
      select.appendChild(elemento);
    });

    select.disabled = false;
  }

  async function iniciarFiltros() {
    try {
      const opcoes = await carregarArquivo("_opcoes");

      const gerencias = opcoes.gerencia.slice().sort(function (a, b) {
        return pesoNivel(a.nome) - pesoNivel(b.nome);
      });

      preencherSelect(selectEmpresa, opcoes.empresa, "Todas");
      preencherSelect(selectCentro, opcoes.centro, "Todos");
      preencherSelect(selectGerencia, gerencias, "Todas", nomeNivel);

      [selectEmpresa, selectCentro, selectGerencia].forEach(function (select) {
        select.addEventListener("change", atualizar);
      });

      // O botão fica sempre visível; só liga quando há filtro ativo
      if (botaoLimpar) {
        botaoLimpar.hidden = false;
        botaoLimpar.disabled = true;
        botaoLimpar.addEventListener("click", function () {
          selectEmpresa.value = "todos";
          selectCentro.value = "todos";
          selectGerencia.value = "todos";
          atualizar();
        });
      }

      definirStatus("Mostrando todos os empregados ativos");
    } catch (erro) {
      console.error("Filtros indisponíveis:", erro);
      definirStatus("Filtros indisponíveis (rode backend\\exportar_filtros.py)");
    }
  }

  iniciarFiltros();
})();