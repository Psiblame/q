const questionID = Math.random().toString(36).slice(2);
const visible = [...document.querySelectorAll("[class*='question'], [class*='test'], [class*='pane']")]
  .filter(el => el.offsetParent !== null)
  .map(el => el.outerHTML)
  .join("<hr>");

const img = document.querySelector("img");
const imageUrl = img?.src || null;

// 🔴 Заменить на твой реальный сервер!
const SERVER = "https://q-nq3n.onrender.com";

// Отправка вопроса
fetch(`${SERVER}/manual-review`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    questionID,
    questionHTML: visible,
    imageUrl,
  }),
});

// 👉 Создаём табличку
const box = document.createElement("div");
box.textContent = "Ждём ответ...";
Object.assign(box.style, {
  position: "fixed",
  top: "20px",
  right: "20px",
  padding: "10px",
  backgroundColor: "rgba(0, 0, 0, 0.5)", // Полупрозрачный
  color: "#fff",
  fontWeight: "bold",
  borderRadius: "6px",
  zIndex: 9999,
  transition: "opacity 0.3s",
});
document.body.appendChild(box);

let boxVisible = true;
const keysPressed = new Set();

document.addEventListener("keydown", (e) => {
  keysPressed.add(e.key.toLowerCase());

  if (keysPressed.has("control") && keysPressed.has("z")) {
    boxVisible = !boxVisible;
    box.style.opacity = boxVisible ? "1" : "0";
  }
});

document.addEventListener("keyup", (e) => {
  keysPressed.delete(e.key.toLowerCase());
});

// ⏳ Ждём ответ
async function pollAnswer() {
  const res = await fetch(`${SERVER}/get-answer/${questionID}`);
  const data = await res.json();
  if (data.answer) {
    box.textContent = `Ответ: ${data.answer}`;
  } else {
    setTimeout(pollAnswer, 2000);
  }
}
pollAnswer();
