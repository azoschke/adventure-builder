// exporter.js — TSV export formatting + clipboard copy

const Exporter = {
  // Generate TSV for the Nodes tab
  exportNodes(nodes) {
    const headers = [
      'node_id', 'node_title', 'image_url', 'day_number', 'node_type', 'is_random_event',
      'location', 'narrative_text', 'success_node_id', 'fail_node_id',
      'ending_id', 'x_position', 'y_position'
    ];

    const rows = [headers.join('\t')];

    // Sort nodes: by day_number (numeric), then by node_id
    const sorted = Object.values(nodes).sort((a, b) => {
      const dayA = a.day_number ? parseInt(a.day_number, 10) : 9999;
      const dayB = b.day_number ? parseInt(b.day_number, 10) : 9999;
      if (dayA !== dayB) return dayA - dayB;
      return (a.node_id || '').localeCompare(b.node_id || '');
    });

    sorted.forEach(node => {
      const values = headers.map(h => {
        let val = node[h];
        if (val === null || val === undefined) val = '';
        if (h === 'is_random_event') {
          val = val ? 'TRUE' : 'FALSE';
        } else if (h === 'x_position' || h === 'y_position') {
          val = val !== null && val !== undefined && val !== '' ? Math.round(Number(val)) : '';
        }
        return Utils.escapeForTSV(String(val));
      });
      rows.push(values.join('\t'));
    });

    return rows.join('\n');
  },

  // Generate TSV for the VoteOptions tab
  exportVoteOptions(voteOptions) {
    const headers = ['vote_id', 'option_label', 'target_node_id', 'option_order'];
    const rows = [headers.join('\t')];

    // Flatten all vote options
    const allOptions = [];
    Object.values(voteOptions).forEach(opts => {
      opts.forEach(opt => allOptions.push(opt));
    });

    // Sort by vote_id, then option_order
    allOptions.sort((a, b) => {
      const cmp = (a.vote_id || '').localeCompare(b.vote_id || '');
      if (cmp !== 0) return cmp;
      return (a.option_order || 0) - (b.option_order || 0);
    });

    allOptions.forEach(opt => {
      const values = headers.map(h => Utils.escapeForTSV(String(opt[h] || '')));
      rows.push(values.join('\t'));
    });

    return rows.join('\n');
  },

  // Generate TSV for the Endings tab
  exportEndings(endings) {
    const headers = ['ending_id', 'ending_title', 'ending_narrative', 'ending_location'];
    const rows = [headers.join('\t')];

    const sorted = Object.values(endings).sort((a, b) => {
      return (parseInt(a.ending_id, 10) || 0) - (parseInt(b.ending_id, 10) || 0);
    });

    sorted.forEach(ending => {
      const values = headers.map(h => Utils.escapeForTSV(String(ending[h] || '')));
      rows.push(values.join('\t'));
    });

    return rows.join('\n');
  },

  // Generate TSV for the Config tab
  exportConfig(config) {
    const headers = ['key', 'value'];
    const rows = [headers.join('\t')];

    Object.entries(config).forEach(([key, value]) => {
      rows.push([Utils.escapeForTSV(key), Utils.escapeForTSV(String(value))].join('\t'));
    });

    return rows.join('\n');
  },

  // Copy text to clipboard, returns a promise
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return true;
      } catch (e2) {
        document.body.removeChild(textarea);
        return false;
      }
    }
  },

  // Count rows for a given TSV string (excluding header)
  countRows(tsv) {
    const lines = tsv.split('\n').filter(l => l.trim() !== '');
    return Math.max(0, lines.length - 1); // subtract header
  },
};
