// graph.js — Flowchart rendering and interaction (Cytoscape.js)

const Graph = {
  cy: null,
  onNodeSelect: null, // callback(nodeId)
  onNodeDeselect: null, // callback()
  onPositionsChanged: null, // callback({nodeId: {x, y}})
  _contextTarget: null,
  _measureEl: null,

  NODE_COLORS: {
    neutral:  { bg: '#e3ded3', border: '#b8ae9a', text: '#2c1810' },
    success:  { bg: '#dde8d5', border: '#4a7c4f', text: '#2c1810' },
    failure:  { bg: '#edd5d2', border: '#a54d44', text: '#2c1810' },
    ending:   { bg: '#e8dcc8', border: '#8c6d2e', text: '#2c1810' },
  },

  EDGE_STYLES: {
    success: { lineColor: '#4a7c4f', lineStyle: 'solid', targetArrowColor: '#4a7c4f' },
    fail:    { lineColor: '#a54d44', lineStyle: 'dashed', targetArrowColor: '#a54d44' },
    vote:    { lineColor: '#b07830', lineStyle: 'dotted', targetArrowColor: '#b07830' },
  },

  NODE_WIDTH: 330,

  init(containerId) {
    this.cy = cytoscape({
      container: document.getElementById(containerId),
      style: [
        {
          selector: 'node',
          style: {
            'label': '',
            'background-color': 'data(bgColor)',
            'border-color': 'data(borderColor)',
            'border-width': 2,
            'width': this.NODE_WIDTH,
            'height': 'data(nodeHeight)',
            'shape': 'roundrectangle',
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#ffffff',
            'overlay-color': '#ffffff',
            'overlay-opacity': 0.08,
          }
        },
        {
          selector: 'node.ending',
          style: {
            'shape': 'roundrectangle',
            'border-style': 'double',
            'border-width': 4,
          }
        },
        {
          selector: 'node.random-event',
          style: {
            'border-style': 'dashed',
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
            'text-background-color': '#1a1a2e',
            'text-background-opacity': 0.8,
            'text-background-padding': '2px',
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

    this._setupHtmlLabels();
    this._setupEventHandlers();
    this._setupEdgeHandles();
    this._setupContextMenu();
  },

  _setupHtmlLabels() {
    if (typeof this.cy.nodeHtmlLabel !== 'function') {
      console.warn('cytoscape-node-html-label extension not loaded — falling back to plain labels');
      // Fallback: re-enable plain text labels
      this.cy.style().selector('node').style({
        'label': 'data(fallbackLabel)',
        'text-wrap': 'wrap',
        'text-max-width': '190px',
        'font-size': '10px',
        'color': '#e0d6c8',
        'text-valign': 'center',
        'text-halign': 'center',
      }).update();
      this._htmlLabelsEnabled = false;
      return;
    }

    this._htmlLabelsEnabled = true;

    this.cy.nodeHtmlLabel([{
      query: 'node',
      halign: 'center',
      valign: 'center',
      halignBox: 'center',
      valignBox: 'center',
      cssClass: 'cy-node-html-wrapper',
      tpl: (data) => {
        const w = this.NODE_WIDTH - 24; // content padding
        let html = `<div class="node-html-content" style="width:${w}px;color:${data.textColor || '#e0d6c8'}">`;
        if (data.nodeImageUrl) {
          html += `<div class="node-html-image"><img src="${this._escHtml(data.nodeImageUrl)}" alt=""></div>`;
        }
        html += `<div class="node-html-title">${this._escHtml(data.nodeTitle)}</div>`;
        if (data.nodeLocation) {
          html += `<div class="node-html-location">${this._escHtml(data.nodeLocation)}</div>`;
        }
        if (data.nodeNarrative) {
          html += `<div class="node-html-narrative">${this._escHtml(data.nodeNarrative)}</div>`;
        }
        if (data.isRandomEvent) {
          html += `<div class="node-html-badge">RANDOM EVENT</div>`;
        }
        html += '</div>';
        return html;
      }
    }]);
  },

  _escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  _setupEventHandlers() {
    this.cy.on('tap', 'node', (evt) => {
      const nodeId = evt.target.id();
      if (this.onNodeSelect) this.onNodeSelect(nodeId);
    });

    this.cy.on('tap', (evt) => {
      if (evt.target === this.cy) {
        if (this.onNodeDeselect) this.onNodeDeselect();
      }
    });

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
        addedEdge.remove();
        this._showConnectionDialog(sourceNode.id(), targetNode.id());
      }
    });
  },

  _setupContextMenu() {
    const container = this.cy.container();

    container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const modelPos = this.cy.renderer().projectIntoViewport(e.clientX, e.clientY);
      this._showContextMenu(e.clientX, e.clientY, { x: modelPos[0], y: modelPos[1] });
    });

    document.addEventListener('click', () => this._hideContextMenu());
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
      if (window.App && App.addNode) App.addNode(modelPos.x, modelPos.y);
    });
  },

  _hideContextMenu() {
    const existing = document.getElementById('graph-context-menu');
    if (existing) existing.remove();
  },

  _showConnectionDialog(sourceId, targetId) {
    const sourceNode = App.state.nodes[sourceId];
    if (!sourceNode) return;

    const showVote = sourceNode.is_random_event;
    const dialog = document.createElement('div');
    dialog.className = 'connection-dialog-overlay';
    dialog.innerHTML = `
      <div class="connection-dialog">
        <h3>Create Connection</h3>
        <p><strong>${sourceId}</strong> &rarr; <strong>${targetId}</strong></p>
        <p>Set this connection as:</p>
        <div class="connection-dialog-buttons">
          <button class="btn btn-success" data-type="success">Success Path</button>
          <button class="btn btn-fail" data-type="fail">Fail Path</button>
          ${showVote ? '<button class="btn btn-vote" data-type="vote">Vote Option</button>' : ''}
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
      if (type === 'success') App.updateNode(sourceId, { success_node_id: targetId });
      else if (type === 'fail') App.updateNode(sourceId, { fail_node_id: targetId });
      else if (type === 'vote') App.addVoteOption(sourceId, targetId);
    });
  },

  // Estimate node height based on content
  _estimateHeight(title, location, narrative, isRandomEvent, imageUrl) {
    const contentWidth = this.NODE_WIDTH - 24;
    // Approximate chars per line for each section
    const titleCPL = 27;  // Cinzel is wider — scaled for 330px width
    const bodyCPL = 58;
    const titleLineH = 22;
    const locLineH = 16;
    const narrLineH = 14;

    let h = 24; // top+bottom padding
    if (imageUrl) {
      h += 114; // image height (100px) + margin (10px) + offset (4px)
    }
    h += Math.ceil(Math.max((title || 'X').length, 1) / titleCPL) * titleLineH;
    if (location) {
      h += 4 + Math.ceil(location.length / bodyCPL) * locLineH;
    }
    if (narrative) {
      h += 4 + Math.ceil(narrative.length / bodyCPL) * narrLineH;
    }
    if (isRandomEvent) {
      h += 20; // badge
    }
    return Math.max(h, 50);
  },

  // Build the full graph from app state
  buildGraph(state) {
    this.cy.elements().remove();
    const elements = [];

    // Add nodes
    Object.values(state.nodes).forEach(node => {
      const colors = this.NODE_COLORS[node.node_type] || this.NODE_COLORS.neutral;
      const title = node.node_title || node.node_id;
      const location = node.location || '';
      const narrative = node.narrative_text || '';
      const isRE = node.is_random_event;

      const imageUrl = node.image_url || '';
      const nodeHeight = this._estimateHeight(title, location, narrative, isRE, imageUrl);

      // Build classes
      const classes = [];
      if (node.node_type === 'ending') classes.push('ending');
      if (isRE) classes.push('random-event');

      // Fallback label for when HTML labels aren't available
      const fallbackLines = [title];
      if (location) fallbackLines.push(location);
      if (narrative) fallbackLines.push(narrative);

      elements.push({
        group: 'nodes',
        data: {
          id: node.node_id,
          bgColor: colors.bg,
          borderColor: colors.border,
          textColor: colors.text,
          nodeHeight: nodeHeight,
          nodeTitle: title,
          nodeLocation: location,
          nodeNarrative: narrative,
          isRandomEvent: isRE,
          nodeImageUrl: imageUrl,
          fallbackLabel: fallbackLines.join('\n'),
        },
        classes: classes.join(' '),
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

  autoLayout() {
    const layout = this.cy.layout({
      name: 'breadthfirst',
      directed: true,
      spacingFactor: 1.5,
      padding: 50,
      avoidOverlap: true,
    });
    layout.run();

    this.cy.nodes().forEach(n => {
      const pos = n.position();
      if (this.onPositionsChanged) {
        this.onPositionsChanged(n.id(), { x: pos.x, y: pos.y });
      }
    });
  },

  selectNode(nodeId) {
    this.cy.$(':selected').unselect();
    const node = this.cy.$id(nodeId);
    if (node.length) {
      node.select();
      this.cy.animate({ center: { eles: node }, duration: 300 });
    }
  },

  saveViewport() {
    if (!this.cy) return;
    Utils.saveUIPrefs({ zoom: this.cy.zoom(), pan: this.cy.pan() });
  },

  fitView() {
    this.cy.fit(undefined, 50);
  },
};
