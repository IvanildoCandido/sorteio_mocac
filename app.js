// Temas para a roleta
const THEMES = [
  "Personalidades",
  "Música",
  "Cinema",
  "Viagens",
  "Esporte",
  "Novela",
  "Desenho",
  "Tecnologia",
  "Meio Ambiente"
];

const wheelCanvas = document.getElementById('wheel');
const ctx = wheelCanvas.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const quizCard = document.getElementById('quizCard');
const questionText = document.getElementById('questionText');
const optionsContainer = document.getElementById('options');
const themeBadge = document.getElementById('themeBadge');
const feedback = document.getElementById('feedback');
const fxLayer = document.getElementById('fxLayer');
const timer = document.getElementById('timer');
const timerBar = document.getElementById('timerBar');
const timerText = document.getElementById('timerText');
const bgMusic = document.getElementById('bgMusic');
const muteBtn = document.getElementById('muteBtn');
const loadingScreen = document.getElementById('loadingScreen');

let angle = -Math.PI/2; // start at top
let spinning = false;
let questionsByTheme = {};
let currentTheme = null;
let currentQuestion = null;
let score = { hits: 0, misses: 0 };
let countdownId = null;
let remainingMs = 0;
let isMuted = false;
let askedQuestions = {}; // Rastreia perguntas já feitas por tema

function loadScore(){
  try{ 
    const saved = JSON.parse(localStorage.getItem('sorteio_score')||'null'); 
    if(saved){
      score=saved;
      updateScoreUI();
    } 
  }catch(e){}
}

function saveScore(){ 
  localStorage.setItem('sorteio_score', JSON.stringify(score)); 
}

function loadAskedQuestions(){
  try{
    const saved = JSON.parse(localStorage.getItem('sorteio_asked_questions')||'{}');
    askedQuestions = saved;
  }catch(e){
    askedQuestions = {};
  }
}

function saveAskedQuestions(){
  localStorage.setItem('sorteio_asked_questions', JSON.stringify(askedQuestions));
}

function markQuestionAsAsked(theme, questionText){
  if(!askedQuestions[theme]){
    askedQuestions[theme] = [];
  }
  
  if(!askedQuestions[theme].includes(questionText)){
    askedQuestions[theme].push(questionText);
    saveAskedQuestions();
  }
}

function resetAskedQuestions(){
  askedQuestions = {};
  saveAskedQuestions();
}

function updateScoreUI(){ 
  /* UI de score removida */ 
}

// Paleta com cores vibrantes e contrastantes para os temas
const SEGMENT_COLORS = [
  '#ff6b3d', // Laranja vibrante - Personalidades
  '#e74c3c', // Vermelho - Música
  '#9b59b6', // Roxo - Cinema
  '#3498db', // Azul - Viagens
  '#2ecc71', // Verde - Esporte
  '#f39c12', // Amarelo alaranjado - Novela
  '#1abc9c', // Turquesa - Desenho
  '#4a90e2', // Azul claro - Tecnologia
  '#27ae60'  // Verde escuro - Meio Ambiente
];

function segmentColors(i){ 
  return SEGMENT_COLORS[i % SEGMENT_COLORS.length]; 
}

function drawWheel(){
  const size = wheelCanvas.width;
  const radius = size/2 - 10;
  const cx = size/2, cy = size/2;
  ctx.clearRect(0,0,size,size);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  const segAngle = 2*Math.PI / THEMES.length;
  
  for(let i=0;i<THEMES.length;i++){
    const start = i*segAngle;
    const end = start + segAngle;
    
    // Desenhar fatia
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

  // Desenhar labels por cima, centralizados e clipados na fatia
  for(let i=0;i<THEMES.length;i++){
    const start = i*segAngle;
    const end = start + segAngle;
    const mid = (start+end)/2;
    const marginAngle = 0.06;
    const innerR = radius*0.50;
    const outerR = radius*0.90;

    ctx.save();
    
    // Criar máscara da fatia
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.arc(0,0,outerR,start+marginAngle,end-marginAngle);
    ctx.arc(0,0,innerR,end-marginAngle,start+marginAngle,true);
    ctx.closePath();
    ctx.clip();

    // Posicionar
    ctx.rotate(mid);
    const label = THEMES[i].toUpperCase();
    let fontSize = 16;
    ctx.font = `900 ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxWidth = (outerR-innerR) * 0.85;
    
    while(ctx.measureText(label).width > maxWidth && fontSize > 10){
      fontSize -= 1;
      ctx.font = `900 ${fontSize}px Inter, sans-serif`;
    }
    
    // Mover ao centro radial entre inner e outer
    const centerR = (innerR + outerR)/2;
    ctx.translate(centerR,0);
    
    // Perpendicular ao arco
    ctx.rotate(Math.PI/2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.strokeText(label,0,0);
    ctx.fillStyle = '#0b0f19';
    ctx.fillText(label,0,0);
    ctx.restore();
  }

  // Hub central
  ctx.beginPath();
  ctx.arc(0,0,radius*0.18,0,2*Math.PI);
  ctx.fillStyle = '#0a1120';
  ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.4)';
  ctx.lineWidth=2;
  ctx.stroke();

  ctx.restore();
}

function pickThemeByAngle(finalAngle){
  const normalized = (finalAngle % (2*Math.PI) + 2*Math.PI) % (2*Math.PI);
  const segAngle = 2*Math.PI / THEMES.length;
  const pointerAngle = (3*Math.PI/2);
  let index = Math.floor((pointerAngle - normalized + 2*Math.PI) / segAngle) % THEMES.length;
  if(index<0) index += THEMES.length;
  return { index, theme: THEMES[index] };
}

function alignAngleToIndex(index){
  const segAngle = 2*Math.PI / THEMES.length;
  const pointerAngle = (3*Math.PI/2);
  return pointerAngle - (index + 0.5) * segAngle;
}

function spin(){
  if(spinning) return;
  
  if(bgMusic && !isMuted) {
    bgMusic.currentTime = 0;
    bgMusic.play().catch(e => console.log('Erro ao tocar música:', e));
  }
  
  spinning = true; 
  feedback.textContent=''; 
  quizCard.hidden = true;
  
  const extraSpins = 4 + Math.floor(Math.random()*3); // 4-6 voltas
  const target = Math.random()*2*Math.PI;
  const startAngle = angle;
  const endAngle = startAngle + extraSpins*2*Math.PI + target;
  const duration = 3000 + Math.random()*1200;
  const startTime = performance.now();

  function animate(now){
    const t = Math.min(1, (now - startTime)/duration);
    const eased = 1 - Math.pow(1-t, 3); // easeOutCubic
    angle = startAngle + (endAngle-startAngle) * eased;
    drawWheel();
    
    if(t<1){
      requestAnimationFrame(animate);
    } else {
      spinning = false;
      const picked = pickThemeByAngle(angle);
      
      // Alinhar o centro do segmento sorteado exatamente ao ponteiro
      angle = alignAngleToIndex(picked.index);
      drawWheel();
      currentTheme = picked.theme;
      
      // Aguardar 1s, mostrar loading
      setTimeout(()=>{
        // Mostrar loading screen
        loadingScreen.hidden = false;
        
        // Após 2.5s de loading, mostrar pergunta
        setTimeout(()=>{
          loadingScreen.hidden = true;
          const appEl = document.getElementById('app');
          appEl.classList.add('quiz-full');
          document.querySelector('.board')?.classList.remove('two');
          loadQuestionForTheme(currentTheme);
        }, 2500);
      }, 1000);
    }
  }
  requestAnimationFrame(animate);
}

async function loadQuestions(){
  try{
    const res = await fetch('./questions.json', { cache: 'no-store' });
    const json = await res.json();
    
    // Normalizar chaves para acesso rápido
    questionsByTheme = json.reduce((acc, q) => {
      const key = q.theme.trim();
      (acc[key] ||= []).push(q);
      return acc;
    },{});
  }catch(err){
    console.error('Falha ao carregar questions.json', err);
    questionsByTheme = {};
  }
}

function getRandomQuestion(theme){
  const list = questionsByTheme[theme] || [];
  if(list.length === 0) return null;
  
  // Obter perguntas já feitas para este tema
  const asked = askedQuestions[theme] || [];
  
  // Filtrar perguntas não feitas
  const availableQuestions = list.filter(q => !asked.includes(q.question));
  
  // Se todas as perguntas já foram feitas, resetar o tema
  if(availableQuestions.length === 0){
    askedQuestions[theme] = [];
    saveAskedQuestions();
    return list[Math.floor(Math.random()*list.length)];
  }
  
  // Retornar uma pergunta aleatória das disponíveis
  return availableQuestions[Math.floor(Math.random()*availableQuestions.length)];
}

function renderQuestion(){
  if(!currentQuestion){ return; }
  
  // Marcar pergunta como feita
  markQuestionAsAsked(currentTheme, currentQuestion.question);
  
  themeBadge.textContent = currentTheme;
  questionText.textContent = currentQuestion.question;
  optionsContainer.innerHTML = '';
  feedback.textContent = '';
  fxLayer.innerHTML = '';
  
  startTimer(20000); // 20 segundos

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
  // Prevenir múltiplas respostas
  const already = optionsContainer.querySelector('.option.selected, .option.correct, .option.incorrect');
  if(already) return;
  
  const isCorrect = index === currentQuestion.answerIndex;
  button.classList.add('selected');
  
  // Marcar a resposta escolhida e mostrar a correta se errou
  [...optionsContainer.children].forEach((el, i)=>{
    if(i===index){ 
      el.classList.add(isCorrect ? 'correct' : 'incorrect'); 
    }
    // Se errou, mostrar também qual era a resposta correta
    if(!isCorrect && i === currentQuestion.answerIndex){
      el.classList.add('correct');
    }
  });
  
  if(isCorrect){
    feedback.textContent = '🎉 Parabéns! Você acertou!';
    score.hits += 1;
    shootConfetti();
    
    // Após 3s, volta para a roleta para o próximo jogador
    setTimeout(()=>{
      document.getElementById('app').classList.remove('quiz-full');
      document.querySelector('.board')?.classList.remove('two');
      quizCard.hidden = true;
    }, 3000);
  } else {
    feedback.textContent = '❌ Resposta incorreta. A resposta certa está destacada em verde.';
    score.misses += 1;
    showSad();
    
    // Após 5s, volta para a roleta (mais tempo para ver a resposta correta)
    setTimeout(()=>{
      document.getElementById('app').classList.remove('quiz-full');
      document.querySelector('.board')?.classList.remove('two');
      quizCard.hidden = true;
    }, 5000);
  }
  
  updateScoreUI();
  saveScore();
  stopTimer();
}

function loadQuestionForTheme(theme){
  currentQuestion = getRandomQuestion(theme);
  
  if(!currentQuestion){
    quizCard.hidden = false;
    themeBadge.textContent = theme;
    questionText.textContent = 'Sem perguntas para este tema.';
    optionsContainer.innerHTML = '';
    feedback.textContent = 'Edite o arquivo questions.json para adicionar perguntas.';
    return;
  }
  
  renderQuestion();
}

function reset(){
  score = { hits:0, misses:0 };
  saveScore();
  updateScoreUI();
  quizCard.hidden = true;
  const appEl = document.getElementById('app');
  appEl.classList.remove('quiz-full');
  document.querySelector('.board')?.classList.remove('two');
}

function resizeCanvas(){
  const container = wheelCanvas.parentElement;
  const maxSize = Math.min(container.clientWidth, container.clientHeight) - 40;
  const size = Math.min(500, maxSize);
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
    
    if(left>0){ 
      countdownId = requestAnimationFrame(step); 
    } else { 
      timeUp(); 
    }
  }
  countdownId = requestAnimationFrame(step);
}

function stopTimer(){
  if(countdownId){ 
    cancelAnimationFrame(countdownId); 
    countdownId = null; 
  }
  timer.hidden = true;
}

function timeUp(){
  // Bloquear respostas se tempo acabou
  if(optionsContainer.querySelector('.option.correct, .option.incorrect')) return;
  
  // Mostrar a resposta correta quando o tempo acaba
  [...optionsContainer.children].forEach((el, i)=>{
    if(i === currentQuestion.answerIndex){
      el.classList.add('correct');
    }
    // Desabilitar todos os botões
    el.disabled = true;
    el.style.cursor = 'not-allowed';
  });
  
  feedback.textContent = '⏰ Tempo esgotado! A resposta correta está destacada em verde.';
  showSad();
  
  // Voltar para a roleta após 5s (mais tempo para ver a resposta correta)
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
loadAskedQuestions();
resizeCanvas();
loadQuestions().then(()=>{
  drawWheel();
  
  // Iniciar música em loop
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
