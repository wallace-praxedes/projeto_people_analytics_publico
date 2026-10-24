// =====================================================================
// ANIMAÇÕES DO PAINEL (GSAP + ScrollTrigger) - Etapa 7
// =====================================================================
// Este arquivo só mexe na APARÊNCIA: ele não lê dados e não desenha gráficos.
// Quem desenha é o principal.js; aqui só dizemos "quando este elemento
// entrar na tela, faça esta entrada".
//
// Tudo fica dentro de uma função que se executa sozinha (IIFE). Isso impede
// que os nomes usados aqui briguem com os nomes do principal.js.
(function () {
  "use strict";

  // ---------------------------------------------------------------
  // 0) Condições para animar
  // ---------------------------------------------------------------
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    console.error("GSAP ou ScrollTrigger não carregou. Confira a pasta frontend/js/vendor. O painel continua visível, só sem animação.");
    return;
  }

  // Quem pede "reduzir movimento" no sistema vê tudo parado, sem animação
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    console.info("Movimento reduzido ativado no sistema: animações desligadas.");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // Gráficos de rosca (revelados como um círculo que se abre)
  const ROSCAS = ["grafico-sexo", "grafico-raca", "grafico-empresa"];

  // ---------------------------------------------------------------
  // 1) Ajudantes
  // ---------------------------------------------------------------

  // Escreve um número no padrão brasileiro, com casas fixas ("3,6")
  function formatar(valor, casas) {
    return Number(valor).toLocaleString("pt-BR", {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas
    });
  }

  // O número só chega depois que o principal.js lê o JSON. Esta função fica
  // "de olho" no elemento e avisa quando o texto virar um número.
  function quandoPronto(elemento, aoFicarPronto) {
    function pronto() {
      return /^\d/.test(elemento.textContent.trim());
    }

    if (pronto()) {
      aoFicarPronto();
      return;
    }

    const observador = new MutationObserver(function () {
      if (pronto()) {
        observador.disconnect();
        aoFicarPronto();
      }
    });
    observador.observe(elemento, { childList: true, characterData: true, subtree: true });
  }

  // Faz o número "contar" de zero até o valor final, mantendo vírgula,
  // casas decimais e sufixo (ex.: "3,6%" ou "225"). A unidade ("anos"),
  // que fica num <span> à parte, não é tocada.
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

    no.nodeValue = formatar(0, casas) + sufixo;
    gsap.to(contador, {
      v: alvo,
      duration: duracao,
      ease: "power2.out",
      onUpdate: function () {
        no.nodeValue = formatar(contador.v, casas) + sufixo;
      },
      onComplete: function () {
        no.nodeValue = original;
      }
    });
  }

  // Alguns elementos (mapa, matriz) são criados depois que o JSON chega.
  // Esta função tenta achar o elemento a cada 0,1 s, por até 5 s.
  function esperarPor(seletor, aoEncontrar, tentativa) {
    const achados = document.querySelectorAll(seletor);
    if (achados.length > 0) {
      aoEncontrar(achados);
      return;
    }
    const n = tentativa || 0;
    if (n >= 50) {
      return;
    }
    setTimeout(function () {
      esperarPor(seletor, aoEncontrar, n + 1);
    }, 100);
  }

  // ---------------------------------------------------------------
  // 2) Abertura: o 225 aparece contando, e depois sobe mais devagar
  //    que a página (efeito de profundidade)
  // ---------------------------------------------------------------
  function animarAbertura() {
    const numero = document.getElementById("numero-ativos");
    let apareceu = false;

    // Escondido até chegar o valor, para não mostrar "carregando..." gigante
    gsap.set(numero, { opacity: 0 });
    gsap.from(".abertura-rotulo", { y: 24, opacity: 0, duration: 0.9, ease: "power3.out" });

    quandoPronto(numero, function () {
      apareceu = true;
      gsap.fromTo(numero,
        { opacity: 0, scale: 0.88 },
        { opacity: 1, scale: 1, duration: 1.1, ease: "power3.out" }
      );
      contarAte(numero, 2);
    });

    // Plano B: se o valor não chegar em 4 s (erro), mostra o que houver
    setTimeout(function () {
      if (!apareceu) {
        gsap.to(numero, { opacity: 1, duration: 0.5 });
      }
    }, 4000);

    // Profundidade: o número e o rótulo sobem mais devagar que a página
    gsap.to(numero, {
      yPercent: -20,
      ease: "none",
      scrollTrigger: { trigger: ".abertura", start: "top top", end: "bottom top", scrub: true }
    });
    gsap.to(".abertura-rotulo", {
      yPercent: -200,
      ease: "none",
      scrollTrigger: { trigger: ".abertura", start: "top top", end: "bottom top", scrub: true }
    });
  }

  // ---------------------------------------------------------------
  // 3) Faixa de filtros e títulos das seções
  // ---------------------------------------------------------------
  function animarFiltrosETitulos() {
    gsap.from(".filtros-rotulo, .filtro-chip", {
      opacity: 0,
      y: -12,
      duration: 0.6,
      stagger: 0.08,
      ease: "power2.out",
      scrollTrigger: { trigger: ".filtros-faixa", start: "top 98%", once: true }
    });

    document.querySelectorAll(".secao h2").forEach(function (titulo) {
      gsap.from(titulo, {
        y: 50,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: titulo, start: "top 88%", once: true }
      });
    });
  }

  // ---------------------------------------------------------------
  // 4) Cartões: começam escondidos e entram em grupos de até 4
  // ---------------------------------------------------------------
  function animarCartoes() {
    gsap.set(".cartao", { opacity: 0, y: 40 });

    ScrollTrigger.batch(".cartao", {
      start: "top 90%",
      once: true,
      interval: 0.1,
      batchMax: 4,
      onEnter: function (grupo) {
        gsap.to(grupo, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.12,
          ease: "power3.out",
          overwrite: true,
          clearProps: "transform"
        });
      }
    });
  }

  // ---------------------------------------------------------------
  // 5) Números que contam do zero (PCD, idade, tempo de casa, selo)
  // ---------------------------------------------------------------
  function animarNumeros() {
    [
      "numero-pcd",
      "numero-idade",
      "numero-tempo-casa",
      "numero-mulheres-lideranca"
    ].forEach(function (id) {
      const elemento = document.getElementById(id);
      if (!elemento) {
        return;
      }
      ScrollTrigger.create({
        trigger: elemento,
        start: "top 90%",
        once: true,
        onEnter: function () {
          quandoPronto(elemento, function () {
            contarAte(elemento, 1.6);
          });
        }
      });
    });
  }

  // ---------------------------------------------------------------
  // 6) Gráficos: cada tipo é "revelado" de um jeito, cortando e abrindo
  //    uma máscara sobre o desenho (clip-path)
  // ---------------------------------------------------------------
  function animarGraficos() {
    document.querySelectorAll(".grafico-area").forEach(function (area) {
      const canvas = area.querySelector("canvas");
      if (!canvas) {
        return;
      }

      const id = canvas.id;
      let de = "inset(0% 100% 0% 0%)";   // barras: revela da esquerda para a direita
      let para = "inset(0% 0% 0% 0%)";
      let duracao = 1.2;

      if (ROSCAS.indexOf(id) !== -1) {
        de = "circle(0% at 50% 45%)";    // rosca: círculo que se abre
        para = "circle(80% at 50% 45%)";
        duracao = 1.3;
      } else if (id === "grafico-piramide") {
        de = "inset(0% 50% 0% 50%)";     // pirâmide: abre do centro para fora
      } else if (id === "grafico-sexo-nivel") {
        de = "inset(100% 0% 0% 0%)";     // colunas: crescem de baixo para cima
      } else if (id === "grafico-evolucao") {
        duracao = 1.8;                   // linha: desenhada mais devagar
      }

      gsap.fromTo(area,
        { clipPath: de },
        {
          clipPath: para,
          duration: duracao,
          ease: "power2.out",
          clearProps: "clipPath",
          scrollTrigger: { trigger: area, start: "top 85%", once: true }
        }
      );
    });
  }

  // ---------------------------------------------------------------
  // 7) Mapa: os estados aparecem, os círculos "nascem" e o top 5 desliza
  // ---------------------------------------------------------------
  function animarMapa() {
    ScrollTrigger.create({
      trigger: "#mapa-brasil",
      start: "top 88%",
      once: true,
      onEnter: function () {
        esperarPor("#mapa-brasil .mapa-bolha", function (bolhas) {
          const estados = document.querySelectorAll("#mapa-brasil .mapa-estado");
          const legenda = document.querySelectorAll(
            "#mapa-brasil .mapa-legenda-circulo, #mapa-brasil .mapa-legenda-linha, " +
            "#mapa-brasil .mapa-legenda-texto, #mapa-brasil .mapa-legenda-titulo"
          );
          const itens = document.querySelectorAll("#ranking-municipios li");

          gsap.from(estados, {
            opacity: 0,
            duration: 0.6,
            stagger: { amount: 0.8 },
            ease: "power1.out"
          });
          gsap.from(bolhas, {
            scale: 0,
            transformOrigin: "50% 50%",
            duration: 0.9,
            delay: 0.5,
            stagger: { amount: 1.0, from: "start" },
            ease: "back.out(1.8)",
            clearProps: "transform"
          });
          gsap.from(legenda, { opacity: 0, duration: 0.6, delay: 1.2 });
          gsap.from(itens, {
            opacity: 0,
            x: -20,
            duration: 0.5,
            delay: 0.8,
            stagger: 0.1,
            ease: "power2.out"
          });
        });
      }
    });
  }

  // ---------------------------------------------------------------
  // 8) Matriz de calor: as células surgem uma a uma
  // ---------------------------------------------------------------
  function animarMatriz() {
    ScrollTrigger.create({
      trigger: "#matriz-formacao",
      start: "top 88%",
      once: true,
      onEnter: function () {
        esperarPor("#matriz-formacao td, #matriz-formacao th", function (celulas) {
          gsap.from(celulas, {
            opacity: 0,
            y: 12,
            duration: 0.5,
            stagger: { amount: 0.9 },
            ease: "power2.out",
            clearProps: "transform"
          });
        });
      }
    });
  }

  // ---------------------------------------------------------------
  // 9) Liga tudo. Se algo falhar no meio, desfaz os "escondidos"
  //    para o painel nunca ficar em branco.
  // ---------------------------------------------------------------
  try {
    animarAbertura();
    animarFiltrosETitulos();
    animarCartoes();
    animarNumeros();
    animarGraficos();
    animarMapa();
    animarMatriz();
  } catch (erro) {
    console.error("Falha nas animações:", erro);
    gsap.set(".cartao, #numero-ativos", { clearProps: "opacity,transform" });
  }

  // O tamanho da página muda quando fontes, mapa e matriz terminam de
  // carregar. Recalcular os "sensores" evita animações disparando fora de hora.
  window.addEventListener("load", function () {
    ScrollTrigger.refresh();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      ScrollTrigger.refresh();
    });
  }
  setTimeout(function () {
    ScrollTrigger.refresh();
  }, 1500);
})();