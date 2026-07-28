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
      congelado = configInit.congel
