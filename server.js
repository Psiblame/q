const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const allowedUsers = ["u1", "u2", "mohir"]; // Добавляешь сюда айди
const adminLogin = "admin";
const adminPassword = "12345";

const questions = {};
const answers = {};

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// 🔐 Простая basic-авторизация
app.use("/admin", (req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth) {
    res.set("WWW-Authenticate", "Basic");
    return res.status(401).send("Требуется авторизация");
  }

  const [scheme, encoded] = auth.split(" ");
  const decoded = Buffer.from(encoded, "base64").toString();
  const [login, password] = decoded.split(":");

  if (login === adminLogin && password === adminPassword) {
    next();
  } else {
    res.set("WWW-Authenticate", "Basic");
    res.status(401).send("Неверный логин или пароль");
  }
});

// 🎯 Только авторизованные пользователи получают inject
app.get("/:uid", (req, res) => {
  const uid = req.params.uid;
  if (allowedUsers.includes(uid)) {
    res.sendFile(path.join(__dirname, "public", "inject.js"));
  } else {
    res.status(403).send("Нет доступа к этой ссылке");
  }
});

// ⬆️ Получение вопроса
app.post("/manual-review", (req, res) => {
  const { questionID, questionHTML, imageUrl } = req.body;
  questions[questionID] = { html: questionHTML, imageUrl };
  res.sendStatus(200);
});

// ⬇️ Отправка ответа
app.get("/get-answer/:questionID", (req, res) => {
  const { questionID } = req.params;
  const answer = answers[questionID] || null;
  res.json({ answer });
});

// 👀 Панель администратора
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

// 📨 Обработка формы отправки ответа
app.post("/answer", (req, res) => {
  const { id, answer } = req.body;
  answers[id] = answer.toUpperCase();
  res.redirect("/admin");
});

// 🟢 Запуск
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
