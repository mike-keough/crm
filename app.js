let db = {
  contacts: [],
  stages: [
    {id:'s1', name:'New Lead', color:'#6b7280'},
    {id:'s2', name:'Contacted', color:'#2563b9'},
    {id:'s3', name:'Showing', color:'#7c3aed'},
    {id:'s4', name:'Under Contract', color:'#ea580c'},
    {id:'s5', name:'Closed', color:'#16a34a'},
  ],
  tasks: [],
  activity: [],
  nextContactId: 1,
  nextTaskId: 1,
  nextActivityId: 1,
};

function save() { localStorage.setItem('mk_crm', JSON.stringify(db)); }
function load() {
  const raw = localStorage.getItem('mk_crm');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      db = { ...db, ...parsed };
    } catch(e) {}
  }
}

function addActivity(text, contactId) {
  db.activity.unshift({
    id: 'a' + db.nextActivityId++,
    text, contactId,
    time: new Date().toISOString()
  });
  if (db.activity.length > 200) db.activity = db.activity.slice(0, 200);
  save();
}

// ============================================================
// NAVIGATION
// ============================================================
let currentPage = 'dashboard';
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.textContent.toLowerCase().includes(name.substr(0,5).toLowerCase())) n.classList.add('active');
  });
  currentPage = name;
  closeDetail();
  if (name === 'dashboard') renderDashboard();
  else if (name === 'contacts') renderContacts();
  else if (name === 'pipeline') renderPipeline();
  else if (name === 'tasks') renderTasks();
  else if (name === 'activity') renderAllActivity();
  else if (name === 'settings') renderSettings();
  document.getElementById('sidebar').classList.remove('mobile-open');
}

// ============================================================
// CONTACTS
// ============================================================
let currentFilter = 'all';
let currentSearch = '';
let currentContactId = null;
let editingContactId = null;

function getFilteredContacts() {
  let list = [...db.contacts];
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    list = list.filter(c =>
      (c.firstName + ' ' + c.lastName).toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  }
  if (currentFilter !== 'all') {
    list = list.filter(c => c.type === currentFilter || c.priority === currentFilter);
  }
  return list;
}

function filterContacts(filter, el) {
  currentFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderContacts();
}

function globalSearch(val) {
  currentSearch = val;
  if (currentPage === 'contacts') renderContacts();
}

function getStage(id) { return db.stages.find(s => s.id === id) || {name:'Unknown', color:'#ccc'}; }

function getInitials(c) {
  return ((c.firstName||'?')[0] + (c.lastName||'?')[0]).toUpperCase();
}

function renderContacts() {
  const list = getFilteredContacts();
  document.getElementById('contact-count-label', ).textContent = list.length + ' contact' + (list.length !== 1 ? 's' : '');
  const tbody = document.getElementById('contacts-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">No contacts found</div><div class="empty-state-sub">Add your first contact to get started</div></div></td></tr>';
    return;
  }
  tbody.innerHTML = list.map(c => {
    const stage = getStage(c.stageId);
    const typeClass = 'tag-' + (c.type || 'buyer');
    const prioClass = 'tag-' + (c.priority || 'warm');
    const lastContact = c.lastContact ? formatDate(c.lastContact) : '—';
    return `<tr onclick="openDetail('${c.id}')">
      <td><div class="contact-name-cell">
        <div class="contact-avatar" style="background:${stageColor(c.stageId)}">${getInitials(c)}</div>
        <div><div class="contact-name">${c.firstName} ${c.lastName}</div><div class="contact-email">${c.email||''}</div></div>
      </div></td>
      <td>${c.phone||'—'}</td>
      <td><span style="font-size:11px;padding:3px 8px;border-radius:10px;background:${stage.color}20;color:${stage.color};font-weight:600">${stage.name}</span></td>
      <td><span class="tag ${typeClass}">${capitalize(c.type||'buyer')}</span></td>
      <td><span class="tag ${prioClass}">${capitalize(c.priority||'warm')}</span></td>
      <td>${c.priceRange||'—'}</td>
      <td>${lastContact}</td>
      <td onclick="event.stopPropagation()">
        <button class="btn btn-xs btn-secondary" onclick="openDetail('${c.id}')">View</button>
        <button class="btn btn-xs btn-secondary" onclick="editContact('${c.id}')">Edit</button>
      </td>
    </tr>`;
  }).join('');
  updateBadges();
}

function stageColor(id) {
  const s = db.stages.find(x => x.id === id);
  return s ? s.color : '#6b7280';
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {month:'short', day:'numeric'}) + ' at ' + d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'});
}

// ============================================================
// MODAL: CONTACT
// ============================================================
function openNewContactModal(stageId) {
  editingContactId = null;
  document.getElementById('contact-modal-title').textContent = 'New Contact';
  clearContactForm();
  populateStageSelect();
  if (stageId) document.getElementById('f-stage').value = stageId;
  document.getElementById('contact-modal').classList.add('open');
  document.getElementById('f-first').focus();
}

function editContact(id) {
  const c = db.contacts.find(x => x.id === id);
  if (!c) return;
  editingContactId = id;
  document.getElementById('contact-modal-title').textContent = 'Edit Contact';
  populateStageSelect();
  document.getElementById('f-first').value = c.firstName || '';
  document.getElementById('f-last').value = c.lastName || '';
  document.getElementById('f-phone').value = c.phone || '';
  document.getElementById('f-email').value = c.email || '';
  document.getElementById('f-type').value = c.type || 'buyer';
  document.getElementById('f-priority').value = c.priority || 'warm';
  document.getElementById('f-stage').value = c.stageId || db.stages[0]?.id || '';
  document.getElementById('f-price').value = c.priceRange || '';
  document.getElementById('f-source').value = c.source || '';
  document.getElementById('f-address').value = c.address || '';
  document.getElementById('f-notes').value = c.quickNote || '';
  document.getElementById('contact-modal').classList.add('open');
}

function editCurrentContact() { if (currentContactId) editContact(currentContactId); }

function clearContactForm() {
  ['f-first','f-last','f-phone','f-email','f-price','f-address','f-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-type').value = 'buyer';
  document.getElementById('f-priority').value = 'warm';
  document.getElementById('f-source').value = '';
}

function populateStageSelect() {
  const sel = document.getElementById('f-stage');
  sel.innerHTML = db.stages.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

function saveContact() {
  const first = document.getElementById('f-first').value.trim();
  const last = document.getElementById('f-last').value.trim();
  if (!first || !last) { alert('First and last name are required.'); return; }

  const data = {
    firstName: first,
    lastName: last,
    phone: document.getElementById('f-phone').value.trim(),
    email: document.getElementById('f-email').value.trim(),
    type: document.getElementById('f-type').value,
    priority: document.getElementById('f-priority').value,
    stageId: document.getElementById('f-stage').value,
    priceRange: document.getElementById('f-price').value.trim(),
    source: document.getElementById('f-source').value,
    address: document.getElementById('f-address').value.trim(),
    quickNote: document.getElementById('f-notes').value.trim(),
    lastContact: new Date().toISOString(),
  };

  if (editingContactId) {
    const idx = db.contacts.findIndex(x => x.id === editingContactId);
    if (idx >= 0) {
      db.contacts[idx] = { ...db.contacts[idx], ...data };
      addActivity(`Updated contact: ${first} ${last}`, editingContactId);
    }
  } else {
    const newContact = { id: 'c' + db.nextContactId++, ...data, notes: [], createdAt: new Date().toISOString() };
    db.contacts.unshift(newContact);
    addActivity(`Added new contact: ${first} ${last}`, newContact.id);
  }

  save();
  closeModal('contact-modal');
  if (currentPage === 'contacts') renderContacts();
  else if (currentPage === 'pipeline') renderPipeline();
  else if (currentPage === 'dashboard') renderDashboard();
  updateBadges();
}

function deleteCurrentContact() {
  if (!currentContactId) return;
  const c = db.contacts.find(x => x.id === currentContactId);
  if (!c) return;
  if (!confirm(`Delete ${c.firstName} ${c.lastName}? This cannot be undone.`)) return;
  addActivity(`Deleted contact: ${c.firstName} ${c.lastName}`, null);
  db.contacts = db.contacts.filter(x => x.id !== currentContactId);
  save();
  closeDetail();
  if (currentPage === 'contacts') renderContacts();
  else if (currentPage === 'pipeline') renderPipeline();
  else if (currentPage === 'dashboard') renderDashboard();
  updateBadges();
}

// ============================================================
// DETAIL PANEL
// ============================================================
function openDetail(id) {
  const c = db.contacts.find(x => x.id === id);
  if (!c) return;
  currentContactId = id;
  c.lastContact = new Date().toISOString();
  save();

  const stage = getStage(c.stageId);
  document.getElementById('detail-avatar').textContent = getInitials(c);
  document.getElementById('detail-name').textContent = c.firstName + ' ' + c.lastName;
  document.getElementById('detail-stage-label').textContent = stage.name + (c.type ? ' · ' + capitalize(c.type) : '');
  document.getElementById('detail-header').style.background = stage.color;

  const info = document.getElementById('detail-info-section');
  info.innerHTML = `<div class="detail-section-title">Contact Info</div>
    ${c.phone ? `<div class="detail-row"><span class="detail-key">📞 Phone</span><span class="detail-val"><a href="tel:${c.phone}" style="color:var(--blue-mid)">${c.phone}</a></span></div>` : ''}
    ${c.email ? `<div class="detail-row"><span class="detail-key">✉ Email</span><span class="detail-val"><a href="mailto:${c.email}" style="color:var(--blue-mid)">${c.email}</a></span></div>` : ''}
    ${c.address ? `<div class="detail-row"><span class="detail-key">📍 Address</span><span class="detail-val">${c.address}</span></div>` : ''}
    ${c.priceRange ? `<div class="detail-row"><span class="detail-key">💰 Range</span><span class="detail-val">${c.priceRange}</span></div>` : ''}
    ${c.source ? `<div class="detail-row"><span class="detail-key">📌 Source</span><span class="detail-val">${capitalize(c.source)}</span></div>` : ''}
    <div class="detail-row"><span class="detail-key">🌡 Priority</span><span class="detail-val"><span class="tag tag-${c.priority||'warm'}">${capitalize(c.priority||'warm')}</span></span></div>
    ${c.createdAt ? `<div class="detail-row"><span class="detail-key">📅 Added</span><span class="detail-val">${formatDate(c.createdAt)}</span></div>` : ''}
    ${c.quickNote ? `<div style="margin-top:10px;padding:10px;background:var(--gray-50);border-radius:8px;font-size:13px;color:var(--gray-700)">${c.quickNote}</div>` : ''}
    <div style="margin-top:16px;display:flex;gap:8px;align-items:center">
      <label style="font-size:12px;font-weight:600;color:var(--gray-600)">Move to Stage:</label>
      <select onchange="moveToStage('${c.id}',this.value)" style="flex:1">
        ${db.stages.map(s => `<option value="${s.id}" ${s.id===c.stageId?'selected':''}>${s.name}</option>`).join('')}
      </select>
    </div>`;

  // Notes
  const notesList = document.getElementById('detail-notes-list');
  const notes = c.notes || [];
  notesList.innerHTML = notes.length ? notes.slice().reverse().map(n =>
    `<div class="note-item"><div class="note-date">${formatDateTime(n.time)}</div><div class="note-text">${escapeHtml(n.text)}</div></div>`
  ).join('') : '<div style="color:var(--gray-400);font-size:13px">No notes yet.</div>';
  document.getElementById('new-note-text').value = '';

  // Activity
  const actList = document.getElementById('detail-activity-list');
  const acts = db.activity.filter(a => a.contactId === id).slice(0, 10);
  actList.innerHTML = acts.length ? acts.map(a =>
    `<div class="activity-item"><div class="activity-icon">📝</div><div class="activity-content"><div class="activity-text">${a.text}</div><div class="activity-time">${formatDateTime(a.time)}</div></div></div>`
  ).join('') : '<div style="color:var(--gray-400);font-size:13px">No activity yet.</div>';

  document.getElementById('detail-panel').classList.add('open');
}

function closeDetail() {
  document.getElementById('detail-panel').classList.remove('open');
  currentContactId = null;
}

function moveToStage(contactId, stageId) {
  const c = db.contacts.find(x => x.id === contactId);
  if (!c) return;
  const oldStage = getStage(c.stageId);
  const newStage = getStage(stageId);
  c.stageId = stageId;
  c.lastContact = new Date().toISOString();
  addActivity(`Moved ${c.firstName} ${c.lastName} from "${oldStage.name}" to "${newStage.name}"`, contactId);
  save();
  if (currentPage === 'pipeline') renderPipeline();
  if (currentPage === 'dashboard') renderDashboard();
  // Update detail panel label
  document.getElementById('detail-stage-label').textContent = newStage.name + (c.type ? ' · ' + capitalize(c.type) : '');
  document.getElementById('detail-header').style.background = newStage.color;
}

function addNote() {
  if (!currentContactId) return;
  const text = document.getElementById('new-note-text').value.trim();
  if (!text) return;
  const c = db.contacts.find(x => x.id === currentContactId);
  if (!c) return;
  if (!c.notes) c.notes = [];
  c.notes.push({ text, time: new Date().toISOString() });
  addActivity(`Note added for ${c.firstName} ${c.lastName}`, currentContactId);
  save();
  openDetail(currentContactId);
}

function escapeHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// PIPELINE
// ============================================================
let dragContactId = null;

function renderPipeline() {
  const board = document.getElementById('pipeline-board');
  board.innerHTML = '';
  db.stages.forEach(stage => {
    const contacts = db.contacts.filter(c => c.stageId === stage.id);
    const col = document.createElement('div');
    col.className = 'pipeline-col';
    col.dataset.stageId = stage.id;
    col.innerHTML = `
      <div class="pipeline-col-header" style="border-bottom-color:${stage.color}">
        <div class="pipeline-col-title">${stage.name}</div>
        <span class="pipeline-col-count">${contacts.length}</span>
        <div class="pipeline-col-actions">
          <button class="pipeline-col-btn" onclick="openNewContactModal('${stage.id}')" title="Add to this stage">+</button>
        </div>
      </div>
      <div class="pipeline-cards" id="col-${stage.id}" ondragover="dragOver(event,'${stage.id}')" ondrop="drop(event,'${stage.id}')" ondragleave="dragLeave(event)">
        ${contacts.length ? contacts.map(c => pipelineCard(c, stage)).join('') : '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:12px">Drop contacts here</div>'}
      </div>`;
    board.appendChild(col);
  });
  // Add column button
  const addCol = document.createElement('div');
  addCol.className = 'pipeline-add-col';
  addCol.innerHTML = '<span>+</span> New Stage';
  addCol.onclick = () => addStagePrompt();
  board.appendChild(addCol);
}

function pipelineCard(c, stage) {
  const typeClass = 'tag-' + (c.type || 'buyer');
  const prioClass = 'tag-' + (c.priority || 'warm');
  return `<div class="pipeline-card" draggable="true"
    ondragstart="dragStart(event,'${c.id}')"
    ondragend="dragEnd(event)"
    onclick="openDetail('${c.id}')">
    <div class="card-name">${c.firstName} ${c.lastName}</div>
    ${c.phone ? `<div class="card-detail">📞 ${c.phone}</div>` : ''}
    ${c.email ? `<div class="card-detail">✉ ${c.email}</div>` : ''}
    <div class="card-tags">
      <span class="tag ${typeClass}">${capitalize(c.type||'buyer')}</span>
      <span class="tag ${prioClass}">${capitalize(c.priority||'warm')}</span>
    </div>
    ${c.priceRange ? `<div class="card-price">💰 ${c.priceRange}</div>` : ''}
  </div>`;
}

function dragStart(e, contactId) {
  dragContactId = contactId;
  e.target.classList.add('dragging');
}
function dragEnd(e) { e.target.classList.remove('dragging'); }
function dragOver(e, stageId) {
  e.preventDefault();
  document.getElementById('col-' + stageId).classList.add('drag-over');
}
function dragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}
function drop(e, stageId) {
  e.preventDefault();
  document.querySelectorAll('.pipeline-cards').forEach(c => c.classList.remove('drag-over'));
  if (!dragContactId) return;
  const c = db.contacts.find(x => x.id === dragContactId);
  if (c && c.stageId !== stageId) {
    const oldStage = getStage(c.stageId);
    const newStage = getStage(stageId);
    c.stageId = stageId;
    c.lastContact = new Date().toISOString();
    addActivity(`Moved ${c.firstName} ${c.lastName}: "${oldStage.name}" → "${newStage.name}"`, c.id);
    save();
    renderPipeline();
  }
  dragContactId = null;
}

// ============================================================
// TASKS
// ============================================================
function openNewTaskModal(contactId) {
  document.getElementById('t-title').value = '';
  document.getElementById('t-due').value = '';
  document.getElementById('t-priority').value = 'normal';
  const sel = document.getElementById('t-contact');
  sel.innerHTML = '<option value="">- No contact -</option>' + db.contacts.map(c =>
    `<option value="${c.id}" ${c.id===contactId?'selected':''}>${c.firstName} ${c.lastName}</option>`
  ).join('');
  document.getElementById('task-modal').classList.add('open');
  document.getElementById('t-title').focus();
}

function saveTask() {
  const title = document.getElementById('t-title').value.trim();
  if (!title) { alert('Please enter a task.'); return; }
  const task = {
    id: 't' + db.nextTaskId++,
    title,
    contactId: document.getElementById('t-contact').value || null,
    due: document.getElementById('t-due').value || null,
    priority: document.getElementById('t-priority').value,
    done: false,
    createdAt: new Date().toISOString()
  };
  db.tasks.unshift(task);
  addActivity(`Task created: "${title}"`, task.contactId);
  save();
  closeModal('task-modal');
  if (currentPage === 'tasks') renderTasks();
  updateBadges();
}

function toggleTask(id) {
  const t = db.tasks.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  if (t.done) addActivity(`Completed task: "${t.title}"`, t.contactId);
  save();
  renderTasks();
  updateBadges();
}

function deleteTask(id) {
  db.tasks = db.tasks.filter(x => x.id !== id);
  save();
  renderTasks();
  updateBadges();
}

function renderTasks() {
  const pending = db.tasks.filter(t => !t.done);
  const done = db.tasks.filter(t => t.done);
  const renderTaskItem = (t) => {
    const c = t.contactId ? db.contacts.find(x => x.id === t.contactId) : null;
    const overdue = t.due && !t.done && new Date(t.due) < new Date();
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--gray-100)">
      <input type="checkbox" ${t.done?'checked':''} onchange="toggleTask('${t.id}')" style="width:16px;height:16px;cursor:pointer" />
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500;${t.done?'text-decoration:line-through;color:var(--gray-400)':''}">${escapeHtml(t.title)}</div>
        <div style="font-size:11px;color:var(--gray-400);margin-top:2px">
          ${c ? `👤 ${c.firstName} ${c.lastName}` : ''}
          ${t.due ? (overdue ? `<span style="color:var(--red)">⚠ Due ${formatDate(t.due)}</span>` : ` · 📅 ${formatDate(t.due)}`) : ''}
        </div>
      </div>
      <span class="tag tag-${t.priority==='high'?'hot':t.priority==='low'?'cold':'warm'}">${capitalize(t.priority)}</span>
      <button class="btn btn-xs btn-secondary" onclick="deleteTask('${t.id}')">✕</button>
    </div>`;
  };

  document.getElementById('tasks-pending-list').innerHTML = pending.length ? pending.map(renderTaskItem).join('') : '<div style="color:var(--gray-400);font-size:13px;padding:10px 0">No pending tasks. 🎉</div>';
  document.getElementById('tasks-done-list').innerHTML = done.length ? done.map(renderTaskItem).join('') : '<div style="color:var(--gray-400);font-size:13px;padding:10px 0">No completed tasks yet.</div>';
}

// ============================================================
// ACTIVITY
// ============================================================
function renderAllActivity() {
  const list = document.getElementById('all-activity-list');
  list.innerHTML = db.activity.length ? db.activity.map(a =>
    `<div class="activity-item">
      <div class="activity-icon">📝</div>
      <div class="activity-content">
        <div class="activity-text">${a.text}</div>
        <div class="activity-time">${formatDateTime(a.time)}</div>
      </div>
    </div>`
  ).join('') : '<div style="color:var(--gray-400);font-size:13px">No activity yet.</div>';
}

// ============================================================
// SETTINGS
// ============================================================
function renderSettings() {
  const list = document.getElementById('stages-list');
  list.innerHTML = db.stages.map((s, i) => `
    <div class="stage-item" id="stage-item-${s.id}">
      <span class="stage-drag">⠿</span>
      <span class="stage-color" style="background:${s.color}"></span>
      <span class="stage-name">${s.name}</span>
      <div style="display:flex;gap:6px;margin-left:auto">
        <button class="btn btn-xs btn-secondary" onclick="renameStage('${s.id}')">✏</button>
        ${db.stages.length > 1 ? `<button class="btn btn-xs btn-danger" onclick="deleteStage('${s.id}')">✕</button>` : ''}
      </div>
    </div>`).join('');
}

function addStagePrompt() {
  document.getElementById('s-name').value = '';
  document.getElementById('s-color').value = '#2563b9';
  document.getElementById('stage-modal').classList.add('open');
  document.getElementById('s-name').focus();
}

function saveStage() {
  const name = document.getElementById('s-name').value.trim();
  if (!name) { alert('Please enter a stage name.'); return; }
  const stage = { id: 's' + Date.now(), name, color: document.getElementById('s-color').value };
  db.stages.push(stage);
  save();
  closeModal('stage-modal');
  renderSettings();
  if (currentPage === 'pipeline') renderPipeline();
}

function renameStage(id) {
  const s = db.stages.find(x => x.id === id);
  if (!s) return;
  const name = prompt('Rename stage:', s.name);
  if (name && name.trim()) {
    s.name = name.trim();
    save();
    renderSettings();
    if (currentPage === 'pipeline') renderPipeline();
    if (currentPage === 'dashboard') renderDashboard();
    if (currentPage === 'contacts') renderContacts();
  }
}

function deleteStage(id) {
  const s = db.stages.find(x => x.id === id);
  if (!s) return;
  const count = db.contacts.filter(c => c.stageId === id).length;
  let msg = `Delete stage "${s.name}"?`;
  if (count > 0) msg += ` ${count} contact(s) will be moved to "${db.stages[0].name}".`;
  if (!confirm(msg)) return;
  const first = db.stages.find(x => x.id !== id);
  db.contacts.forEach(c => { if (c.stageId === id) c.stageId = first?.id || ''; });
  db.stages = db.stages.filter(x => x.id !== id);
  save();
  renderSettings();
  if (currentPage === 'pipeline') renderPipeline();
  if (currentPage === 'contacts') renderContacts();
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('dash-greeting').textContent = greet + ', Mike!';

  // Stats
  const total = db.contacts.length;
  const hot = db.contacts.filter(c => c.priority === 'hot').length;
  const pendingTasks = db.tasks.filter(t => !t.done).length;
  const thisMonth = db.contacts.filter(c => {
    const d = new Date(c.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-label">Total Contacts</div><div class="stat-value">${total}</div></div>
    <div class="stat-card"><div class="stat-icon">🔥</div><div class="stat-label">Hot Leads</div><div class="stat-value">${hot}</div></div>
    <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-label">Open Tasks</div><div class="stat-value">${pendingTasks}</div></div>
    <div class="stat-card"><div class="stat-icon">🆕</div><div class="stat-label">Added This Month</div><div class="stat-value">${thisMonth}</div></div>`;

  // Recent contacts
  const recent = db.contacts.slice(0, 5);
  document.getElementById('recent-contacts-list').innerHTML = recent.length ? recent.map(c => `
    <div class="recent-contact" onclick="openDetail('${c.id}')">
      <div class="contact-avatar" style="background:${stageColor(c.stageId)}">${getInitials(c)}</div>
      <div style="flex:1">
        <div class="contact-name" style="font-size:13px">${c.firstName} ${c.lastName}</div>
        <div style="font-size:11px;color:var(--gray-500)">${getStage(c.stageId).name} · ${capitalize(c.type||'buyer')}</div>
      </div>
      <span class="tag tag-${c.priority||'warm'}" style="font-size:10px">${capitalize(c.priority||'warm')}</span>
    </div>`).join('') : '<div style="color:var(--gray-400);font-size:13px">No contacts yet. Add your first one!</div>';

  // Pipeline overview bars
  const maxCount = Math.max(1, ...db.stages.map(s => db.contacts.filter(c => c.stageId === s.id).length));
  document.getElementById('pipeline-overview').innerHTML = `
    <div class="pipeline-mini">
      ${db.stages.map(s => {
        const cnt = db.contacts.filter(c => c.stageId === s.id).length;
        const pct = Math.max(8, (cnt / maxCount) * 70);
        return `<div class="pipeline-bar-wrap">
          <div class="pipeline-bar-count">${cnt}</div>
          <div class="pipeline-bar" style="height:${pct}px;background:${s.color}"></div>
          <div class="pipeline-bar-label" style="font-size:9px;color:var(--gray-500);margin-top:4px;text-align:center;width:100%;word-break:break-word">${s.name}</div>
        </div>`;
      }).join('')}
    </div>`;

  // Recent activity
  const acts = db.activity.slice(0, 8);
  document.getElementById('recent-activity-list').innerHTML = acts.length ? acts.map(a =>
    `<div class="activity-item">
      <div class="activity-icon" style="font-size:14px">📝</div>
      <div class="activity-content">
        <div class="activity-text" style="font-size:13px">${a.text}</div>
        <div class="activity-time">${formatDateTime(a.time)}</div>
      </div>
    </div>`
  ).join('') : '<div style="color:var(--gray-400);font-size:13px">No activity yet.</div>';
}

// ============================================================
// UTILS
// ============================================================
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function updateBadges() {
  document.getElementById('contacts-badge').textContent = db.contacts.length;
  document.getElementById('tasks-badge').textContent = db.tasks.filter(t => !t.done).length;
}

function exportData() {
  const headers = ['First Name','Last Name','Phone','Email','Type','Priority','Stage','Price Range','Source','Address','Added'];
  const rows = db.contacts.map(c => [
    c.firstName, c.lastName, c.phone, c.email, c.type, c.priority,
    getStage(c.stageId).name, c.priceRange, c.source, c.address, formatDate(c.createdAt)
  ].map(v => '"' + (v||'').replace(/"/g,'""') + '"'));
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'contacts-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
}

function clearAllData() {
  if (!confirm('This will delete ALL contacts, tasks, and activity. Are you sure?')) return;
  if (!confirm('Really? This cannot be undone!')) return;
  db.contacts = []; db.tasks = []; db.activity = [];
  db.nextContactId = 1; db.nextTaskId = 1; db.nextActivityId = 1;
  save();
  showPage('dashboard');
  updateBadges();
}

// Close on backdrop click
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});

// ESC key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    closeDetail();
  }
});

// ============================================================
// INIT
// ============================================================
load();
updateBadges();
renderDashboard();
// Show pipeline stage selector
populateStageSelect();

// Set today as default task due date
document.getElementById('t-due').value = new Date().toISOString().slice(0,10);