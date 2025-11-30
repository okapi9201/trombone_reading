const VF = Vex.Flow;

// =============== [ 効果音 (SE) のロード ] ===============
const se_select = new Audio('SE/カーソル移動4.mp3');
const se_correct = new Audio('SE/クイズ正解2.mp3');
const se_result = new Audio('SE/決定ボタンを押す24.mp3');

function playSe(audioElement) {
    audioElement.currentTime = 0;
    audioElement.play().catch(e => console.error("Audio playback failed:", e));
}
// =========================================================

// =============== [ 計測・状態管理変数 ] ===============
let totalTime = 60; 
let currentTime = totalTime; 
let currentQuestionCount = 0; 
let timerInterval = null; 
let isPaused = false; 
let quizInProgress = false; 

// =============== [ 回答状態 ] ===============
let selectedNoteName = null;
let selectedPosition = null;

let currentNoteVF = "";
let correctGermanName = "";
let correctPositions = [];

// ★ 追加: 現在選択されている難易度設定を保持する変数
let currentQuizSetting = null;

// =============== [ データ定義 ] ===============

// VexFlowキーと正解の音名・ポジションを紐付けたデータ
const notePositionData = {
    "bb/2": { german: "B", positions: [1], enharmonics: ["Ais"] },
    "b/2": { german: "H", positions: [7], enharmonics: [] },
    "c/3": { german: "C", positions: [6], enharmonics: [] },
    "c#/3": { german: "Cis", positions: [5], enharmonics: ["Des"] },
    "db/3": { german: "Des", positions: [5], enharmonics: ["Cis"] },
    "d/3": { german: "D", positions: [4], enharmonics: [] },
    "d#/3": { german: "Dis", positions: [3], enharmonics: ["Es"] },
    "eb/3": { german: "Es", positions: [3], enharmonics: ["Dis"] },
    "e/3": { german: "E", positions: [2], enharmonics: [] },
    "f/3": { german: "F", positions: [1], enharmonics: [] },
    "f#/3": { german: "Fis", positions: [5], enharmonics: ["Ges"] },
    "gb/3": { german: "Ges", positions: [5], enharmonics: ["Fis"] },
    "g/3": { german: "G", positions: [4], enharmonics: [] },
    "g#/3": { german: "Gis", positions: [3], enharmonics: ["As"] },
    "ab/3": { german: "As", positions: [3], enharmonics: ["Gis"] },
    "a/3": { german: "A", positions: [2], enharmonics: [] },
    "bb/3": { german: "B", positions: [1], enharmonics: ["Ais"] }
};

const allVexFlowKeys = Object.keys(notePositionData);
const allGermanNames = [...new Set(Object.values(notePositionData).map(d => d.german).concat(["Ais"]))];
const allPositions = [1, 2, 3, 4, 5, 6, 7];

// ★ 難易度ごとの詳細設定 (allowEnharmonics: false で固定)
const quizSettings = {
    "難易度1 (60s)": { 
        time: 60, 
        allowEnharmonics: false, // 異名同音を不正解に固定
        pitchRange: ["bb/2", "bb/3"] 
    }
};

// ★ 難易度設定 (プルダウン表示用)
const difficultySettings = {
    "難易度1 (60s)": "難易度1 (60s)"
};


// =============== [ 初期化・開始処理 ] ===============

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("decisionBtn").onclick = checkDecision;
    
    // リトライ時は currentQuizSetting を参照するように修正
    document.getElementById("retryBtn").onclick = () => startQuiz(currentQuizSetting.key); 
    document.getElementById("titleBtn").onclick = resetQuiz; 
    
    resetQuiz(); 
});


// ★ 難易度のキー名を受け取るように修正
function startQuiz(difficultyKey) { 
    // 設定オブジェクトを取得し、変数に保持
    currentQuizSetting = {
        key: difficultyKey,
        ...quizSettings[difficultyKey]
    };

    if (timerInterval) clearInterval(timerInterval);
    
    // 選択された難易度設定から時間を取得
    totalTime = currentQuizSetting.time; 
    currentQuestionCount = 0;
    currentTime = totalTime;
    isPaused = false;
    quizInProgress = true;
    
    document.getElementById("timerDisplay").innerHTML = `残り時間: <span>${currentTime}</span>秒`;
    document.getElementById("questionCount").innerHTML = `正解数: <span>${currentQuestionCount}</span>問`;
    document.getElementById("result").textContent = "";
    
    document.getElementById("finalResultDisplay").style.display = 'none';
    document.getElementById("resultButtons").style.display = 'none';

    document.getElementById("decisionBtn").style.display = 'block';
    
    nextQuestion();
    
    timerInterval = setInterval(updateTimer, 1000);

    document.getElementById("nextBtn").style.display = 'none';
}

function updateTimer() {
    if (isPaused) {
        return; 
    }
    
    currentTime--;
    document.getElementById("timerDisplay").innerHTML = `残り時間: <span>${currentTime}</span>秒`;

    if (currentTime <= 0) {
        clearInterval(timerInterval);
        finishQuiz(true);
    }
}

function nextQuestion() {
    if (!quizInProgress || currentTime <= 0) return;

    selectedNoteName = null;
    selectedPosition = null;
    document.getElementById("result").textContent = "";
    document.getElementById("decisionBtn").disabled = true;
    
    currentNoteVF = allVexFlowKeys[Math.floor(Math.random() * allVexFlowKeys.length)];
    const noteData = notePositionData[currentNoteVF];
    
    correctGermanName = noteData.german;
    correctPositions = noteData.positions;

    drawNote(currentNoteVF);

    // 異名同音は不正解なので、enharmonicsは空配列として選択肢生成に渡す
    renderNoteChoices(correctGermanName, []); 
    renderPositionChoices(correctPositions);

    document.getElementById("nextBtn").style.display = 'none';
    document.getElementById("decisionBtn").style.display = 'block';
}


function renderNoteChoices(correctName, enharmonics) {
    const noteChoicesDiv = document.getElementById("noteChoices");
    noteChoicesDiv.innerHTML = "<h4>音名選択</h4>";
    noteChoicesDiv.style.border = '1px solid #ccc';
    
    // 異名同音は不正解なので、選択肢プールには主音名のみを入れる
    const allowedNames = [correctName]; 
    
    const uniqueWrongNames = allGermanNames.filter(name => !allowedNames.includes(name));
    const wrongChoices = shuffle(uniqueWrongNames).slice(0, 3);
    const options = shuffle([...allowedNames, ...wrongChoices].slice(0, 4));

    options.forEach(opt => {
        const btn = document.createElement("button");
        btn.textContent = opt;
        btn.onclick = () => selectNoteName(opt, btn);
        noteChoicesDiv.appendChild(btn);
    });
}

function renderPositionChoices(correctPos) {
    const positionChoicesDiv = document.getElementById("positionChoices");
    positionChoicesDiv.innerHTML = "<h4>ポジション選択</h4>";
    positionChoicesDiv.style.border = '1px solid #ccc';
    
    const uniqueWrongPositions = allPositions.filter(pos => !correctPos.includes(pos));
    const wrongChoices = shuffle(uniqueWrongPositions).slice(0, 4 - Math.min(4, correctPos.length));
    const posOptionSet = new Set();
    posOptionSet.add(correctPos[Math.floor(Math.random() * correctPos.length)]);
    wrongChoices.forEach(pos => posOptionSet.add(pos));
    
    const options = shuffle(Array.from(posOptionSet).slice(0, 4));

    options.forEach(opt => {
        const btn = document.createElement("button");
        btn.textContent = opt + " Pos";
        btn.onclick = () => selectPosition(opt, btn);
        positionChoicesDiv.appendChild(btn);
    });
}

function selectNoteName(name, button) {
    selectedNoteName = name;
    
    Array.from(document.getElementById("noteChoices").children).forEach(btn => {
        if (btn.tagName === 'BUTTON') {
            btn.classList.remove('selected');
        }
    });
    button.classList.add('selected');
    
    playSe(se_select); 
    
    checkSelectionState();
}

function selectPosition(pos, button) {
    selectedPosition = pos;
    
    Array.from(document.getElementById("positionChoices").children).forEach(btn => {
        if (btn.tagName === 'BUTTON') {
            btn.classList.remove('selected');
        }
    });
    button.classList.add('selected');
    
    playSe(se_select); 
    
    checkSelectionState();
}

function checkSelectionState() {
    const decisionBtn = document.getElementById("decisionBtn");
    if (selectedNoteName !== null && selectedPosition !== null) {
        decisionBtn.disabled = false;
    } else {
        decisionBtn.disabled = true;
    }
}


function drawNote(noteVF) {
    const div = document.getElementById("score");
    div.innerHTML = ""; 

    const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);
    renderer.resize(300, 150);
    const context = renderer.getContext();

    const stave = new VF.Stave(10, 40, 280);
    stave.addClef("bass"); 
    stave.setContext(context).draw();

    const noteKey = noteVF.split("/")[0];
    const octave = noteVF.split("/")[1];
   
    const keysArray = [`${noteKey}/${octave}`];

    const staveNote = new VF.StaveNote({
      clef: "bass", 
      keys: keysArray,
      duration: "w"
    });
    
    if (noteKey !== "b") {
        if (noteKey.endsWith("#")) {
            staveNote.addModifier(new VF.Accidental("#"), 0);
        } else if (noteKey.endsWith("b")) {
            staveNote.addModifier(new VF.Accidental("b"), 0);
        }
    }

    const voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).addTickables([staveNote]);
    new VF.Formatter().joinVoices([voice]).format([voice], 270);
    voice.draw(context, stave);
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}


// =============== [ 正誤・決定処理 ] ===============

function checkDecision() {
    if (selectedNoteName === null || selectedPosition === null) return;
    
    isPaused = true; 
    
    Array.from(document.getElementById("noteChoices").getElementsByTagName('button')).forEach(btn => btn.disabled = true);
    Array.from(document.getElementById("positionChoices").getElementsByTagName('button')).forEach(btn => btn.disabled = true);
    document.getElementById("decisionBtn").disabled = true;
    
    const currentNoteData = notePositionData[currentNoteVF];
    // ★ 異名同音を無視し、出題された音符の主音名のみを正解リストとする
    const correctNames = [currentNoteData.german]; 
    
    const isNoteCorrect = correctNames.includes(selectedNoteName);
    const isPositionCorrect = currentNoteData.positions.includes(selectedPosition);
    
    const isTotalCorrect = isNoteCorrect && isPositionCorrect;

    let feedback = "";
    if (isNoteCorrect) {
        feedback += "✅ 音名: 正解！ ";
    } else {
        // フィードバックには、主音名と異名同音の両方を表示して分かりやすくする
        let displayCorrectName = currentNoteData.german;
        if (currentNoteData.enharmonics.length > 0) {
            displayCorrectName += ' / ' + currentNoteData.enharmonics.join('/');
        }
        
        feedback += `❌ 音名: 不正解... (正解: ${displayCorrectName}) `;
    }
    
    if (isPositionCorrect) {
        feedback += "✅ ポジション: 正解！";
    } else {
        feedback += `❌ ポジション: 不正解... (正解: ${currentNoteData.positions.join(', ')} Pos)`;
    }
    
    document.getElementById("result").innerHTML = feedback;

    if (isTotalCorrect) {
        playSe(se_correct);
        
        currentQuestionCount++; 
        document.getElementById("questionCount").innerHTML = `正解数: <span>${currentQuestionCount}</span>問`;
        
        if (currentTime > 0) {
            const nextBtn = document.getElementById("nextBtn");
            nextBtn.textContent = "次の問題へ";
            nextBtn.style.display = 'block'; 
            nextBtn.onclick = () => {
                isPaused = false; 
                nextQuestion();
            };
            document.getElementById("decisionBtn").style.display = 'none';
        }
    } 
    else {
        document.getElementById("result").innerHTML += "<br>再挑戦！";
        
        Array.from(document.getElementById("noteChoices").getElementsByTagName('button')).forEach(btn => btn.disabled = false);
        Array.from(document.getElementById("positionChoices").getElementsByTagName('button')).forEach(btn => btn.disabled = false);
        
        if (selectedNoteName !== null && selectedPosition !== null) {
            document.getElementById("decisionBtn").disabled = false;
        }
    }
}

/**
 * 正答数に基づきクリアランクを判定する
 * @param {number} score - 最終正答数
 * @returns {string} ランク名
 */
function getClearRank(score) {
    if (score >= 25) {
        return "SSランク";
    } else if (score >= 20) {
        return "Sランク";
    } else if (score >= 15) {
        return "Aランク";
    } else if (score >= 10) {
        return "Bランク";
    } else {
        return "Cランク";
    }
}


function finishQuiz(timeUp = false) {
    clearInterval(timerInterval);
    isPaused = true;
    quizInProgress = false;
    
    playSe(se_result);
    
    const rank = getClearRank(currentQuestionCount);
    
    const resultDisplay = document.getElementById("finalResultDisplay");
    
    resultDisplay.style.display = 'block';
    
    resultDisplay.innerHTML = 
        `<h2>${timeUp ? '⏰ 時間切れ！' : '🎉 クイズ終了！'}</h2>` +
        `<p>最終正答数: <span>${currentQuestionCount}</span> 問</p>` +
        `<p>クリアランク: <span style="font-size: 1.2em; font-weight: bold; color: #d32f2f;">${rank}</span></p>`; 

    document.getElementById("result").textContent = "";
    document.getElementById("score").innerHTML = "";
    document.getElementById("noteChoices").innerHTML = "";
    document.getElementById("positionChoices").innerHTML = "";
    document.getElementById("decisionBtn").style.display = 'none';
    document.getElementById("nextBtn").style.display = 'none';
    
    document.getElementById("resultButtons").style.display = 'block';
}


function resetQuiz() {
    clearInterval(timerInterval);
    currentQuestionCount = 0;
    quizInProgress = false;
    currentQuizSetting = null; // リセット時に設定もクリア
    
    document.getElementById("appTitle").textContent = "Trombone Reading Training";
    document.getElementById("timerDisplay").innerHTML = ""; 
    document.getElementById("questionCount").innerHTML = "難易度を選んでください"; 
    document.getElementById("result").textContent = "";
    document.getElementById("score").innerHTML = "";
    
    document.getElementById("noteChoices").innerHTML = "";
    document.getElementById("positionChoices").innerHTML = "";
    document.getElementById("noteChoices").style.border = 'none';
    document.getElementById("positionChoices").style.border = 'none';
    
    document.getElementById("finalResultDisplay").style.display = 'none';
    document.getElementById("resultButtons").style.display = 'none';

    // --- 難易度選択プルダウンを生成する部分 ---
    const select = document.createElement("select");
    select.id = "difficultySelect";
    
    // 難易度設定からプルダウンを生成
    for (const [key, value] of Object.entries(difficultySettings)) {
        const option = document.createElement("option");
        option.value = value; // キー名 ("難易度1 (60s)") が入る
        option.textContent = key;
        select.appendChild(option);
    }
    
    const noteChoicesDiv = document.getElementById("noteChoices");
    noteChoicesDiv.innerHTML = "<h4>難易度選択</h4>";
    noteChoicesDiv.appendChild(select); 
    
    const nextBtn = document.getElementById("nextBtn");
    nextBtn.textContent = "スタート";
    nextBtn.style.display = 'block';
    
    nextBtn.onclick = () => {
        // プルダウンからキー名を取得して startQuiz に渡す
        const difficultyKey = document.getElementById("difficultySelect").value;
        startQuiz(difficultyKey); 
    }; 
    
    document.getElementById("decisionBtn").style.display = 'none';
}