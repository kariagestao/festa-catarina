const SUPABASE_URL = "https://hrqqriybcpmnsinswyop.supabase.co";
const SUPABASE_KEY = "sb_publishable_BEGEdQzqZc2FtPrPgJPh9Q_CQMHioqM";

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let congelado = false;
let fotosCatAtuais = [];
let fotosDesafiosAtuais = [];
let slideIndexCat = 0;
let slideIndexDesafio = 0;
let momentoGlobal = 'RECEPÇÃO DOS CONVIDADOS';
let intervaloSlideCat = null;
let intervaloSlideDesafio = null;
let editandoId = null;

function inicializarSistemaPorPagina() {
  const testePainelControle = document.getElementById('grid-fotos-cat');
  const testeMuralConvidado = document.getElementById('mural-lista-fotos');
  
  if (testePainelControle) {
    console.log("Modo Controle ativo.");
    carregarDadosControle();
  } else if (testeMuralConvidado) {
    console.log("Modo Convidado ativo.");
    carregarFotosMural();
    ouvirNovasFotosMural();
  } else {
    console.log("Modo Telão ativo.");
    inicializarTelão();
  }
}

function switchScreen(screenName) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  const targetScreen = document.getElementById('screen-' + screenName);
  if (targetScreen) targetScreen.classList.add('active');
  if (window.event && window.event.currentTarget) window.event.currentTarget.classList.add('active');
}

async function toggleCongelar() {
  congelado = !congelado;
  const btn = document.getElementById('btn-congelar');
  if (btn) {
    btn.innerText = congelado ? "TELÃO: CONGELADO" : "CONGELAR TELÃO: OFF";
    btn.classList.toggle('frozen', congelado);
  }
  try {
    await client.from('config').upsert({ id: 1, congelado: congelado });
  } catch(e) { console.error(e); }
}

async function setMomento(nome) {
  if (congelado) {
    alert("O telão está CONGELADO! Descongele para alterar o momento.");
    return;
  }
  try {
    await client.from('config').upsert({ id: 1, momento_atual: nome });
  } catch(e) { console.error(e); }
}

async function inicializarTelão() {
  if (!client) return;
  try {
    const { data: configInit } = await client.from('config').select('*').eq('id', 1).single();
    if(configInit) {
      congelado = configInit.congelado;
      atualizarVisualTelao(configInit.momento_atual);
    }
  } catch(e) { console.error(e); }
  
  client.channel('config-alteracoes').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'config' }, payload => {
    const config = payload.new;
    congelado = config.congelado;
    atualizarVisualTelao(config.momento_atual);
  }).subscribe();

  client.channel('fotos-novas').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fotos_desafios' }, payload => {
    const novaFoto = payload.new;
    if(!congelado && novaFoto.aprovada) {
      if (momentoGlobal === 'RECEPÇÃO DOS CONVIDADOS' || (!momentoGlobal.includes('SLIDESHOW'))) {
        exibirFotoDestaqueNoTelao(novaFoto.url, novaFoto.desafio);
      }
    }
  }).subscribe();
}

async function atualizarVisualTelao(momento) {
  momentoGlobal = momento;
  const badge = document.getElementById('telao-subtitulo');
  const canvas = document.getElementById('telao-canvas');
  const containerMidia = document.getElementById('telao-container-midia');
  const arteFundoReal = document.getElementById('telao-arte-fundo-real');
  
  clearInterval(intervaloSlideCat);
  clearInterval(intervaloSlideDesafio);

  if (momento === 'RECEPÇÃO DOS CONVIDADOS') {
    if(badge) badge.style.display = 'none';
    if(containerMidia) containerMidia.style.display = 'none';
    if (arteFundoReal) { arteFundoReal.src = "arte-festa.jpg"; arteFundoReal.style.display = 'block'; }
  } else if (momento === 'SLIDESHOW DA CATARINA') {
    if (arteFundoReal) arteFundoReal.style.display = 'none';
    if(badge) badge.style.display = 'none';
    if(containerMidia) containerMidia.style.display = 'block';
    
    try {
      const { data } = await client.from('fotos_catarina').select('url');
      if(data && data.length > 0) {
        fotosCatAtuais = data.map(f => f.url);
        if(canvas) canvas.src = fotosCatAtuais[0];
        slideIndexCat = 0;
        rodarSlideshowCat();
      } else {
        if(containerMidia) containerMidia.style.display = 'none';
        if (arteFundoReal) { arteFundoReal.src = "arte-festa.jpg"; arteFundoReal.style.display = 'block'; }
      }
    } catch(e) { console.error(e); }
  } else if (momento === 'SLIDESHOW DOS DESAFIOS') {
    if (arteFundoReal) arteFundoReal.style.display = 'none';
    if(containerMidia) containerMidia.style.display = 'block';
    
    try {
      const { data } = await client.from('fotos_desafios').select('url, desafio').eq('aprovada', true);
      if(data && data.length > 0) {
        fotosDesafiosAtuais = data;
        if(canvas) canvas.src = fotosDesafiosAtuais[0].url;
        
        if(badge) {
          badge.style.display = 'flex';
          badge.innerText = `DESAFIO: ${fotosDesafiosAtuais[0].desafio.toUpperCase()}`;
        }
        
        slideIndexDesafio = 0;
        rod
