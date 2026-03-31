// editor.js — Right panel node editor logic

const Editor = {
  currentNodeId: null,

  init() {
    this._setupEventListeners();
  },

  _setupEventListeners() {
    // Field changes
    const fields = ['node-title', 'day-number', 'node-type', 'location', 'narrative-text',
                     'success-node', 'fail-node', 'ending-id', 'image-url'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this._onFieldChange());
        el.addEventListener('change', () => this._onFieldChange());
      }
    });

    // Random event checkbox
    document.getElementById('is-random-event').addEventListener('change', () => this._onFieldChange());

    // Node ID rename
    document.getElementById('node-id-input').addEventListener('change', (e) => {
      this._onNodeIdRename(e.target.value.trim());
    });

    // Delete button
    document.getElementById('delete-node-btn').addEventListener('click', () => {
      this._onDeleteNode();
    });

    // Add vote option button
    document.getElementById('add-vote-option-btn').addEventListener('click', () => {
      this._onAddVoteOption();
    });
  },

  // Show a node in the editor
  showNode(nodeId) {
    const node = App.state.nodes[nodeId];
    if (!node) return;

    this.currentNodeId = nodeId;
    document.getElementById('editor-placeholder').style.display = 'none';
    document.getElementById('editor-form').style.display = 'block';

    // Populate fields
    document.getElementById('node-id-input').value = node.node_id;
    document.getElementById('image-url').value = node.image_url || '';
    document.getElementById('node-title').value = node.node_title || '';
    document.getElementById('day-number').value = node.day_number || '';
    document.getElementById('node-type').value = node.node_type || 'neutral';
    document.getElementById('location').value = node.location || '';
    document.getElementById('narrative-text').value = node.narrative_text || '';
    document.getElementById('ending-id').value = node.ending_id || '';
    document.getElementById('is-random-event').checked = !!node.is_random_event;

    // Populate node ID dropdowns
    this._populateNodeDropdowns();
    document.getElementById('success-node').value = node.success_node_id || '';
    document.getElementById('fail-node').value = node.fail_node_id || '';

    // Show/hide ending field
    this._toggleEndingField(node.node_type);

    // Show/hide vote options
    this._toggleVoteSection(!!node.is_random_event);
    if (node.is_random_event) {
      this._renderVoteOptions(nodeId);
    }
  },

  clear() {
    this.currentNodeId = null;
    document.getElementById('editor-placeholder').style.display = 'flex';
    document.getElementById('editor-form').style.display = 'none';
  },

  _populateNodeDropdowns() {
    const nodeIds = Object.keys(App.state.nodes).sort();
    ['success-node', 'fail-node'].forEach(id => {
      const select = document.getElementById(id);
      const currentVal = select.value;
      select.innerHTML = '<option value="">(none)</option>';
      nodeIds.forEach(nid => {
        if (nid === this.currentNodeId) return;
        const node = App.state.nodes[nid];
        const label = node.node_title ? `${nid} — ${node.node_title}` : nid;
        const opt = document.createElement('option');
        opt.value = nid;
        opt.textContent = label;
        select.appendChild(opt);
      });
      select.value = currentVal;
    });
  },

  _toggleEndingField(nodeType) {
    const group = document.getElementById('ending-id-group');
    group.style.display = nodeType === 'ending' ? 'block' : 'none';
  },

  _toggleVoteSection(isRandomEvent) {
    const section = document.getElementById('vote-options-section');
    section.style.display = isRandomEvent ? 'block' : 'none';
  },

  _renderVoteOptions(nodeId) {
    const container = document.getElementById('vote-options-list');
    container.innerHTML = '';

    const options = App.state.voteOptions[nodeId] || [];
    const allNodeIds = Object.keys(App.state.nodes).sort();

    options.forEach((opt, idx) => {
      const div = document.createElement('div');
      div.className = 'vote-option-item';
      div.innerHTML = `
        <div class="vote-option-fields">
          <input type="text" class="field-input vote-label" value="${this._escapeHtml(opt.option_label)}" placeholder="Option label..." data-idx="${idx}">
          <select class="field-input vote-target" data-idx="${idx}">
            <option value="">(none)</option>
            ${allNodeIds.map(nid => {
              const n = App.state.nodes[nid];
              const label = n.node_title ? `${nid} — ${n.node_title}` : nid;
              return `<option value="${nid}" ${nid === opt.target_node_id ? 'selected' : ''}>${this._escapeHtml(label)}</option>`;
            }).join('')}
          </select>
          <button class="btn-icon remove-vote-btn" data-idx="${idx}" title="Remove option">&#10005;</button>
        </div>
      `;
      container.appendChild(div);
    });

    container.querySelectorAll('.vote-label').forEach(input => {
      input.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        this._updateVoteOption(nodeId, i, { option_label: e.target.value });
      });
    });

    container.querySelectorAll('.vote-target').forEach(select => {
      select.addEventListener('change', (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        this._updateVoteOption(nodeId, i, { target_node_id: e.target.value });
      });
    });

    container.querySelectorAll('.remove-vote-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        this._removeVoteOption(nodeId, i);
      });
    });
  },

  _onFieldChange() {
    if (!this.currentNodeId) return;

    const nodeType = document.getElementById('node-type').value;
    const isRandomEvent = document.getElementById('is-random-event').checked;

    const updates = {
      image_url: document.getElementById('image-url').value,
      node_title: document.getElementById('node-title').value,
      day_number: document.getElementById('day-number').value,
      node_type: nodeType,
      location: document.getElementById('location').value,
      narrative_text: document.getElementById('narrative-text').value,
      success_node_id: document.getElementById('success-node').value,
      fail_node_id: document.getElementById('fail-node').value,
      ending_id: nodeType === 'ending' ? document.getElementById('ending-id').value : '',
      is_random_event: isRandomEvent,
    };

    App.updateNode(this.currentNodeId, updates);

    this._toggleEndingField(nodeType);
    this._toggleVoteSection(isRandomEvent);
    if (isRandomEvent) {
      this._renderVoteOptions(this.currentNodeId);
    }
  },

  _onNodeIdRename(newId) {
    if (!this.currentNodeId || !newId) return;
    if (newId === this.currentNodeId) return;

    if (App.state.nodes[newId]) {
      alert('A node with that ID already exists.');
      document.getElementById('node-id-input').value = this.currentNodeId;
      return;
    }

    App.renameNode(this.currentNodeId, newId);
    this.currentNodeId = newId;
  },

  _onDeleteNode() {
    if (!this.currentNodeId) return;
    if (!confirm(`Delete node "${this.currentNodeId}"? This cannot be undone.`)) return;
    App.deleteNode(this.currentNodeId);
    this.clear();
  },

  _onAddVoteOption() {
    if (!this.currentNodeId) return;
    App.addVoteOption(this.currentNodeId, '');
    this._renderVoteOptions(this.currentNodeId);
  },

  _updateVoteOption(nodeId, index, updates) {
    const options = App.state.voteOptions[nodeId];
    if (!options || !options[index]) return;
    Object.assign(options[index], updates);
    App.markDirty();
  },

  _removeVoteOption(nodeId, index) {
    const options = App.state.voteOptions[nodeId];
    if (!options) return;
    options.splice(index, 1);
    options.forEach((opt, i) => opt.option_order = i + 1);
    App.markDirty();
    this._renderVoteOptions(nodeId);
  },

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },
};
