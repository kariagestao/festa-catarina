const SUPABASE_URL = 'https://supabase.co';
const SUPABASE_KEY = 'sb_publishable_BEGEdQzqZc2FtPrPgJPh9Q_CQMHioqM';
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let modoAtual = 'telao'; 
let congelado = false;
let fotosCatAtuais = [];
let slideIndex = 0;
let momentoGlobal = 'Recepção';
let intervaloSlide = null;

function inicializarRoteamento() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('control')) {
        modoAtual = 'controle';
        document.getElementById('view-controle').classList.add('active');
        carregarDadosControle();
    } else if (urlParams.has('guest')) {
        modoAtual = 'convidado';
        document.getElementById('view-convidado').classList.add('active');
    } else {
        modoAtual = 'telao';
        document.getElementById('view-telao').classList.add('active');
        inicializarTelão();
    }
}

function switchScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('screen-' + screenName).classList.add('active');
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
}

async function toggleCongelar() {
    congelado = !congelado;
    document.getElementById('btn-congelar').innerText = congelado ? "Telão: CONGELADO" : "Congelar Telão: OFF";
    document.getElementById('btn-congelar').classList.toggle('frozen', congelado);
    if(supabase) await supabase.from('config').upsert({ id: 1, congelado: congelado });
}

async function setMomento(nome) {
    document.querySelectorAll('.moment-btn').forEach(b => b.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
    if(supabase && !congelado) {
        await supabase.from('config').upsert({ id: 1, momento_atual: nome });
    }
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
    if(grid) {
        grid.innerHTML = '';
        if(data) {
            data.forEach(foto => {
                grid.innerHTML += `<div class="photo-slot"><img src="${foto.url}"><button class="remove-btn" onclick="removerFotoCat('${foto.id}')">✕</button></div>`;
            });
        }
    }
}
async function carregarCronograma() {
    const { data } = await supabase.from('cronograma').select('*').order('hora');
    const lista = document.getElementById('cronograma-lista');
    if(lista) {
        lista.innerHTML = '';
        if(data) {
            data.forEach(item => {
                lista.innerHTML += `<div class="crono-item ${item.concluido ? 'done' : ''}" onclick="toggleCrono('${item.id}', ${item.concluido})"><div class="crono-check">✓</div><div class="crono-hora">${item.hora}</div><div class="crono-texto">${item.texto}</div></div>`;
            });
        }
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
    if(lista) {
        lista.innerHTML = '';
        if(data) {
            data.forEach(c => {
                if(c.presente) presentes++;
                lista.innerHTML += `<div class="convidado-item ${c.presente ? 'presente' : ''}" onclick="togglePresenca('${c.id}', ${c.presente})"><div class="conv-check">✓</div><div class="conv-nome">${c.nome}</div><button class="conv-del" onclick="event.stopPropagation(); deletarConvidado('${c.id}')">✕</button></div>`;
            });
        }
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

async function uploadFotoConvidado(input) {
    if (!input.files || input.files.length === 0 || !supabase) return;
    const status = document.getElementById('upload-status');
    status.innerText = "Enviando foto para o telão... ⏳";
    const file = input.files[0];
    const desafio = document.getElementById('guest-escolha-desafio').value;
    const fileName = `guest_${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('desafios-festa').upload(fileName, file);
    if(error) return status.innerText = "Erro ao enviar. Tente novamente!";
    const { data: urlData } = supabase.storage.from('desafios-festa').getPublicUrl(fileName);
    await supabase.from('fotos_desafios').insert({ url: urlData.publicUrl, desafio: desafio, aprovada: true });
    status.innerText = "Pronto! Sua foto acabou de subir para o telão! 🎉";
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
        if (congelado) return;
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
    document.getElementById('telao-subtitulo').innerText = momento;
    
    const canvas = document.getElementById('telao-canvas');
    const containerMidia = document.getElementById('telao-container-midia');
    const arteEstatica = document.getElementById('telao-arte-estatica');

    clearInterval(intervaloSlide);

    if (momento === 'Só a Arte') {
        // Liga o slideshow de fotos e esconde a arte do texto central
        arteEstatica.style.display = 'none';
        containerMidia.style.display = 'block';
        
        const { data } = await supabase.from('fotos_catarina').select('url');
        if(data && data.length > 0) {
            fotosCatAtuais = data.map(f => f.url);
            canvas.src = fotosCatAtuais[0];
            slideIndex = 0;
            rodarSlideshow();
        } else {
            containerMidia.style.display = 'none';
            arteEstatica.style.display = 'flex';
        }
    } else {
        // Conserva a arte estática do fundo em tela cheia e muda a legenda inferior
        containerMidia.style.display = 'none';
        arteEstatica.style.display = 'flex';
    }
}

function rodarSlideshow() {
    intervaloSlide = setInterval(() => {
        if(congelado || fotosCatAtuais.length === 0) return;
        slideIndex = (slideIndex + 1) % fotosCatAtuais.length;
        document.getElementById('telao-canvas').src = fotosCatAtuais[slideIndex];
    }, 5000);
}

function exibirFotoDestaqueNoTelao(url, legenda) {
    clearInterval(intervaloSlide);
    const canvas = document.getElementById('telao-canvas');
    const containerMidia = document.getElementById('telao-container-midia');
    const arteEstatica = document.getElementById('telao-arte-estatica');
    const subtitulo = document.getElementById('telao-subtitulo');
    
    arteEstatica.style.display = 'none';
    containerMidia.style.display = 'block';
    canvas.src = url;
    subtitulo.innerText = `Desafio Concluído: ${legenda}!`;

    setTimeout(() => {
        if (!congelado) atualizarVisualTelao(momentoGlobal);
    }, 8000);
}

function ouvirFotosDosConvidados() {
    const lista = document.getElementById('lista-desafios-stream');
    supabase.channel('stream-controle').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fotos_desafios' }, payload => {
        const f = payload.new;
        if(lista) lista.innerHTML = `<div class="desafio-item"><img src="${f.url}" class="desafio-thumb"><div class="desafio-text"><b>${f.desafio}</b> enviado agora!</div></div>` + lista.innerHTML;
    }).subscribe();
}

window.onload = inicializarRoteamento;
