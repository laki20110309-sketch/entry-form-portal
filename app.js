const API_ORIGIN = "https://entryform-4xosiknu.manus.space";
const app = document.getElementById("app");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

async function trpc(path, input, method = "GET") {
  const endpoint = `${API_ORIGIN}/api/trpc/${path}`;
  const options = { method, headers: { "content-type": "application/json" }, credentials: "omit" };
  if (method === "GET") options.url = `${endpoint}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  else options.body = JSON.stringify({ json: input });
  const response = await fetch(options.url || endpoint, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.json?.message || payload?.error?.message || `送信に失敗しました（${response.status}）`);
  return payload?.result?.data?.json ?? payload?.result?.data;
}

function renderLanding() {
  app.innerHTML = `
    <section class="view active"><div class="hero">
      <p class="eyebrow">FORM MANAGEMENT, REFINED</p>
      <h1>宙aim<em>cup</em><br>エントリーフォーム</h1>
      <p class="lead">2026/09/26–27</p>
      <p class="muted">受付フォームは主催者が発行した専用リンクからご利用ください。</p>
    </div></section>`;
}

function renderError(message) {
  app.innerHTML = `<section class="view active"><div class="hero"><p class="eyebrow">FORM ERROR</p><h1>フォームを<br>表示できません</h1><p class="muted">${escapeHtml(message)}</p></div></section>`;
}

function inputFor(question) {
  const id = `q-${question.id}`;
  const label = `<label for="${id}">${escapeHtml(question.label)}${question.required ? '<span class="required">必須</span>' : ""}</label>`;
  const description = question.description ? `<small>${escapeHtml(question.description)}</small>` : "";
  if (question.type === "long_text") return `${label}${description}<textarea id="${id}" data-question="${question.id}"></textarea>`;
  if (question.type === "single_choice") return `${label}${description}${(question.options || []).map(option => `<label class="choice"><input type="radio" name="q-${question.id}" value="${escapeHtml(option)}" data-question="${question.id}"> ${escapeHtml(option)}</label>`).join("")}`;
  if (question.type === "multiple_choice") return `${label}${description}${(question.options || []).map(option => `<label class="choice"><input type="checkbox" name="q-${question.id}" value="${escapeHtml(option)}" data-question="${question.id}"> ${escapeHtml(option)}</label>`).join("")}`;
  const type = question.type === "email" ? "email" : "text";
  return `${label}${description}<input id="${id}" type="${type}" data-question="${question.id}">`;
}

function readValues(questions) {
  const values = {};
  for (const question of questions) {
    const fields = [...document.querySelectorAll(`[data-question="${question.id}"]`)];
    if (question.type === "multiple_choice") values[String(question.id)] = fields.filter(field => field.checked).map(field => field.value);
    else if (question.type === "single_choice") values[String(question.id)] = fields.find(field => field.checked)?.value || "";
    else values[String(question.id)] = fields[0]?.value?.trim() || "";
  }
  return values;
}

function renderForm(form, questions) {
  app.innerHTML = `<section class="view active"><div class="hero"><p class="eyebrow">ENTRY FORM</p><h1>${escapeHtml(form.title)}</h1><p class="lead">${escapeHtml(form.description || "必要事項を入力して送信してください。")}</p></div><form class="panel form-panel" id="entry-form"><div id="questions">${questions.map(question => `<div class="question">${inputFor(question)}</div>`).join("")}</div><p class="muted" id="form-error" role="alert"></p><button class="primary full" type="submit">回答を送信する</button></form></section>`;
  document.getElementById("entry-form").addEventListener("submit", async event => {
    event.preventDefault();
    const error = document.getElementById("form-error");
    const button = event.currentTarget.querySelector("button[type=submit]");
    const values = readValues(questions);
    const missing = questions.find(question => question.required && (!values[String(question.id)] || (Array.isArray(values[String(question.id)]) && values[String(question.id)].length === 0)));
    if (missing) { error.textContent = `「${missing.label}」は必須項目です。`; return; }
    button.disabled = true; button.textContent = "送信中…"; error.textContent = "";
    try {
      const result = await trpc("publicForms.submit", { slug: form.slug, values }, "POST");
      app.innerHTML = `<section class="view active"><div class="hero"><p class="eyebrow">SUBMITTED</p><h1>回答を<br>受け付けました</h1><p class="lead">${escapeHtml(result.message || "ありがとうございました。")}</p></div></section>`;
    } catch (submitError) { button.disabled = false; button.textContent = "回答を送信する"; error.textContent = submitError.message || "送信に失敗しました。"; }
  });
}

async function start() {
  const slug = new URLSearchParams(location.search).get("form");
  if (!slug) return renderLanding();
  try {
    const result = await trpc("publicForms.get", { slug });
    renderForm(result.form, result.questions || []);
  } catch (error) { renderError(error.message || "専用リンクを確認してください。"); }
}

start();
