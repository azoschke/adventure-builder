// app.js — Main app initialization, state management

const App = {
  state: {
    nodes: {},
    voteOptions: {},
    endings: {},
    config: {},
  },
  _sheetState: null, // snapshot of last sheet sync for dirty detection
  _dirty: false,

  async init() {
    // Init graph
    Graph.init('cy-container');
    Graph.onNodeSelect = (nodeId) => {
      Editor.showNode(nodeId);
      Graph.selectNode(nodeId);
    };
    Graph.onNodeDeselect = () => {
      Editor.clear();
    };
    Graph.onPositionsChanged = (nodeId, pos) => {
      if (this.state.nodes[nodeId]) {
        this.state.nodes[nodeId].x_position = pos.x;
        this.state.nodes[nodeId].y_position = pos.y;
        this.markDirty();
      }
    };

    // Init editor
    Editor.init();

    // Setup UI buttons
    this._setupTopBar();
    this._setupExportModal();

    // Load draft or sync from sheet
    const draft = Utils.loadDraft();
    if (draft) {
      this.state = draft;
      this._dirty = true;
      this._render();
      this._updateStatus();
      this._showDraftNotice();
    } else {
      await this.syncFromSheet();
    }

    // Save viewport on zoom/pan
    if (Graph.cy) {
      Graph.cy.on('viewport', Utils.debounce(() => Graph.saveViewport(), 500));
    }

    // Auto-save draft periodically
    setInterval(() => {
      if (this._dirty) {
        Utils.saveDraft(this.state);
      }
    }, 5000);

    // Save on page unload
    window.addEventListener('beforeunload', () => {
      if (this._dirty) {
        Utils.saveDraft(this.state);
        Graph.saveViewport();
      }
    });
  },

  _setupTopBar() {
    document.getElementById('sync-btn').addEventListener('click', () => this._onSyncClick());
    document.getElementById('export-btn').addEventListener('click', () => this._openExportModal());
    document.getElementById('add-node-btn').addEventListener('click', () => this.addNode());
    document.getElementById('auto-layout-btn').addEventListener('click', () => Graph.autoLayout());
    document.getElementById('fit-view-btn').addEventListener('click', () => Graph.fitView());
  },

  _setupExportModal() {
    const modal = document.getElementById('export-modal');
    document.getElementById('export-close-btn').addEventListener('click', () => {
      modal.classList.remove('visible');
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('visible');
    });

    // Tab switching
    modal.querySelectorAll('.export-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.export-tab-btn').forEach(b => b.classList.remove('active'));
        modal.querySelectorAll('.export-tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('export-' + btn.dataset.tab).classList.add('active');
      });
    });

    // Copy buttons
    modal.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const textareaId = btn.dataset.textarea;
        const textarea = document.getElementById(textareaId);
        const ok = await Exporter.copyToClipboard(textarea.value);
        if (ok) {
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = 'Copy to Clipboard';
            btn.classList.remove('copied');
          }, 2000);
        }
      });
    });
  },

  async _onSyncClick() {
    if (this._dirty) {
      const choice = await this._showSyncWarning();
      if (choice === 'export') {
        this._openExportModal();
        return;
      }
      if (choice === 'cancel') return;
      // choice === 'sync' — proceed
    }
    await this.syncFromSheet();
  },

  _showSyncWarning() {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'connection-dialog-overlay';
      overlay.innerHTML = `
        <div class="connection-dialog">
          <h3>Unsaved Local Changes</h3>
          <p>Syncing will overwrite your local changes with data from the sheet.</p>
          <div class="connection-dialog-buttons">
            <button class="btn btn-vote" data-choice="export">Export First</button>
            <button class="btn btn-fail" data-choice="sync">Sync Anyway</button>
            <button class="btn btn-cancel" data-choice="cancel">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => {
        const choice = e.target.dataset.choice;
        if (choice) {
          overlay.remove();
          resolve(choice);
        }
      });
    });
  },

  async syncFromSheet() {
    this._setConnectionStatus('syncing');
    try {
      const data = await Sheets.fetchAll();
      this.state = Sheets.sheetDataToState(data);
      this._sheetState = Utils.deepClone(this.state);
      this._dirty = false;
      Utils.clearDraft();
      Utils.setLastSync(Date.now());
      this._render();
      this._updateStatus();
      this._setConnectionStatus('connected');
    } catch (err) {
      console.error('Sync failed:', err);
      this._setConnectionStatus('error');
    }
  },

  _render() {
    Graph.buildGraph(this.state);
    this._updateStatus();
  },

  _setConnectionStatus(status) {
    const el = document.getElementById('connection-status');
    const dot = el.querySelector('.status-dot');
    const text = el.querySelector('.status-text');

    dot.className = 'status-dot';
    if (status === 'connected') {
      dot.classList.add('connected');
      text.textContent = 'Connected to Sheet';
    } else if (status === 'syncing') {
      dot.classList.add('syncing');
      text.textContent = 'Syncing...';
    } else if (status === 'error') {
      dot.classList.add('error');
      text.textContent = 'Sync Failed';
    } else {
      text.textContent = 'No Sheet Connected';
    }
  },

  _updateStatus() {
    const nodeCount = Object.keys(this.state.nodes).length;
    const endingCount = Object.values(this.state.nodes).filter(n => n.node_type === 'ending').length;
    const lastSync = Utils.getLastSync();

    document.getElementById('node-count').textContent = `${nodeCount} nodes`;
    document.getElementById('ending-count').textContent = `${endingCount} endings`;
    document.getElementById('last-synced').textContent = `Last sync: ${Utils.formatTimestamp(lastSync)}`;

    const badge = document.getElementById('unsaved-badge');
    const statusText = document.getElementById('sync-status-text');
    if (this._dirty) {
      badge.style.display = 'inline-block';
      statusText.textContent = 'Unsaved changes';
      statusText.className = 'status-unsaved';
    } else {
      badge.style.display = 'none';
      statusText.textContent = 'In sync with sheet';
      statusText.className = 'status-synced';
    }
  },

  _showDraftNotice() {
    const notice = document.getElementById('draft-notice');
    notice.style.display = 'flex';

    document.getElementById('draft-discard-btn').addEventListener('click', async () => {
      notice.style.display = 'none';
      Utils.clearDraft();
      await this.syncFromSheet();
    });

    document.getElementById('draft-export-btn').addEventListener('click', () => {
      notice.style.display = 'none';
      this._openExportModal();
    });

    document.getElementById('draft-keep-btn').addEventListener('click', () => {
      notice.style.display = 'none';
    });
  },

  _openExportModal() {
    const modal = document.getElementById('export-modal');

    // Generate TSV data for each tab
    const nodesTSV = Exporter.exportNodes(this.state.nodes);
    const votesTSV = Exporter.exportVoteOptions(this.state.voteOptions);
    const endingsTSV = Exporter.exportEndings(this.state.endings);
    const configTSV = Exporter.exportConfig(this.state.config);

    document.getElementById('export-nodes-data').value = nodesTSV;
    document.getElementById('export-votes-data').value = votesTSV;
    document.getElementById('export-endings-data').value = endingsTSV;
    document.getElementById('export-config-data').value = configTSV;

    document.getElementById('export-nodes-count').textContent = `${Exporter.countRows(nodesTSV)} rows`;
    document.getElementById('export-votes-count').textContent = `${Exporter.countRows(votesTSV)} rows`;
    document.getElementById('export-endings-count').textContent = `${Exporter.countRows(endingsTSV)} rows`;
    document.getElementById('export-config-count').textContent = `${Exporter.countRows(configTSV)} rows`;

    // Show first tab
    modal.querySelectorAll('.export-tab-btn').forEach(b => b.classList.remove('active'));
    modal.querySelectorAll('.export-tab-content').forEach(c => c.classList.remove('active'));
    modal.querySelector('[data-tab="nodes"]').classList.add('active');
    document.getElementById('export-nodes').classList.add('active');

    modal.classList.add('visible');
  },

  // --- State mutation methods ---

  markDirty() {
    this._dirty = true;
    this._updateStatus();
    Utils.saveDraft(this.state);
    // Rebuild graph to reflect changes
    this._rebuildGraphDebounced();
  },

  _rebuildGraphDebounced: Utils.debounce(function () {
    Graph.buildGraph(App.state);
    // Re-select current node if any
    if (Editor.currentNodeId) {
      Graph.selectNode(Editor.currentNodeId);
    }
  }, 300),

  addNode(x, y) {
    const id = Utils.generateId();
    this.state.nodes[id] = {
      node_id: id,
      node_title: 'New Node',
      day_number: '',
      node_type: 'neutral',
      is_random_event: false,
      location: '',
      narrative_text: '',
      success_node_id: '',
      fail_node_id: '',
      ending_id: '',
      x_position: x || (Graph.cy ? Graph.cy.extent().x1 + Graph.cy.extent().w / 2 : 400),
      y_position: y || (Graph.cy ? Graph.cy.extent().y1 + Graph.cy.extent().h / 2 : 300),
    };
    this.markDirty();
    Editor.showNode(id);
    Graph.selectNode(id);
  },

  updateNode(nodeId, updates) {
    if (!this.state.nodes[nodeId]) return;
    Object.assign(this.state.nodes[nodeId], updates);
    this.markDirty();
  },

  renameNode(oldId, newId) {
    const node = this.state.nodes[oldId];
    if (!node) return;

    // Update the node itself
    node.node_id = newId;
    this.state.nodes[newId] = node;
    delete this.state.nodes[oldId];

    // Update all references in other nodes
    Object.values(this.state.nodes).forEach(n => {
      if (n.success_node_id === oldId) n.success_node_id = newId;
      if (n.fail_node_id === oldId) n.fail_node_id = newId;
    });

    // Update vote options
    if (this.state.voteOptions[oldId]) {
      this.state.voteOptions[newId] = this.state.voteOptions[oldId];
      this.state.voteOptions[newId].forEach(opt => opt.vote_id = newId);
      delete this.state.voteOptions[oldId];
    }
    Object.values(this.state.voteOptions).forEach(opts => {
      opts.forEach(opt => {
        if (opt.target_node_id === oldId) opt.target_node_id = newId;
      });
    });

    this.markDirty();
  },

  deleteNode(nodeId) {
    delete this.state.nodes[nodeId];

    // Clear references
    Object.values(this.state.nodes).forEach(n => {
      if (n.success_node_id === nodeId) n.success_node_id = '';
      if (n.fail_node_id === nodeId) n.fail_node_id = '';
    });

    // Remove vote options for this node
    delete this.state.voteOptions[nodeId];

    // Remove vote options targeting this node
    Object.values(this.state.voteOptions).forEach(opts => {
      for (let i = opts.length - 1; i >= 0; i--) {
        if (opts[i].target_node_id === nodeId) opts.splice(i, 1);
      }
    });

    this.markDirty();
  },

  addVoteOption(nodeId, targetNodeId) {
    if (!this.state.voteOptions[nodeId]) {
      this.state.voteOptions[nodeId] = [];
    }
    const order = this.state.voteOptions[nodeId].length + 1;
    this.state.voteOptions[nodeId].push({
      vote_id: nodeId,
      option_label: '',
      target_node_id: targetNodeId || '',
      option_order: order,
    });
    this.markDirty();
  },
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
