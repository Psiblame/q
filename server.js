const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static("public")); // для inject.js

const questions = {}; // questionID: { html, imageUrl }
const answers = {};   // questionID: "B"

// 👉 Выдаёт inject.js по персональной ссылке
app.get("/u:uid", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "inject.js"));
});

// 👉 Принимает вопрос
app.post("/manual-review", (req, res) => {
  const { questionID, questionHTML, imageUrl } = req.body;
  questions[questionID] = { html: questionHTML, imageUrl };
  res.sendStatus(200);
});

// 👉 Отдаёт ответ
app.get("/get-answer/:questionID", (req, res) => {
  const { questionID } = req.params;
  const answer = answers[questionID] || null;
  res.json({ answer });
});

// 👉 Панель администратора
app.get("/admin", (req, res) => {
  let html = `<h2>Admin panel — Вопросы</h2>`;
  for (const [id, q] of Object.entries(questions)) {
    html += `
      <div style="border:1px solid #ccc; padding:10px; margin:10px;">
        <strong>ID:</strong> ${id}<br>
        <form method="POST" action="/answer" style="margin-top:5px;">
          <textarea name="id" hidden>${id}</textarea>
          ${q.imageUrl ? `<img src="${q.imageUrl}" style="max-width:300px;"><br>` : ""}
          <div style="max-height:150px; overflow:auto;">${q.html}</div>
          <input name="answer" placeholder="Введите ответ (напр. A)" required>
          <button type="submit">Отправить</button>
        </form>
      </div>
    `;
  }
  res.send(html);
});

// 👉 Обработка отправки ответа
app.use(bodyParser.urlencoded({ extended: true }));
app.post("/answer", (req, res) => {
  const { id, answer } = req.body;
  answers[id] = answer.toUpperCase();
  res.redirect("/admin");
});

// 🟢 Запуск сервера
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
