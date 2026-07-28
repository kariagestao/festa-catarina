const SUPABASE_URL = 'https://supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhycXFyaXliY3BtbnNpbnN3eW9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMDg0NDgsImV4cCI6MjEwMDc4NDQ0OH0.XVwD1ItWJQ8HU6Ib_1NNVrEGcQF1g_1tbgqq5ufQ9xk';
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let congelado = false;
let fotosCatAtuais = [];
let slideIndex = 0;
let momentoGlobal = 'RECEPÇÃO DOS CONVIDADOS';
let intervaloSlide = null;

// DETECTOR DE PÁGINAS SEGURO (Procura os elementos reais de cada tela)
function inicializarSistemaPorPagina() {
  const testePainelControle = document.getElementById('grid-fotos-cat');
  const testeMuralConvidado = document.getElementById('mural-lista-fotos');
  
  if (testePainelControle) {
    console.log("Modo Controle ativado.");
    carregarDadosControle();
  } else if (testeMuralConvidado) {
    console.log("Modo Convidado ativado.");
    carregarFotosMural();
    ouvirNovasFotosMural();
  } else {
    console.log("Modo Telão ativado.");
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
  if(supabase) await supabase.from('config').upsert({ id: 1, congelado: congelado });
}

async function setMomento(nome) {
  if(supabase) {
    await supabase.from('config').upsert({ id: 1, momento_atual: nome });
  }
}

async function inicializarTelão() {
  if(!supabase) return;
  const { data: configInit } = await supabase.from('config').select('*').eq('id', 1).single();
  if(configInit) {
    congelado = configInit.congelado;
    atualizarVisualTelao(configInit.momento_atual);
  }
  
  supabase.channel('config-alteracoes').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'config' }, payload => {
    const config = payload.new;
    congelado = config.congelado;
    atualizarVisualTelao(config.momento_atual);
  }).subscribe();

  supabase.channel('fotos-novas').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fotos_desafios' }, payload => {
    const novaFoto = payload.new;
    if(!congelado && novaFoto.aprovada) {
      exibirFotoDestaqueNoTelao(novaFoto.url, novaFoto.desafio);
    }
  }).subscribe();
}

async function atualizarVisualTelao(momento) {
  momentoGlobal = momento;
  const badge = document.getElementById('telao-subtitulo');
  const canvas = document.getElementById('telao-canvas');
  const containerMidia = document.getElementById('telao-container-midia');
  const arteFundoReal = document.getElementById('telao-arte-fundo-real');
  clearInterval(intervaloSlide);

  if (momento === 'RECEPÇÃO DOS CONVIDADOS') {
    if(badge) badge.style.display = 'none';
    if(containerMidia) containerMidia.style.display = 'none';
    if (arteFundoReal) { arteFundoReal.src = "arte-festa.jpg"; arteFundoReal.style.display = 'block'; }
  } else if (momento === 'SLIDESHOW DA CATARINA') {
    if (arteFundoReal) arteFundoReal.style.display = 'none';
    if(badge) badge.style.display = 'none';
    if(containerMidia) containerMidia.style.display = 'block';
    
    const { data } = await supabase.from('fotos_catarina').select('url');
    if(data && data.length > 0) {
      fotosCatAtuais = data.map(f => f.url);
      if(canvas) canvas.src = fotosCatAtuais[0];
      slideIndex = 0;
      rodarSlideshow();
    } else {
      if(containerMidia) containerMidia.style.display = 'none';
      if (arteFundoReal) { arteFundoReal.src = "arte-festa.jpg"; arteFundoReal.style.display = 'block'; }
    }
  } else {
    if(containerMidia) containerMidia.style.display = 'none';
    if (arteFundoReal) { arteFundoReal.src = "arte-festa.jpg"; arteFundoReal.style.display = 'block'; }
    if(badge) {
      badge.style.display = 'flex';
      badge.innerText = momento.toUpperCase();
    }
  }
}

function rodarSlideshow() {
  intervaloSlide = setInterval(() => {
    if(congelado || fotosCatAtuais.length === 0) return;
    slideIndex = (slideIndex + 1) % fotosCatAtuais.length;
    const canvas = document.getElementById('telao-canvas');
    if(canvas) canvas.src = fotosCatAtuais[slideIndex];
  }, 5000);
}

function exibirFotoDestaqueNoTelao(url, legenda) {
  clearInterval(intervaloSlide);
  const canvas = document.getElementById('telao-canvas');
  const containerMidia = document.getElementById('telao-container-midia');
  const badge = document.getElementById('telao-subtitulo');
  const arteFundoReal = document.getElementById('telao-arte-fundo-real');
  
  if (arteFundoReal) arteFundoReal.style.display = 'none';
  if(containerMidia) containerMidia.style.display = 'block';
  if(canvas) canvas.src = url;
  
  if(badge) {
    badge.style.display = 'flex';
    badge.innerText = `DESAFIO CONCLUÍDO: ${legenda.toUpperCase()}!`;
  }
  setTimeout(() => {
    if (!congelado) atualizarVisualTelao(momentoGlobal);
  }, 8000);
}
async function uploadFotoCat(input) {
  if (!input.files || input.files.length === 0 || !supabase) return;
  const file = input.files[0];
  const fileName = `cat_${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage.from('festa-cat').upload(fileName, file);
  if (error) return alert('Erro no upload: ' + error.message);
  const { data: urlData } = supabase.storage.from('festa-cat').getPublicUrl(fileName);
  await supabase.from('fotos_catarina').insert({ url: urlData.publicUrl });
  carregarFotosCatControle();
}

async function uploadFotoDesafioAdmin(input) {
  if (!input.files || input.files.length === 0 || !supabase) return;
  const status = document.getElementById('admin-upload-status');
  if(status) status.innerText = "Enviando desafio para o telão... ";
  const file = input.files[0];
  const desafio = document.getElementById('admin-escolha-desafio').value;
  const fileName = `admin_desafio_${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage.from('desafios-festa').upload(fileName, file);
  if(error) { if(status) status.innerText = "Erro ao enviar. Tente novamente!"; return; }
  const { data: urlData } = supabase.storage.from('desafios-festa').getPublicUrl(fileName);
  await supabase.from('fotos_desafios').insert({ url: urlData.publicUrl, desafio: desafio, aprovada: true });
  if(status) status.innerText = "Desafio enviado com sucesso para o telão!";
  setTimeout(() => { if(status) status.innerText = ""; }, 3000);
}

async function uploadFotoMuralConvidado(input) {
  if (!input.files || input.files.length === 0 || !supabase) return;
  const status = document.getElementById('upload-status');
  if(status) status.innerText = "Publicando no mural... ";
  const file = input.files[0];
  const fileName = `guest_mural_${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage.from('desafios-festa').upload(fileName, file);
  if(error) { if(status) status.innerText = "Erro ao publicar. Tente novamente!"; return; }
  const { data: urlData } = supabase.storage.from('desafios-festa').getPublicUrl(fileName);
  await supabase.from('memorias').insert({ url: urlData.publicUrl });
  if(status) status.innerText = "Sua foto foi para o Mural de Memórias! ✨";
  setTimeout(() => { if(status) status.innerText = ""; }, 3000);
}

async function carregarFotosMural() {
  if(!supabase) return;
  const { data } = await supabase.from('memorias').select('*').order('created_at', { ascending: false });
  const lista = document.getElementById('mural-lista-fotos');
  if(lista && data) {
    lista.innerHTML = '';
    data.forEach(post => {
      lista.innerHTML += `<div class="mural-post"><img src="${post.url}" class="mural-photo"><div class="mural-footer">Memória enviada por um convidado ✨</div></div>`;
    });
  }
}

function ouvirNovasFotosMural() {
  if(!supabase) return;
  supabase.channel('mural-stream').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'memorias' }, payload => {
    const post = payload.new;
    const lista = document.getElementById('mural-lista-fotos');
    if(lista) {
      lista.innerHTML = `<div class="mural-post"><img src="${post.url}" class="mural-photo"><div class="mural-footer">Memória enviada por um convidado ✨</div></div>` + lista.innerHTML;
    }
  }).subscribe();
}

async function removerFotoCat(id) {
  if(!supabase) return;
  await supabase.from('fotos_catarina').delete().eq('id', id);
  carregarFotosCatControle();
}

async function carregarDadosControle() {
  if(!supabase) return;
  carregarFotosCatControle();
  carregarCronograma();
  carregarConvidados();
  ouvirFotosDosConvidados();
}

async function carregarFotosCatControle() {
  const { data } = await supabase.from('fotos_catarina').select('*');
  const grid = document.getElementById('grid-fotos-cat');
  if(grid && data) {
    grid.innerHTML = '';
    data.forEach(foto => {
      grid.innerHTML += `<div class="photo-slot"><img src="${foto.url}"><button class="remove-btn" onclick="removerFotoCat('${foto.id}')">✕</button></div>`;
    });
  }
}

async function carregarCronograma() {
  const { data } = await supabase.from('cronograma').select('*').order('hora');
  const lista = document.getElementById('cronograma-lista');
  if(lista && data) {
    lista.innerHTML = '';
    data.forEach(item => {
      lista.innerHTML += `<div class="crono-item ${item.concluido ? 'done' : ''}" onclick="toggleCrono('${item.id}', ${item.concluido})"><div class="crono-check">✓</div><div class="crono-hora">${item.hora}</div><div class="crono-texto">${item.texto}</div></div>`;
    });
  }
}

async function adicionarCronograma() {
  const hora = document.getElementById('crono-novo-horario').value;
  const texto = document.getElementById('crono-novo-texto').value;
  if(!hora || !texto) return;
  await supabase.from('cronograma').insert({ hora, texto, concluido: false });
  document.getElementById('crono-novo-horario').value = '';
  document.getElementById('crono-novo-texto').value = '';
  carregarCronograma();
}

async function toggleCrono(id, status) {
  await supabase.from('cronograma').update({ concluido: !status }).eq('id', id);
  carregarCronograma();
}

async function carregarConvidados() {
  const { data } = await supabase.from('convidados').select('*').order('nome');
  const lista = document.getElementById('convidados-lista');
  let presentes = 0;
  if(lista && data) {
    lista.innerHTML = '';
    data.forEach(c => {
      if(c.presente) presentes++;
      lista.innerHTML += `<div class="convidado-item ${c.presente ? 'presente' : ''}" onclick="togglePresenca('${c.id}', ${c.presente})"><div class="conv-check">✓</div><div class="conv-nome">${c.nome}</div><button class="conv-del" onclick="event.stopPropagation(); deletarConvidado('${c.id}')">✕</button></div>`;
    });
  }
  const contador = document.getElementById('conv-contador');
  if(contador) contador.innerText = `Presentes: ${presentes} | Total: ${data ? data.length : 0}`;
}

async function adicionarConvidado() {
  const nome = document.getElementById('conv-novo-nome').value;
  if(!nome) return;
  await supabase.from('convidados').insert({ nome, presente: false });
  document.getElementById('conv-novo-nome').value = '';
  carregarConvidados();
}

async function togglePresenca(id, status) {
  await supabase.from('convidados').update({ presente: !status }).eq('id', id);
  carregarConvidados();
}

async function deletarConvidado(id) {
  await supabase.from('convidados').delete().eq('id', id);
  carregarConvidados();
}

function ouvirFotosDosConvidados() {
  const lista = document.getElementById('lista-desafios-stream');
  if(!supabase) return;
  supabase.channel('stream-controle').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fotos_desafios' }, payload => {
    const f = payload.new;
    if(lista) {
      lista.innerHTML = `<div class="desafio-item"><img src="${f.url}" class="desafio-thumb"><div class="desafio-text"><b>${f.desafio}</b> enviado agora!</div></div>` + lista.innerHTML;
    }
  }).subscribe();
}

// Dispara a leitura inteligente assim que a página termina de abrir
window.onload = inicializarSistemaPorPagina;
