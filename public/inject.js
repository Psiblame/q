const questionID = Date.now().toString(36) + Math.random().toString(36).slice(2);
const visible = [...document.querySelectorAll("[class*='question'], [class*='test'], [class*='pane']")]
  .filter(el => el.offsetParent !== null)
  .map(el => el.outerHTML)
  .join("<hr>");

const img = document.querySelector("img.question-image") || document.querySelector("img");
const imageUrl = img?.src || null;

const SERVER = "https://q-nq3n.onrender.com";

// Создаём плавающий блок
const box = document.createElement("div");
box.textContent = "Ждём ответ...";
Object.assign(box.style, {
  position: "fixed",
  top: "20px",
  right: "20px",
  padding: "10px",
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  color: "#fff",
  fontWeight: "bold",
  borderRadius: "6px",
  zIndex: 9999,
  transition: "opacity 0.3s",
});
document.body.appendChild(box);

// Отправка вопроса
async function sendQuestion() {
  try {
    if (!visible) {
      throw new Error("Не удалось собрать содержимое вопроса");
    }
    const response = await fetch(`${SERVER}/manual-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionID,
        questionHTML: visible,
        imageUrl,
      }),
    });
    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status}`);
    }
    const data = await response.json();
    box.textContent = "Вопрос отправлен, ждём ответ...";
  } catch (error) {
    box.textContent = `Ошибка: ${error.message}`;
    box.style.backgroundColor = "rgba(255, 0, 0, 0.5)";
  }
}
sendQuestion();

// Управление видимостью блока
let boxVisible = true;
const keysPressed = new Set();

document.addEventListener("keydown", (e) => {
  keysPressed.add(e.key.toLowerCase());
  if (keysPressed.has("control") && keysPressed.has("z")) {
    boxVisible = !boxVisible;
    box.style.opacity = boxVisible ? "1" : "0";
    box.textContent = boxVisible ? "Ждём ответ..." : "Скрыто (Ctrl+Z для показа)";
  }
});

document.addEventListener("keyup", (e) => {
  keysPressed.delete(e.key.toLowerCase());
});

// Периодический опрос ответа
async function pollAnswer(attempts = 30, interval = 2000) {
  try {
    const res = await fetch(`${SERVER}/get-answer/${questionID}`);
    if (!res.ok) {
      throw new Error(`Ошибка сервера: ${res.status}`);
    }
    const data = await res.json();
    if (data.answer) {
      box.textContent = `Ответ: ${data.answer}`;
      box.style.backgroundColor = "rgba(0, 128, 0, 0.5)";
    } else if (attempts > 0) {
      setTimeout(() => pollAnswer(attempts - 1, interval), interval);
    } else {
      box.textContent = "Ответ не получен";
      box.style.backgroundColor = "rgba(255, 0, 0, 0.5)";
    }
  } catch (error) {
    box.textContent = `Ошибка: ${error.message}`;
    box.style.backgroundColor = "rgba(255, 0, 0, 0.5)";
  }
}
pollAnswer();
