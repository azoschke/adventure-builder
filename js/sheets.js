// sheets.js — Google Sheets fetch + parse (read-only)

const Sheets = {
  SHEET_ID: '1dSAi-ep165JjWwRferuJ6uVblSm4Co8w7GOUApm5eyU',

  // Build the public CSV URL for a given tab (gid)
  // Tab gids: first tab = 0, others need to be discovered or set
  // We'll use the export format with sheet name
  buildCsvUrl(sheetName) {
    return `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  },

  // Parse CSV text into array of objects using the first row as headers
  parseCSV(csvText) {
    const rows = this._splitCSVRows(csvText);
    if (rows.length < 1) return [];

    const headers = this._parseCSVRow(rows[0]);
    const data = [];

    for (let i = 1; i < rows.length; i++) {
      if (rows[i].trim() === '') continue;
      const values = this._parseCSVRow(rows[i]);
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h.trim()] = (values[idx] || '').trim();
      });
      data.push(obj);
    }
    return data;
  },

  // Split CSV into rows, respecting quoted fields with newlines
  _splitCSVRows(text) {
    const rows = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < text.length && text[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
          current += ch;
        }
      } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
        if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
          i++; // skip \r\n
        }
        rows.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim() !== '') {
      rows.push(current);
    }
    return rows;
  },

  // Parse a single CSV row into values
  _parseCSVRow(row) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') {
        if (!inQuotes) {
          inQuotes = true;
        } else if (i + 1 < row.length && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else if (ch === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current);
    return values;
  },

  // Fetch all tabs from the sheet
  async fetchAll() {
    const tabs = ['Nodes', 'VoteOptions', 'Endings', 'Config'];
    const results = {};

    const fetches = tabs.map(async (tab) => {
      const url = this.buildCsvUrl(tab);
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status} for tab "${tab}"`);
        const text = await resp.text();
        results[tab] = this.parseCSV(text);
      } catch (err) {
        console.error(`Failed to fetch tab "${tab}":`, err);
        results[tab] = [];
      }
    });

    await Promise.all(fetches);
    return results;
  },

  // Convert raw sheet data into our app state format
  sheetDataToState(data) {
    const nodes = {};
    const voteOptions = {};
    const endings = {};
    const config = {};

    // Parse nodes
    (data.Nodes || []).forEach(row => {
      if (!row.node_id) return;
      nodes[row.node_id] = {
        node_id: row.node_id,
        node_title: row.node_title || '',
        day_number: row.day_number || '',
        node_type: row.node_type || 'daily',
        location: row.location || '',
        narrative_text: row.narrative_text || '',
        success_node_id: row.success_node_id || '',
        fail_node_id: row.fail_node_id || '',
        ending_id: row.ending_id || '',
        x_position: row.x_position ? parseFloat(row.x_position) : null,
        y_position: row.y_position ? parseFloat(row.y_position) : null,
      };
    });

    // Parse vote options — group by vote_id
    (data.VoteOptions || []).forEach(row => {
      if (!row.vote_id) return;
      if (!voteOptions[row.vote_id]) voteOptions[row.vote_id] = [];
      voteOptions[row.vote_id].push({
        vote_id: row.vote_id,
        option_label: row.option_label || '',
        target_node_id: row.target_node_id || '',
        option_order: parseInt(row.option_order, 10) || 1,
      });
    });

    // Sort vote options by order
    Object.values(voteOptions).forEach(opts => {
      opts.sort((a, b) => a.option_order - b.option_order);
    });

    // Parse endings
    (data.Endings || []).forEach(row => {
      if (!row.ending_id) return;
      endings[row.ending_id] = {
        ending_id: row.ending_id,
        ending_title: row.ending_title || '',
        ending_narrative: row.ending_narrative || '',
        ending_location: row.ending_location || '',
      };
    });

    // Parse config
    (data.Config || []).forEach(row => {
      if (row.key) config[row.key] = row.value || '';
    });

    return { nodes, voteOptions, endings, config };
  },
};
