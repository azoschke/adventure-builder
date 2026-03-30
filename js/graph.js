// graph.js — Flowchart rendering and interaction (Cytoscape.js)

const Graph = {
  cy: null,
  onNodeSelect: null, // callback(nodeId)
  onNodeDeselect: null, // callback()
  onPositionsChanged: null, // callback({nodeId: {x, y}})
  _contextTarget: null,

  NODE_COLORS: {
    success: { bg: '#2d5a2d', border: '#4caf50', text: '#c8e6c9' },
    failure: { bg: '#5a1a1a', border: '#f44336', text: '#ffcdd2' },
    daily: { bg: '#1a3a4a', border: '#4a9aba', text: '#b3e0f2' },
    random_event: { bg: '#5a4a00', border: '#ffc107', text: '#fff8e1' },
    milestone: { bg: '#4a2d5a', border: '#9c27b0', text: '#e1bee7' },
    ending: { bg: '#5a4a00', border: '#ffd700', text: '#fff8e1' },
  },

  EDGE_STYLES: {
    success: { lineColor: '#4caf50', lineStyle: 'solid', targetArrowColor: '#4caf50' },
    fail: { lineColor: '#f44336', lineStyle: 'dashed', targetArrowColor: '#f44336' },
    vote: { lineColor: '#ffc107', lineStyle: 'dotted', targetArrowColor: '#ffc107' },
  },

  init(containerId) {
    this.cy = cytoscape({
      container: document.getElementById(containerId),
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'text-wrap': 'wrap',
            'text-max-width': '170px',
            'font-size': '10px',
            'color': '#e0d6c8',
            'text-valign': 'center',
            'text-halign': 'center',
            'background-color': 'data(bgColor)',
            'border-color': 'data(borderColor)',
            'border-width': 2,
            'width': 190,
            'height': 'data(nodeHeight)',
            'shape': 'roundrectangle',
            'text-outline-color': '#1a1a2e',
            'text-outline-width': 1,
            'padding': '8px',
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#ffffff',
            'overlay-color': '#ffffff',
            'overlay-opacity': 0.1,
          }
        },
        {
          selector: 'node.ending',
          style: {
            'shape': 'star',
            'width': 90,
            'height': 90,
            'font-size': '10px',
            'text-max-width': '80px',
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': 'data(lineColor)',
            'target-arrow-color': 'data(arrowColor)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'line-style': 'data(lineStyle)',
            'arrow-scale': 1.2,
          }
        },
        {
          selector: 'edge[label]',
          style: {
            'label': 'data(label)',
            'font-size': '9px',
            'color': '#a09888',
            'text-rotation': 'autorotate',
            'text-outline-color': '#1a1a2e',
            'text-outline-width': 1,
          }
        },
        {
          selector: '.eh-handle',
          style: {
            'background-color': '#ffc107',
            'width': 12,
            'height': 12,
            'shape': 'ellipse',
            'overlay-opacity': 0,
            'border-width': 2,
            'border-color': '#fff',
          }
        },
        {
          selector: '.eh-ghost-edge',
          style: {
            'line-color': '#ffc107',
            'line-style': 'dashed',
            'target-arrow-color': '#ffc107',
            'target-arrow-shape': 'triangle',
          }
        },
      ],
      layout: { name: 'preset' },
      minZoom: 0.1,
      maxZoom: 3,
      wheelSensitivity: 0.3,
    });

    this._setupEventHandlers();
    this._setupEdgeHandles();
    this._setupContextMenu();
  },

  _setupEventHandlers() {
    // Node selection
    this.cy.on('tap', 'node', (evt) => {
      const nodeId = evt.target.id();
      if (this.onNodeSelect) this.onNodeSelect(nodeId);
    });

    // Canvas tap — deselect
    this.cy.on('tap', (evt) => {
      if (evt.target === this.cy) {
        if (this.onNodeDeselect) this.onNodeDeselect();
      }
    });

    // Node drag — track position changes
    this.cy.on('dragfree', 'node', (evt) => {
      if (this.onPositionsChanged) {
        const pos = evt.target.position();
        this.onPositionsChanged(evt.target.id(), { x: pos.x, y: pos.y });
      }
    });
  },

  _setupEdgeHandles() {
    if (typeof this.cy.edgehandles !== 'function') {
      console.warn('edgehandles extension not loaded');
      return;
    }

    this._eh = this.cy.edgehandles({
      snap: true,
      noEdgeEventsInDraw: true,
      handlePosition: () => 'middle right',
      handleColor: '#ffc107',
      handleSize: 10,
      edgeType: () => 'flat',
      loopAllowed: () => false,
      complete: (sourceNode, targetNode, addedEdge) => {
        // Remove the auto-created edge — we manage edges ourselves
        addedEdge.remove();
        const sourceId = sourceNode.id();
        const targetId = targetNode.id();
        this._showConnectionDialog(sourceId, targetId);
      }
    });
  },

  _setupContextMenu() {
    const container = this.cy.container();

    container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const pos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      // Convert to model coordinates
      const modelPos = this.cy.renderer().projectIntoViewport(e.clientX, e.clientY);

      this._showContextMenu(e.clientX, e.clientY, {
        x: modelPos[0],
        y: modelPos[1],
      });
    });

    // Hide context menu on click elsewhere
    document.addEventListener('click', () => {
      this._hideContextMenu();
    });
  },

  _showContextMenu(screenX, screenY, modelPos) {
    this._hideContextMenu();
    const menu = document.createElement('div');
    menu.id = 'graph-context-menu';
    menu.className = 'context-menu';
    menu.innerHTML = `<div class="context-menu-item" data-action="add-node">Add New Node Here</div>`;
    menu.style.left = screenX + 'px';
    menu.style.top = screenY + 'px';
    document.body.appendChild(menu);

    menu.querySelector('[data-action="add-node"]').addEventListener('click', () => {
      this._hideContextMenu();
      if (window.App && App.addNode) {
        App.addNode(modelPos.x, modelPos.y);
      }
    });
  },

  _hideContextMenu() {
    const existing = document.getElementById('graph-context-menu');
    if (existing) existing.remove();
  },

  _showConnectionDialog(sourceId, targetId) {
    const sourceNode = App.state.nodes[sourceId];
    if (!sourceNode) return;

    const dialog = document.createElement('div');
    dialog.className = 'connection-dialog-overlay';
    dialog.innerHTML = `
      <div class="connection-dialog">
        <h3>Create Connection</h3>
        <p><strong>${sourceId}</strong> → <strong>${targetId}</strong></p>
        <p>Set this connection as:</p>
        <div class="connection-dialog-buttons">
          <button class="btn btn-success" data-type="success">Success Path</button>
          <button class="btn btn-fail" data-type="fail">Fail Path</button>
          ${sourceNode.node_type === 'random_event' ? '<button class="btn btn-vote" data-type="vote">Vote Option</button>' : ''}
          <button class="btn btn-cancel" data-type="cancel">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    dialog.addEventListener('click', (e) => {
      const type = e.target.dataset.type;
      if (!type) return;
      dialog.remove();

      if (type === 'cancel') return;

      if (type === 'success') {
        App.updateNode(sourceId, { success_node_id: targetId });
      } else if (type === 'fail') {
        App.updateNode(sourceId, { fail_node_id: targetId });
      } else if (type === 'vote') {
        App.addVoteOption(sourceId, targetId);
      }
    });
  },

  // Build the full graph from app state
  buildGraph(state) {
    this.cy.elements().remove();

    const elements = [];

    // Add nodes
    Object.values(state.nodes).forEach(node => {
      const colors = this.NODE_COLORS[node.node_type] || this.NODE_COLORS.daily;
      const title = node.node_title || node.node_id;

      // Build multi-line label: title, location, narrative preview
      const lines = [title];
      if (node.location) {
        lines.push(node.location);
      }
      if (node.narrative_text) {
        const preview = node.narrative_text.length > 60
          ? node.narrative_text.substring(0, 57) + '...'
          : node.narrative_text;
        lines.push(preview);
      }
      const label = lines.join('\n');

      // Scale node height based on content
      const lineCount = lines.length;
      const nodeHeight = Math.max(50, 28 + lineCount * 18);

      elements.push({
        group: 'nodes',
        data: {
          id: node.node_id,
          label: label,
          bgColor: colors.bg,
          borderColor: colors.border,
          nodeHeight: nodeHeight,
        },
        classes: node.node_type === 'ending' ? 'ending' : '',
        position: {
          x: node.x_position || Math.random() * 800,
          y: node.y_position || Math.random() * 600,
        },
      });
    });

    // Add edges — success paths
    Object.values(state.nodes).forEach(node => {
      if (node.success_node_id && state.nodes[node.success_node_id]) {
        elements.push({
          group: 'edges',
          data: {
            id: `${node.node_id}__success__${node.success_node_id}`,
            source: node.node_id,
            target: node.success_node_id,
            lineColor: this.EDGE_STYLES.success.lineColor,
            arrowColor: this.EDGE_STYLES.success.targetArrowColor,
            lineStyle: this.EDGE_STYLES.success.lineStyle,
          },
        });
      }

      if (node.fail_node_id && state.nodes[node.fail_node_id]) {
        elements.push({
          group: 'edges',
          data: {
            id: `${node.node_id}__fail__${node.fail_node_id}`,
            source: node.node_id,
            target: node.fail_node_id,
            lineColor: this.EDGE_STYLES.fail.lineColor,
            arrowColor: this.EDGE_STYLES.fail.targetArrowColor,
            lineStyle: this.EDGE_STYLES.fail.lineStyle,
            label: 'fail',
          },
        });
      }
    });

    // Add edges — vote options
    Object.entries(state.voteOptions).forEach(([voteId, options]) => {
      options.forEach(opt => {
        if (opt.target_node_id && state.nodes[opt.target_node_id]) {
          elements.push({
            group: 'edges',
            data: {
              id: `${voteId}__vote__${opt.target_node_id}__${opt.option_order}`,
              source: voteId,
              target: opt.target_node_id,
              lineColor: this.EDGE_STYLES.vote.lineColor,
              arrowColor: this.EDGE_STYLES.vote.targetArrowColor,
              lineStyle: this.EDGE_STYLES.vote.lineStyle,
              label: opt.option_label || '',
            },
          });
        }
      });
    });

    this.cy.add(elements);

    // Restore UI prefs
    const prefs = Utils.loadUIPrefs();
    if (prefs && prefs.zoom && prefs.pan) {
      this.cy.viewport({ zoom: prefs.zoom, pan: prefs.pan });
    } else if (Object.keys(state.nodes).length > 0) {
      this.cy.fit(undefined, 50);
    }
  },

  // Run auto-layout
  autoLayout() {
    const layout = this.cy.layout({
      name: 'breadthfirst',
      directed: true,
      spacingFactor: 1.5,
      padding: 50,
      avoidOverlap: true,
    });
    layout.run();

    // After layout, update node positions in App state
    this.cy.nodes().forEach(n => {
      const pos = n.position();
      if (this.onPositionsChanged) {
        this.onPositionsChanged(n.id(), { x: pos.x, y: pos.y });
      }
    });
  },

  // Select a node programmatically
  selectNode(nodeId) {
    this.cy.$(':selected').unselect();
    const node = this.cy.$id(nodeId);
    if (node.length) {
      node.select();
      this.cy.animate({ center: { eles: node }, duration: 300 });
    }
  },

  // Save current viewport state
  saveViewport() {
    if (!this.cy) return;
    Utils.saveUIPrefs({
      zoom: this.cy.zoom(),
      pan: this.cy.pan(),
    });
  },

  // Fit the graph in view
  fitView() {
    this.cy.fit(undefined, 50);
  },
};
