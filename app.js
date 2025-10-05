// Estados conforme perguntas disponíveis no questions.json
const STATES = [
  "Ceará","Rio de Janeiro","Goiás","Amazonas","Maranhão","Mato Grosso do Sul","Minas Gerais","Paraná","Paraíba","Pará","Pernambuco","Piauí","Rio Grande do Sul","São Paulo"
];

const wheelCanvas = document.getElementById('wheel');
const ctx = wheelCanvas.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const quizCard = document.getElementById('quizCard');
const questionText = document.getElementById('questionText');
const optionsContainer = document.getElementById('options');
const stateBadge = document.getElementById('stateBadge');
const feedback = document.getElementById('feedback');
const fxLayer = document.getElementById('fxLayer');
const timer = document.getElementById('timer');
const timerBar = document.getElementById('timerBar');
const timerText = document.getElementById('timerText');
const rewardsModal = document.getElementById('rewardsModal');
const bgMusic = document.getElementById('bgMusic');
const muteBtn = document.getElementById('muteBtn');
const nextBtn = document.getElementById('nextBtn') || { disabled:false };
// sem contadores na UI

let angle = -Math.PI/2; // start at top
let spinning = false;
let questionsByState = {};
let currentState = null;
let currentQuestion = null;
let score = { hits: 0, misses: 0 };
let countdownId = null;
let remainingMs = 0;
let prizes = [];
let isMuted = false;

function loadScore(){
  try{ const saved = JSON.parse(localStorage.getItem('sorteio_score')||'null'); if(saved){score=saved;updateScoreUI();} }catch(e){}
}
function saveScore(){ localStorage.setItem('sorteio_score', JSON.stringify(score)); }
function updateScoreUI(){ /* UI de score removida */ }

// Paleta com cores contrastantes (ordem segue STATES)
const SEGMENT_COLORS = ['#f1d43b','#e74c3c','#4a90e2','#2ecc71','#9b59b6','#f39c12','#e67e22','#1abc9c','#34495e','#8e44ad','#f1c40f','#e74c3c','#27ae60','#3498db'];
function segmentColors(i){ return SEGMENT_COLORS[i % SEGMENT_COLORS.length]; }

// Siglas (UF) para exibir nas fatias
const UF = {
  'Ceará':'CE','Rio de Janeiro':'RJ','Goiás':'GO','Amazonas':'AM','Maranhão':'MA','Mato Grosso do Sul':'MS','Minas Gerais':'MG','Paraná':'PR','Paraíba':'PB','Pará':'PA','Pernambuco':'PE','Piauí':'PI','Rio Grande do Sul':'RS','São Paulo':'SP'
};

function drawWheel(){
  const size = wheelCanvas.width; // square
  const radius = size/2 - 10; // account border
  const cx = size/2, cy = size/2;
  ctx.clearRect(0,0,size,size);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  const segAngle = 2*Math.PI / STATES.length;
  for(let i=0;i<STATES.length;i++){
    const start = i*segAngle;
    const end = start + segAngle;
    // slice
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.arc(0,0,radius,start,end);
    ctx.closePath();
    ctx.fillStyle = segmentColors(i);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
  }

  // Desenhar labels POR CIMA de tudo, centralizados e CLIPADOS na fatia
  for(let i=0;i<STATES.length;i++){
    const start = i*segAngle;
    const end = start + segAngle;
    const mid = (start+end)/2;
    const marginAngle = 0.06; // margem para não encostar nas divisões
    const innerR = radius*0.50;
    const outerR = radius*0.90;

    ctx.save();
    // cria máscara da fatia
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.arc(0,0,outerR,start+marginAngle,end-marginAngle);
    ctx.arc(0,0,innerR,end-marginAngle,start+marginAngle,true);
    ctx.closePath();
    ctx.clip();

    // posiciona
    ctx.rotate(mid);
    const label = (UF[STATES[i]] || STATES[i]).toUpperCase();
    let fontSize = 18;
    ctx.font = `900 ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxWidth = (outerR-innerR) * 0.85;
    while(ctx.measureText(label).width > maxWidth && fontSize > 10){
      fontSize -= 1;
      ctx.font = `900 ${fontSize}px Inter, sans-serif`;
    }
    // move ao centro radial entre inner e outer
    const centerR = (innerR + outerR)/2;
    ctx.translate(centerR,0);
    // perpendicular ao arco
    ctx.rotate(Math.PI/2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.strokeText(label,0,0);
    ctx.fillStyle = '#0b0f19';
    ctx.fillText(label,0,0);
    ctx.restore();
  }

  // hub
  ctx.beginPath();
  ctx.arc(0,0,radius*0.18,0,2*Math.PI);
  ctx.fillStyle = '#0a1120';
  ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.4)';
  ctx.lineWidth=2;
  ctx.stroke();

  ctx.restore();
}

function wrapText(context, text, x, y, maxWidth, lineHeight){
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (let n = 0; n < words.length; n++) {
    const testLine = line + (line? ' ':'') + words[n];
    const metrics = context.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      lines.push(line);
      line = words[n];
    } else {
      line = testLine;
    }
  }
  lines.push(line);
  const offset = -((lines.length-1)*lineHeight)/2;
  for(let i=0;i<lines.length;i++){
    context.fillText(lines[i], x, y + offset + i*lineHeight);
  }
}

function pickStateByAngle(finalAngle){
  const normalized = (finalAngle % (2*Math.PI) + 2*Math.PI) % (2*Math.PI);
  const segAngle = 2*Math.PI / STATES.length;
  // Ponteiro no topo (3π/2)
  const pointerAngle = (3*Math.PI/2);
  let index = Math.floor((pointerAngle - normalized + 2*Math.PI) / segAngle) % STATES.length;
  if(index<0) index += STATES.length;
  return { index, state: STATES[index] };
}

function alignAngleToIndex(index){
  const segAngle = 2*Math.PI / STATES.length;
  const pointerAngle = (3*Math.PI/2);
  return pointerAngle - (index + 0.5) * segAngle;
}

function spin(){
  if(spinning) return;
  // garante que o modal esteja oculto e reinicia música
  if(rewardsModal) rewardsModal.hidden = true;
  if(bgMusic && !isMuted) {
    bgMusic.currentTime = 0;
    bgMusic.play().catch(e => console.log('Erro ao tocar música:', e));
  }
  spinning = true; feedback.textContent=''; if(nextBtn) nextBtn.disabled = true; quizCard.hidden = true;
  const extraSpins = 4 + Math.floor(Math.random()*3); // 4-6 voltas
  const target = Math.random()*2*Math.PI;
  const startAngle = angle;
  const endAngle = startAngle + extraSpins*2*Math.PI + target;
  const duration = 3000 + Math.random()*1200;
  const startTime = performance.now();

  function animate(now){
    const t = Math.min(1, (now - startTime)/duration);
    // easeOutCubic
    const eased = 1 - Math.pow(1-t, 3);
    angle = startAngle + (endAngle-startAngle) * eased;
    drawWheel();
    if(t<1){
      requestAnimationFrame(animate);
    } else {
      spinning = false;
      const picked = pickStateByAngle(angle);
      // alinhar o centro do segmento sorteado exatamente ao ponteiro
      angle = alignAngleToIndex(picked.index);
      drawWheel();
      currentState = picked.state;
      // aguarda 2s, entra em modo tela cheia de pergunta
      setTimeout(()=>{
        const appEl = document.getElementById('app');
        appEl.classList.add('quiz-full');
        // manter layout em coluna única (centralizado)
        document.querySelector('.board')?.classList.remove('two');
        loadQuestionForState(currentState);
      }, 2000);
    }
  }
  requestAnimationFrame(animate);
}

async function loadQuestions(){
  try{
    const res = await fetch('./questions.json', { cache: 'no-store' });
    const json = await res.json();
    // Normalize keys for fast access
    questionsByState = json.reduce((acc, q) => {
      const key = q.state.trim();
      (acc[key] ||= []).push(q);
      return acc;
    },{});
  }catch(err){
    console.error('Falha ao carregar questions.json', err);
    questionsByState = {};
  }
}

async function loadPrizes(){
  try{
    const res = await fetch('./prizes.json', { cache: 'no-store' });
    prizes = await res.json();
  }catch(e){
    prizes = [
      { name:'Balinha', weight:60 },
      { name:'Caneta', weight:25 },
      { name:'Bolsa', weight:10 },
      { name:'Boné', weight:5 }
    ];
  }
}

function weightedPick(items){
  const total = items.reduce((s,i)=>s+i.weight,0);
  let r = Math.random()*total;
  for(const it of items){
    if((r-=it.weight) <= 0) return it;
  }
  return items[items.length-1];
}

function showRewards(){
  rewardsModal.hidden = false;
  const cards = rewardsModal.querySelectorAll('.reward-card');
  
  // Sortear o prêmio real primeiro
  const realPrize = weightedPick(prizes);
  
  // Criar prêmios falsos (diferentes do real)
  const fakePrizes = prizes.filter(p => p.name !== realPrize.name);
  
  // resetar cards para mostrar logo e número
  let chosen = false;
  cards.forEach((btn,i)=>{
    const logo = btn.querySelector('.card-logo');
    const number = btn.querySelector('.card-number');
    logo.style.display = 'block';
    number.textContent = String(i+1);
    number.style.display = 'block';
    btn.classList.remove('revealed');
    btn.disabled = false;
    btn.style.opacity = 1; // resetar opacidade
    btn.onclick = ()=>{
      if(chosen) return;
      chosen = true;
      
      // Mostrar prêmio real no card escolhido
      logo.style.display = 'none';
      number.textContent = `🎁 ${realPrize.name}`;
      btn.classList.add('revealed');
      
      // Mostrar prêmios falsos nos outros cards (ilusão visual)
      cards.forEach((otherBtn, otherIndex) => {
        if(otherBtn !== btn) {
          otherBtn.disabled = true;
          otherBtn.style.opacity = 0.5;
          
          // Escolher um prêmio falso aleatório
          const fakePrize = fakePrizes[Math.floor(Math.random() * fakePrizes.length)];
          const otherLogo = otherBtn.querySelector('.card-logo');
          const otherNumber = otherBtn.querySelector('.card-number');
          
          otherLogo.style.display = 'none';
          otherNumber.textContent = `🎁 ${fakePrize.name}`;
          otherBtn.classList.add('revealed');
        }
      });
      
      // fechar após escolha
      setTimeout(()=>{ rewardsModal.hidden = true; }, 2000);
    };
  });
}

function getRandomQuestion(state){
  const list = questionsByState[state] || [];
  if(list.length === 0) return null;
  return list[Math.floor(Math.random()*list.length)];
}

function renderQuestion(){
  if(!currentQuestion){ return; }
  stateBadge.textContent = currentState;
  questionText.textContent = currentQuestion.question;
  optionsContainer.innerHTML = '';
  feedback.textContent = '';
  fxLayer.innerHTML = '';
  // sem botão Próxima: apenas aguarda nova rotação
  startTimer(60000);

  currentQuestion.options.forEach((opt, i)=>{
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.textContent = opt;
    btn.onclick = ()=> selectAnswer(btn, i);
    optionsContainer.appendChild(btn);
  });
  quizCard.hidden = false;
}

function selectAnswer(button, index){
  // prevent multiple
  const already = optionsContainer.querySelector('.option.selected, .option.correct, .option.incorrect');
  if(already) return;
  const isCorrect = index === currentQuestion.answerIndex;
  button.classList.add('selected');
  // marca apenas a escolhida; não revela a correta quando erra
  [...optionsContainer.children].forEach((el, i)=>{
    if(i===index){ el.classList.add(isCorrect ? 'correct' : 'incorrect'); }
  });
  if(isCorrect){
    feedback.textContent = 'Você acertou!';
    score.hits += 1;
    shootConfetti();
    // Mostrar prêmios imediatamente
    setTimeout(()=>{ showRewards(); }, 800);
    // após 5s, volta para a roleta para o próximo jogador
    setTimeout(()=>{
      document.getElementById('app').classList.remove('quiz-full');
      document.querySelector('.board')?.classList.remove('two');
      quizCard.hidden = true;
    }, 5000);
  } else {
    feedback.textContent = 'Você errou.';
    score.misses += 1;
    showSad();
    // após 5s, volta para a roleta
    setTimeout(()=>{
      document.getElementById('app').classList.remove('quiz-full');
      document.querySelector('.board')?.classList.remove('two');
      quizCard.hidden = true;
    }, 5000);
  }
  updateScoreUI();
  saveScore();
  // aguarda nova rotação
  stopTimer();
}

function loadQuestionForState(state){
  currentQuestion = getRandomQuestion(state);
  if(!currentQuestion){
    quizCard.hidden = false;
    stateBadge.textContent = state;
    questionText.textContent = 'Sem perguntas para este estado.';
    optionsContainer.innerHTML = '';
    feedback.textContent = 'Edite o arquivo questions.json para adicionar perguntas.';
    nextBtn.disabled = false;
    return;
  }
  renderQuestion();
}

// removido botão próxima – fluxo segue com nova rotação

function reset(){
  score = { hits:0, misses:0 };
  saveScore();
  updateScoreUI();
  quizCard.hidden = true;
  const appEl = document.getElementById('app');
  appEl.classList.remove('quiz-full');
  document.querySelector('.board')?.classList.remove('two');
  if(rewardsModal) rewardsModal.hidden = true;
}

function resizeCanvas(){
  const size = Math.min(560, Math.min(wheelCanvas.parentElement.clientWidth-32, 560));
  wheelCanvas.width = size;
  wheelCanvas.height = size;
  drawWheel();
}

function startTimer(ms){
  remainingMs = ms;
  timer.hidden = false;
  timerBar.style.width = '100%';
  timerText.textContent = Math.ceil(remainingMs/1000);
  const start = performance.now();
  const end = start + ms;
  if(countdownId) cancelAnimationFrame(countdownId);
  function step(now){
    const left = Math.max(0, end - now);
    remainingMs = left;
    const pct = left / ms;
    timerBar.style.width = `${pct*100}%`;
    timerText.textContent = String(Math.ceil(left/1000));
    if(left>0){ countdownId = requestAnimationFrame(step); }
    else { timeUp(); }
  }
  countdownId = requestAnimationFrame(step);
}

function stopTimer(){
  if(countdownId){ cancelAnimationFrame(countdownId); countdownId = null; }
  timer.hidden = true;
}

function timeUp(){
  // bloqueia respostas se tempo acabou
  if(optionsContainer.querySelector('.option.correct, .option.incorrect')) return;
  feedback.textContent = 'Tempo esgotado.';
  showSad();
  // volta para a roleta após 5s
  setTimeout(()=>{
    document.getElementById('app').classList.remove('quiz-full');
    document.querySelector('.board')?.classList.remove('two');
    quizCard.hidden = true;
  }, 5000);
}

function shootConfetti(){
  const colors = ['#ff6b3d','#ffd166','#06d6a0','#4cc9f0','#c77dff','#ff8fab','#94f7c5'];
  for(let i=0;i<220;i++){
    const p = document.createElement('div');
    p.className = 'confetti';
    p.style.background = colors[i%colors.length];
    p.style.transform = `translate(-50%,0) rotate(${Math.random()*360}deg)`;
    p.style.left = `${50 + (Math.random()*80-40)}%`;
    fxLayer.appendChild(p);
    const duration = 2200 + Math.random()*1800;
    const dx = (Math.random()*2-1)*360;
    const dy = 500 + Math.random()*380;
    p.animate([
      { transform: `translate(${dx*0.0}px, -10px) rotate(0deg)` , opacity:1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(1080deg)`, opacity:0 }
    ], { duration, easing:'cubic-bezier(.2,.7,.2,1)', fill:'forwards' });
    setTimeout(()=>p.remove(), duration+50);
  }
}

function showSad(){
  const el = document.createElement('div');
  el.className = 'sad';
  el.textContent = '😔';
  fxLayer.appendChild(el);
  setTimeout(()=>el.remove(), 1800);
}

// Init
window.addEventListener('resize', resizeCanvas);
spinBtn.addEventListener('click', spin);

loadScore();
resizeCanvas();
Promise.all([loadQuestions(), loadPrizes()]).then(()=>{
  drawWheel();
  // iniciar música em loop
  if(bgMusic && !isMuted) {
    bgMusic.play().catch(e => console.log('Erro ao tocar música:', e));
  }
});

// Controle de mute/unmute
function toggleMute(){
  isMuted = !isMuted;
  if(bgMusic){
    if(isMuted){
      bgMusic.pause();
      muteBtn.classList.add('muted');
      muteBtn.querySelector('.mute-icon').textContent = '🔇';
    } else {
      bgMusic.play().catch(e => console.log('Erro ao tocar música:', e));
      muteBtn.classList.remove('muted');
      muteBtn.querySelector('.mute-icon').textContent = '🔊';
    }
  }
}

muteBtn.addEventListener('click', toggleMute);
