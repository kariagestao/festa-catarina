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
        rodarSlideshowDesafios();
      } else {
        if(containerMidia) containerMidia.style.display = 'none';
        if(badge) badge.style.display = 'none';
        if (arteFundoReal) { arteFundoReal.src = "arte-festa.jpg"; arteFundoReal.style.display = 'block'; }
      }
    } catch(e) { console.error(e); }
  } else {
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
  if(status) status.innerText = "Enviando desafio... ";
  const file = input.files[0];
  const desafio = document.getElementById('admin-escolha-desafio').value;
  const fileName = `admin_desafio_${Date.now()}_${file.name}`;
  const { error } = await client.storage.from('desafios-festa').upload(fileName, file);
  if(error) { if(status) status.innerText = "Erro ao enviar."; return; }
  const { data: urlData } = client.storage.from('desafios-festa').getPublicUrl(fileName);
  await client.from('fotos_desafios').insert({ url: urlData.publicUrl, desafio: desafio, aprovada: true });
  if(status) status.innerText = "Enviado com sucesso!";
  setTimeout(() => { if(status) status.innerText = ""; }, 3000);
  carregarFotosDesafiosControle();
}

async function uploadFotoMuralConvidado(input) {
  if (!input.files || input.files.length === 0 || !client) return;
  const status = document.getElementById('upload-status');
  if(status) status.innerText = "Publicando no mural... ✨";
  const file = input.files[0];
  const fileName = `guest_mural_${Date.now()}_${file.name}`;
  const { error } = await client.storage.from('mural-festa').upload(fileName, file);
  if(error) { if(status) status.innerText = "Erro ao publicar. Tente novamente!"; return; }
  const { data: urlData } = client.storage.from('mural-festa').getPublicUrl(fileName);
  await client.from('memorias').insert({ url: urlData.publicUrl });
  if(status) status.innerText = "Sua foto foi para o Mural de Memórias! 🎉";
  setTimeout(() => { if(status) status.innerText = ""; }, 3000);
  input.value = '';
}

async function carregarFotosMural() {
  if(!client) return;
  try {
    const { data } = await client.from('memorias').select('*').order('created_at', { ascending: false });
    const lista = document.getElementById('mural-lista-fotos');
    if(lista && data) {
      lista.innerHTML = '';
      if(data.length === 0) {
        lista.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; font-family:'Playfair Display'; color:#a87b32; font-size:1.1rem;">Nenhuma foto publicada ainda. Seja o primeiro a enviar! 📸</div>`;
        return;
      }
      data.forEach(post => {
        lista.innerHTML += `
          <div class="mural-post" style="background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid rgba(200,150,62,0.3); box-shadow:0 4px 12px rgba(0,0,0,0.04); transition: transform 0.2s;">
            <img src="${post.url}" style="width:100%; height:280px; object-fit:cover; display:block;">
            <div style="padding:12px 16px; font-family:'Playfair Display'; font-size:0.85rem; color:#7A4F0E; display:flex; justify-content:space-between; align-items:center;">
              <span>✨ Memória da Festa</span>
            </div>
          </div>`;
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

async function carregarFotosMuralControle() {
  const lista = document.getElementById('lista-mural-controle');
  if(!client || !lista) return;
  try {
    const { data } = await client.from('memorias').select('*').order('created_at', { ascending: false });
    if(data) {
      lista.innerHTML = '';
      if(data.length === 0) {
        lista.innerHTML = `<div style="text-align:center; color:#7A4F0E; font-family:'Playfair Display'; padding:20px;">Nenhuma foto no mural no momento.</div>`;
        return;
      }
      data.forEach(f => {
        lista.innerHTML += `
          <div style="display:flex; align-items:center; justify-content:space-between; background:#ffffff; padding:10px 14px; border-radius:16px; border:1px solid rgba(200,150,62,0.3); box-shadow:0 2px 8px rgba(0,0,0,0.02); margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <img src="${f.url}" style="width:50px; height:50px; object-fit:cover; border-radius:10px; border:1px solid rgba(200,150,62,0.3);">
              <div style="font-family:'Playfair Display'; font-size:0.9rem; color:#7A4F0E;"><b>Foto do Mural</b></div>
            </div>
            <button onclick="removerFotoMural('${f.id}')" style="background:#ff4d4d; color:white; border:none; padding:6px 12px; border-radius:10px; font-size:12px; cursor:pointer; font-weight:600;">Excluir</button>
          </div>`;
      });
    }
  } catch(e) { console.error(e); }
}

async function removerFotoMural(id) {
  if(!client) return;
  if(!confirm("Deseja realmente excluir esta foto do mural dos convidados?")) return;
  await client.from('memorias').delete().eq('id', id);
  carregarFotosMuralControle();
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
  carregarFotosMuralControle();
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
    const { data } = await client.from('cronograma').select('*').order('hora', { ascending: true });
    const lista = document.getElementById('cronograma-lista');
    if(lista && data) {
      lista.innerHTML = '';
      data.forEach(item => {
        const isDone = item.concluido ? true : false;
        const tituloSeguro = (item.titulo || '').replace(/'/g, "\\'");
        const textoSeguro = (item.texto || '').replace(/'/g, "\\'").replace(/\n/g, '\\n');
        
        lista.innerHTML += `
          <div class="crono-item ${isDone ? 'done' : ''}" style="background:#ffffff; padding:14px 18px; border-radius:16px; border:1px solid rgba(200,150,62,0.3); margin-bottom:10px; box-shadow:0 2px 8px rgba(0,0,0,0.02); transition: all 0.3s;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <b style="font-family:'Cinzel'; font-size:1.05rem; color:#cd0277; ${isDone ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${item.hora} - ${item.titulo || 'Momento'}</b>
              <div>
                <button onclick="toggleCrono('${item.id}', ${isDone})" style="background:${isDone ? '#6c757d' : '#28a745'}; color:white; border:none; padding:6px 10px; border-radius:10px; font-size:11px; cursor:pointer; margin-right:4px; font-weight:600;">${isDone ? 'Desfazer' : '✓ Feito'}</button>
                <button onclick="prepararEdicao('${item.id}', '${item.hora}', '${tituloSeguro}', '${textoSeguro}')" style="background:#007bff; color:white; border:none; padding:6px 10px; border-radius:10px; font-size:11px; cursor:pointer; margin-right:4px; font-weight:600;">Editar</button>
                <button onclick="deletarCronograma('${item.id}')" style="background:none; border:none; color:#cd0277; font-size:15px; cursor:pointer; padding:4px;">✕</button>
              </div>
            </div>
            <p style="margin-top:8px; font-family:'Playfair Display'; font-size:0.95rem; color:#7A4F0E; white-space:pre-wrap; ${isDone ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${item.texto || ''}</p>
          </div>`;
      });
    }
  } catch(e) { console.error(e); }
}

async function adicionarCronograma() {
  const hora = document.getElementById('crono-novo-horario').value;
  const tituloEl = document.getElementById('crono-novo-titulo');
  const titulo = tituloEl ? tituloEl.value : '';
  const texto = document.getElementById('crono-novo-texto').value;
  if(!hora || !client) return;

  if (editandoId) {
    const { error } = await client.from('cronograma').update({ hora, titulo, texto }).eq('id', editandoId);
    if(error) { alert("Erro ao atualizar: " + error.message); return; }
    editandoId = null;
  } else {
    const { error } = await client.from('cronograma').insert({ hora, titulo, texto, concluido: false });
    if(error) { alert("Erro ao adicionar: " + error.message); return; }
  }
  
  if(tituloEl) tituloEl.value = '';
  document.getElementById('crono-novo-horario').value = '';
  document.getElementById('crono-novo-texto').value = '';
  carregarCronograma();
}

function prepararEdicao(id, hora, titulo, texto) {
  editandoId = id;
  document.getElementById('crono-novo-horario').value = hora;
  const tituloEl = document.getElementById('crono-novo-titulo');
  if(tituloEl) tituloEl.value = titulo !== 'null' ? titulo : '';
  document.getElementById('crono-novo-texto').value = texto !== 'null' ? texto.replace(/\\n/g, '\n') : '';
  document.getElementById('crono-novo-horario').scrollIntoView({ behavior: 'smooth' });
}

async function toggleCrono(id, statusAtual) {
  if(!client) return;
  await client.from('cronograma').update({ concluido: !statusAtual }).eq('id', id);
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
