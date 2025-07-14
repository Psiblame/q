const SERVER = "https://q-nq3n.onrender.com";
const scriptSrc = document.currentScript?.src || "https://q-nq3n.onrender.com/u1";
const uid = scriptSrc.match(/\/(u1|u2|mohir)/)?.[1] || "u1";
const boxes = {};
let currentQuestionId = null;
let pollTimeout = null;

console.log(`[Inject] UID: ${uid}, Script loaded`);

function createBox(questionID) {
  console.log(`[Inject] Creating box for ${questionID}`);
  const box = document.createElement("div");
  const savedAnswer = localStorage.getItem(`boxAnswer_${uid}_${questionID}`);
  box.textContent = savedAnswer
    ? `Ответ: ${savedAnswer}`
    : (localStorage.getItem(`boxText_${uid}_${questionID}`) || "Ждём ответ...");

  Object.assign(box.style, {
    position: "fixed",
    top: localStorage.getItem(`boxPosition_${uid}_${questionID}_top`) || "80px",
    right: localStorage.getItem(`boxPosition_${uid}_${questionID}_right`) || "20px",
    padding: "10px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "rgba(0, 0, 0, 0.2)",
    fontWeight: "bold",
    borderRadius: "6px",
    zIndex: 1000,
    border: "1px solid rgba(0, 0, 0, 0.1)",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    display: localStorage.getItem(`boxVisible_${uid}_${questionID}`) !== "false" ? "block" : "none",
    cursor: "move",
    userSelect: "none",
    transition: "opacity 0.3s"
  });
  document.body.appendChild(box);
  boxes[questionID] = { element: box, visible: localStorage.getItem(`boxVisible_${uid}_${questionID}`) !== "false" };

  let isDragging = false;
  let currentX, currentY;
  box.addEventListener("mousedown", (e) => {
    isDragging = true;
    currentX = e.clientX - parseFloat(box.style.left || box.getBoundingClientRect().left);
    currentY = e.clientY - parseFloat(box.style.top || box.getBoundingClientRect().top);
    console.log(`[Inject] Started dragging ${questionID}`);
  });
  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      e.preventDefault();
      box.style.left = `${e.clientX - currentX}px`;
      box.style.top = `${e.clientY - currentY}px`;
      box.style.right = "auto";
    }
  });
  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      localStorage.setItem(`boxPosition_${uid}_${questionID}_top`, box.style.top);
      localStorage.setItem(`boxPosition_${uid}_${questionID}_right`, "auto");
      console.log(`[Inject] Stopped dragging ${questionID}, position: top=${box.style.top}, left=${box.style.left}`);
    }
  });

  return box;
}

const keysPressed = new Set();
document.addEventListener("keydown", (e) => {
  keysPressed.add(e.key.toLowerCase());
  if (keysPressed.has("control") && keysPressed.has("z") && currentQuestionId) {
    const box = boxes[currentQuestionId];
    if (box) {
      box.visible = !box.visible;
      box.element.style.display = box.visible ? "block" : "none";
      localStorage.setItem(`boxVisible_${uid}_${currentQuestionId}`, box.visible);
      console.log(`[Inject] Toggled visibility for ${currentQuestionId}: ${box.visible}`);
    }
  }
});
document.addEventListener("keyup", (e) => keysPressed.delete(e.key.toLowerCase()));

function getCurrentQuestionNumber() {
  const progress = document.querySelector(".progress");
  if (progress) {
    const match = progress.textContent.match(/(\d+)\/\d+/);
    if (match) {
      console.log(`[Inject] Found question number in .progress: ${match[1]}`);
      return parseInt(match[1]);
    }
  }
  const currentQnum = document.querySelector(".qnum.current");
  if (currentQnum) {
    const num = parseInt(currentQnum.textContent);
    if (num) {
      console.log(`[Inject] Found question number in .qnum.current: ${num}`);
      return num;
    }
  }
  console.log("[Inject] Could not find question number");
  return 1;
}

function getCurrentQuestion(questionNumber) {
  if (window.questions && window.questions[questionNumber - 1]) {
    const q = window.questions[questionNumber - 1];
    console.log(`[Inject] Found question q${questionNumber} in window.questions`);
    return {
      questionID: `q${questionNumber}`,
      questionHTML: `
        <div class="question-wrap">
          <div class="question-text">${q.question || ''}</div>
          <span class="ball-badge">Балл: ${q.ball || 'N/A'}</span>
          <div class="answers">${q.answers ? Object.entries(q.answers)
            .map(([key, text]) => `<div class="answer"><span class="answer-letter">${key.toUpperCase()}</span> ${text || ''}</div>`)
            .join("") : ''}</div>
          <div class="author">${q.author || 'Unknown'}</div>
        </div>`,
      imageUrl: null
    };
  }
  const questionWrap = document.querySelector(".question-wrap");
  if (questionWrap) {
    console.log(`[Inject] Collecting question q${questionNumber} from DOM`);
    return {
      questionID: `q${questionNumber}`,
      questionHTML: questionWrap.outerHTML,
      imageUrl: document.querySelector("img")?.src || null
    };
  }
  console.log(`[Inject] Could not collect question q${questionNumber}`);
  return null;
}

async function sendQuestion(questionNumber) {
  const q = getCurrentQuestion(questionNumber);
  if (!q) {
    console.log(`[Inject] No question data for q${questionNumber}`);
    if (boxes[`q${questionNumber}`]) boxes[`q${questionNumber}`].element.textContent = "Ошибка: Не удалось собрать вопрос";
    return;
  }

  // 🛡 Пропуск, если уже есть сохранённый ответ
  if (localStorage.getItem(`boxAnswer_${uid}_${q.questionID}`)) {
    console.log(`[Inject] Answer already saved for ${q.questionID}, skipping send`);
    return;
  }

  let retries = 3;
  while (retries > 0) {
    try {
      console.log(`[Inject] Sending ${q.questionID} to ${SERVER}/manual-review/${uid}`);
      const response = await fetch(`${SERVER}/manual-review/${uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(q),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(`Server error: ${response.status}, ${result.message || ''}`);
      console.log(`[Inject] Question ${q.questionID} sent: ${result.message}`);
      if (boxes[q.questionID] && !localStorage.getItem(`boxAnswer_${uid}_${q.questionID}`)) {
        boxes[q.questionID].element.textContent = "Вопрос отправлен, ждём ответ...";
        localStorage.setItem(`boxText_${uid}_${q.questionID}`, boxes[q.questionID].element.textContent);
      }
      break;
    } catch (error) {
      console.error(`[Inject] Error sending ${q.questionID}: ${error.message}, retries left: ${retries}`);
      retries--;
      if (retries === 0) {
        console.error(`[Inject] Failed to send ${q.questionID} after retries`);
        if (boxes[q.questionID]) {
          boxes[q.questionID].element.textContent = `Ошибка: ${error.message}`;
          localStorage.setItem(`boxText_${uid}_${q.questionID}`, boxes[q.questionID].element.textContent);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

function setupClickHandlers() {
  document.querySelectorAll(".qnum").forEach(qnum => {
    qnum.removeEventListener("click", handleClick);
    qnum.addEventListener("click", handleClick);
  });
  document.querySelectorAll(".answer").forEach(answer => {
    answer.removeEventListener("click", handleClick);
    answer.addEventListener("click", handleClick);
  });
}

function handleClick() {
  const num = getCurrentQuestionNumber();
  if (num) {
    console.log(`[Inject] Clicked question/answer ${num}`);
    sendQuestion(num);
    handleQuestion(num);
  }
}

async function handleQuestion(manualQuestionNumber = null) {
  let questionNumber = manualQuestionNumber || getCurrentQuestionNumber();
  if (!questionNumber || questionNumber < 1 || questionNumber > 10) {
    console.log(`[Inject] Invalid question number: ${questionNumber}, using fallback`);
    questionNumber = 1;
  }
  let questionID = `q${questionNumber}`;

  if (questionID === currentQuestionId) {
    console.log(`[Inject] Question ${questionID} already active`);
    return;
  }

  console.log(`[Inject] Handling question: ${questionID}`);
  Object.values(boxes).forEach(box => box.element.style.display = "none");
  currentQuestionId = questionID;

  let box = boxes[questionID]?.element;
  if (!box) {
    box = createBox(questionID);
  } else if (boxes[questionID].visible) {
    box.style.display = "block";
  }

  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
    console.log(`[Inject] Cleared previous poll for ${currentQuestionId}`);
  }

  async function pollAnswer() {
    if (questionID !== currentQuestionId) {
      console.log(`[Inject] Aborting poll for ${questionID} as current question is ${currentQuestionId}`);
      return;
    }

    if (localStorage.getItem(`boxAnswer_${uid}_${questionID}`)) {
      console.log(`[Inject] Answer for ${questionID} already saved locally`);
      return;
    }

    try {
      console.log(`[Inject] Polling answer for ${questionID}`);
      const res = await fetch(`${SERVER}/get-answer/${uid}/${questionID}`);
      const data = await res.json();
      if (!res.ok) throw new Error(`Server error: ${res.status}, ${data.message || ''}`);
      if (data.answer && questionID === currentQuestionId) {
        const answerText = `Ответ: ${data.answer}`;
        boxes[questionID].element.textContent = answerText;
        localStorage.setItem(`boxAnswer_${uid}_${questionID}`, data.answer);
        localStorage.setItem(`boxText_${uid}_${questionID}`, answerText);
        if (boxes[questionID].visible) boxes[questionID].element.style.display = "block";
        console.log(`[Inject] Answer for ${questionID}: ${data.answer}`);
      } else {
        pollTimeout = setTimeout(pollAnswer, 2000);
      }
    } catch (error) {
      if (questionID === currentQuestionId) {
        boxes[questionID].element.textContent = `Ошибка: ${error.message}`;
        localStorage.setItem(`boxText_${uid}_${questionID}`, boxes[questionID].element.textContent);
        console.error(`[Inject] Error polling ${questionID}: ${error.message}`);
        pollTimeout = setTimeout(pollAnswer, 2000);
      }
    }
  }
  pollAnswer();
}

const observer = new MutationObserver(() => {
  console.log("[Inject] DOM changed, checking question");
  handleQuestion();
  setupClickHandlers();
});
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
});

console.log("[Inject] Initializing");
setupClickHandlers();
handleQuestion();

window.manualSetQuestion = function(questionNumber) {
  console.log(`[Inject] Manually set question: ${questionNumber}`);
  sendQuestion(questionNumber);
  handleQuestion(questionNumber);
};

setTimeout(() => {
  if (!currentQuestionId) {
    console.log("[Inject] No question detected, forcing q1");
    handleQuestion(1);
  }
}, 5000);
