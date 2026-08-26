const API_ENDPOINT = window.ENTRY_API_ENDPOINT || '';
const seed = { id: 1, title: 'エントリーフォーム', slug: 'entry', description: '必要事項をご入力ください。', status: 'open', successMessage: '回答を受け付けました。ありがとうございました。', notificationCode: 'TEAM-A', questions: [
  { id: 1, label: 'お名前', description: '', type: 'short_text', required: true, options: [] },
  { id: 2, label: 'メールアドレス', description: 'ご連絡可能なアドレスをご入力ください。', type: 'email', required: true, options: [] },
  { id: 3, label: 'お問い合わせ内容', description: '', type: 'long_text', required: true, options: [] }
] };
const params = new URLSearchParams(location.search);
let form = null;
const encoded = params.get('share');
if (encoded) {
  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(normalized), char => char.charCodeAt(0));
    form = JSON.parse(new TextDecoder().decode(bytes));
  } catch { form = null; }
}
if (!form) {
  const saved = JSON.parse(localStorage.getItem('entry-atelier-public-form') || 'null');
  form = saved || seed;
}
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function renderPublic() {
  const root = $('#form-root');
  if (!root) return;
  if (!form || form.status !== 'open') { root.innerHTML = '<div class="empty">このフォームは現在受付していません。</div>'; return; }
  root.innerHTML = `<h2>${esc(form.title)}</h2><p class="intro">${esc(form.description)}</p><form id="public-form">${(form.questions || []).map((question, index) => `<div class="question"><label>${String(index + 1).padStart(2, '0')}　${esc(question.label)}${question.required ? '<span class="required">*</span>' : ''}</label>${question.description ? `<small>${esc(question.description)}</small>` : ''}${control(question)}</div>`).join('')}<button class="primary" type="submit">回答を送信する　→</button><p class="muted" style="font-size:12px;text-align:center;margin-top:15px">送信内容は安全に処理されます。</p></form>`;
  $('#public-form').addEventListener('submit', submitPublic);
}
function control(question) {
  const name = `q-${question.id}`;
  if (question.type === 'long_text') return `<textarea name="${name}" ${question.required ? 'required' : ''}></textarea>`;
  if (question.type === 'email') return `<input type="email" name="${name}" ${question.required ? 'required' : ''}>`;
  if (question.type === 'single_choice') return (question.options || []).map(option => `<label class="choice"><input type="radio" name="${name}" value="${esc(option)}" ${question.required ? 'required' : ''}>${esc(option)}</label>`).join('');
  if (question.type === 'multiple_choice') return (question.options || []).map(option => `<label class="choice"><input type="checkbox" name="${name}" value="${esc(option)}">${esc(option)}</label>`).join('');
  return `<input name="${name}" ${question.required ? 'required' : ''}>`;
}
async function submitPublic(event) {
  event.preventDefault();
  const data = {};
  (form.questions || []).forEach(question => {
    const elements = [...event.target.querySelectorAll(`[name="q-${question.id}"]`)];
    data[question.id] = question.type === 'multiple_choice' ? elements.filter(element => element.checked).map(element => element.value) : elements.find(element => element.checked)?.value || elements[0]?.value || '';
  });
  const submittedAt = new Date().toISOString();
  try {
    if (API_ENDPOINT) {
      const response = await fetch(API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: form.notificationCode || '', formTitle: form.title, answers: Object.fromEntries((form.questions || []).map(question => [question.label, data[question.id]])), submittedAt }) });
      if (!response.ok) throw new Error('notification_failed');
    }
    event.target.innerHTML = `<div class="empty" style="text-align:center;padding:40px 0"><strong style="font-family:'Playfair Display',serif;font-size:25px;display:block;margin-bottom:10px">ありがとうございます。</strong>${esc(form.successMessage || '回答を受け付けました。')}</div>`;
  } catch { const toast = $('#toast'); if (toast) { toast.textContent = '送信に失敗しました。時間をおいて再度お試しください。'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2600); } }
}
renderPublic();
