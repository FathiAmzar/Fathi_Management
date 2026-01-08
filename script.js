fetch("quiz-data.json")
  .then(res => res.json())
  .then(data => {
    document.getElementById("appTitle").textContent = data.appTitle;

    const quizDiv = document.getElementById("quiz");

    data.chapters.forEach(chapter => {
      const chapterCard = document.createElement("div");
      chapterCard.className = "card";

      chapterCard.innerHTML = `<h2>${chapter.title}</h2>`;

      chapter.questions.forEach(q => {
        const qDiv = document.createElement("div");
        qDiv.innerHTML = `<p><strong>${q.question}</strong></p>`;

        if (q.type === "ordering") {
          q.correctOrder.forEach(item => {
            const btn = document.createElement("button");
            btn.textContent = item;
            qDiv.appendChild(btn);
          });
        }

        if (q.type === "matching") {
          q.left.forEach(item => {
            const btn = document.createElement("button");
            btn.textContent = item;
            qDiv.appendChild(btn);
          });
        }

        chapterCard.appendChild(qDiv);
      });

      quizDiv.appendChild(chapterCard);
    });
  });
