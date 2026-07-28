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
    // Ouve novas fotos em tempo real apenas se estiver na recepção ou em momentos livres
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
    if(badge) badge.style.display = 'none'; // Slideshow puro da Cat sem legenda
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
        fotosDesafiosAtuais = data; // Armazena objetos com url e desafio
        if(canvas) canvas.src = fotosDesafiosAtuais[0].url;
        
        // Exibe a legenda com o nome do desafio correspondente à foto
        if(badge) {
          badge.style.display = 'flex';
          badge.innerText = `DESAFIO: ${fotosDesafiosAtuais[0].desafio.toUpperCase()}`;
        }
        
        slideIndexDesafio = 0;
        rodarSlideshowDesafios();
      } else {
        if(containerMidia) containerMidia.style.display = 'none';
        if(badge) badge.style.display = 'none';
        if (arteFundoReal) { arteFundoReal.src = "arte-festa.jpg"; arteFundoReal.style.display = 'block'; }
      }
    } catch(e) { console.error(e); }
  } else {
    // Demais momentos fixos (Ex: Abertura de Pista, Parabéns e Bolo, etc.)
    if(containerMidia) containerMidia.style.display = 'none';
    if (arteFundoReal) { arteFundoReal.src = "arte-festa.jpg"; arteFundoReal.style.display = 'block'; }
    if(badge) {
      badge.style.display = 'flex';
      badge.innerText = momento.toUpperCase();
    }
  }
}

function rodarSlideshowCat() {
  intervaloSlideCat = setInterval(() => {
    if(congelado || fotosCatAtuais.length === 0) return;
    slideIndexCat = (slideIndexCat + 1) % fotosCatAtuais.length;
    const canvas = document.getElementById('telao-canvas');
    if(canvas) canvas.src = fotosCatAtuais[slideIndexCat];
  }, 5000);
}

function rodarSlideshowDesafios() {
  intervaloSlideDesafio = setInterval(() => {
    if(congelado || fotosDesafiosAtuais.length === 0) return;
    slideIndexDesafio = (slideIndexDesafio + 1) % fotosDesafiosAtuais.length;
    const itemAtual = fotosDesafiosAtuais[slideIndexDesafio];
    
    const canvas = document.getElementById('telao-canvas');
    if(canvas) canvas.src = itemAtual.url;

    const badge = document.getElementById('telao-subtitulo');
    if(badge && itemAtual.desafio) {
      badge.style.display = 'flex';
      badge.innerText = `DESAFIO: ${itemAtual.desafio.toUpperCase()}`;
    }
  }, 5000);
}

function exibirFotoDestaqueNoTelao(url, legenda) {
  clearInterval(intervaloSlideCat);
  clearInterval(intervaloSlideDesafio);
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
  if (!input.files || input.files.length === 0 || !client) return;
  const file = input.files[0];
  const fileName = `cat_${Date.now()}_${file.name}`;
  const { error } = await client.storage.from('festa-cat').upload(fileName, file);
  if (error) return alert('Erro no upload: ' + error.message);
  const { data: urlData } = client.storage.from('festa-cat').getPublicUrl(fileName);
  await client.from('fotos_catarina').insert({ url: urlData.publicUrl });
  carregarFotosCatControle();
}

async function uploadFotoDesafioAdmin(input) {
  if (!input.files || input.files.length === 0 || !client) return;
  const status = document.getElementById('admin-upload-status');
  if(status) status.innerText = "Enviando desafio para o telão... ";
  const file = input.files[0];
  const desafio = document.getElementById('admin-escolha-desafio').value;
  const fileName = `admin_desafio_${Date.now()}_${file.name}`;
  const { error } = await client.storage.from('desafios-festa').upload(fileName, file);
  if(error) { if(status) status.innerText = "Erro ao enviar. Tente novamente!"; return; }
  const { data: urlData } = client.storage.from('desafios-festa').getPublicUrl(fileName);
  await client.from('fotos_desafios').insert({ url: urlData.publicUrl, desafio: desafio, aprovada: true });
  if(status) status.innerText = "Desafio enviado com sucesso para o telão!";
  setTimeout(() => { if(status) status.innerText = ""; }, 3000);
  carregarFotosDesafiosControle();
}

async function uploadFotoMuralConvidado(input) {
  if (!input.files || input.files.length === 0 || !client) return;
  const status = document.getElementById('upload-status');
  if(status) status.innerText = "Publicando no mural... ";
  const file = input.files[0];
  const fileName = `guest_mural_${Date.now()}_${file.name}`;
  const { error } = await client.storage.from('desafios-festa').upload(fileName, file);
  if(error) { if(status) status.innerText = "Erro ao publicar. Tente novamente!"; return; }
  const { data: urlData } = client.storage.from('desafios-festa').getPublicUrl(fileName);
  await client.from('memorias').insert({ url: urlData.publicUrl });
  if(status) status.innerText = "Sua foto foi para o Mural de Memórias! ✨";
  setTimeout(() => { if(status) status.innerText = ""; }, 3000);
}

async function carregarFotosMural() {
  if(!client) return;
  try {
    const { data } = await client.from('memorias').select('*').order('created_at', { ascending: false });
    const lista = document.getElementById('mural-lista-fotos');
    if(lista && data) {
      lista.innerHTML = '';
      data.forEach(post => {
        lista.innerHTML += `<div class="mural-post"><img src="${post.url}" class="mural-photo"><div class="mural-footer">Memória enviada por um convidado ✨</div></div>`;
      });
    }
  } catch(e) { console.error(e); }
}

function ouvirNovasFotosMural() {
  if(!client) return;
  client.channel('mural-stream').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'memorias' }, payload => {
    carregarFotosMural();
  }).subscribe();
}

async function removerFotoCat(id) {
  if(!client) return;
  await client.from('fotos_catarina').delete().eq('id', id);
  carregarFotosCatControle();
}

async function removerFotoDesafio(id) {
  if(!client) return;
  await client.from('fotos_desafios').delete().eq('id', id);
  carregarFotosDesafiosControle();
}

async function carregarDadosControle() {
  carregarFotosCatControle();
  carregarFotosDesafiosControle();
  carregarCronograma();
  carregarConvidados();
  ouvirFotosDosConvidados();
}

async function carregarFotosCatControle() {
  if(!client) return;
  try {
    const { data } = await client.from('fotos_catarina').select('*');
    const grid = document.getElementById('grid-fotos-cat');
    if(grid && data) {
      grid.innerHTML = '';
      data.forEach(foto => {
        grid.innerHTML += `<div class="photo-slot"><img src="${foto.url}"><button class="remove-btn" onclick="removerFotoCat('${foto.id}')">✕</button></div>`;
      });
    }
  } catch(e) { console.error(e); }
}

async function carregarFotosDesafiosControle() {
  const lista = document.getElementById('lista-desafios-stream');
  if(!client || !lista) return;
  try {
    const { data } = await client.from('fotos_desafios').select('*').order('created_at', { ascending: false });
    if(data) {
      lista.innerHTML = '';
      data.forEach(f => {
        lista.innerHTML += `
          <div style="display:flex; align-items:center; justify-content:space-between; background:#ffffff; padding:10px 14px; border-radius:16px; border:1px solid rgba(200,150,62,0.3); box-shadow:0 2px 8px rgba(0,0,0,0.02); margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <img src="${f.url}" style="width:45px; height:45px; object-fit:cover; border-radius:10px; border:1px solid rgba(200,150,62,0.3);">
              <div style="font-family:'Playfair Display'; font-size:0.95rem; color:#7A4F0E;"><b>${f.desafio}</b></div>
            </div>
            <button onclick="removerFotoDesafio('${f.id}')" style="background:none; border:none; color:#cd0277; font-size:14px; cursor:pointer; padding:4px;">✕</button>
          </div>`;
      });
    }
  } catch(e) { console.error(e); }
}

async function carregarCronograma() {
  if(!client) return;
  try {
    const { data } = await client.from('cronograma').select('*').order('hora');
    const lista = document.getElementById('cronograma-lista');
    if(lista && data) {
      lista.innerHTML = '';
      data.forEach(item => {
        lista.innerHTML += `
          <div class="crono-item ${item.concluido ? 'done' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <b style="font-family:'Cinzel'; font-size:1rem; color:#cd0277;">${item.hora} - ${item.titulo || 'Momento'}</b>
              <div>
                <button onclick="toggleCrono('${item.id}', ${item.concluido})" style="background:#28a745; color:white; border:none; padding:4px 10px; border-radius:10px; font-size:11px; cursor:pointer; margin-right:5px;">✓ Feito</button>
                <button onclick="deletarCronograma('${item.id}')" style="background:none; border:none; color:#cd0277; font-size:14px; cursor:pointer; padding:4px;">✕</button>
              </div>
            </div>
            <p style="margin-top:8px; font-family:'Playfair Display'; font-size:0.95rem; color:#7A4F0E; white-space:pre-wrap;">${item.texto || ''}</p>
          </div>`;
      });
    }
  } catch(e) { console.error(e); }
}

async function adicionarCronograma() {
  const hora = document.getElementById('crono-novo-horario').value;
  const titulo = document.getElementById('crono-novo-titulo') ? document.getElementById('crono-novo-titulo').value : '';
  const texto = document.getElementById('crono-novo-texto').value;
  if(!hora || !client) return;
  
  await client.from('cronograma').insert({ hora, titulo, texto, concluido: false });
  
  if(document.getElementById('crono-novo-titulo')) document.getElementById('crono-novo-titulo').value = '';
  document.getElementById('crono-novo-horario').value = '';
  document.getElementById('crono-novo-texto').value = '';
  carregarCronograma();
}

async function toggleCrono(id, status) {
  if(!client) return;
  await client.from('cronograma').update({ concluido: !status }).eq('id', id);
  carregarCronograma();
}

async function deletarCronograma(id) {
  if(!client) return;
  await client.from('cronograma').delete().eq('id', id);
  carregarCronograma();
}

async function carregarConvidados() {
  if(!client) return;
  try {
    const { data } = await client.from('convidados').select('*').order('nome');
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
  } catch(e) { console.error(e); }
}

async function adicionarConvidado() {
  const nome = document.getElementById('conv-novo-nome').value;
  if(!nome || !client) return;
  await client.from('convidados').insert({ nome, presente: false });
  document.getElementById('conv-novo-nome').value = '';
  carregarConvidados();
}

async function togglePresenca(id, status) {
  if(!client) return;
  await client.from('convidados').update({ presente: !status }).eq('id', id);
  carregarConvidados();
}

async function deletarConvidado(id) {
  if(!client) return;
  await client.from('convidados').delete().eq('id', id);
  carregarConvidados();
}

function ouvirFotosDosConvidados() {
  if(!client) return;
  client.channel('stream-controle').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fotos_desafios' }, payload => {
    carregarFotosDesafiosControle();
  }).subscribe();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarSistemaPorPagina);
} else {
  inicializarSistemaPorPagina();
}
