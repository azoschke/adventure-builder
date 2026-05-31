// image-exporter.js — Export node content as a styled JPG image

const ImageExporter = {
  /**
   * Export a node as a parchment-styled JPG image.
   * Creates an offscreen DOM card, renders with html2canvas, then triggers download.
   */
  async exportNodeAsImage(nodeId) {
    const node = App.state.nodes[nodeId];
    if (!node) return;

    const card = this._buildCard(node);
    document.body.appendChild(card);

    // Make sure the card's web fonts are actually loaded before rendering.
    // html2canvas paints synchronously, so any face that isn't loaded at call
    // time falls back to the serif default in the exported image.
    //
    // Google Fonts serves each family (Crimson Pro, Stoke) as many separate
    // @font-face rules split by unicode-range and weight, and the browser only
    // fetches a given face once a rendered glyph needs it. `document.fonts.ready`
    // does NOT force-load faces that were never triggered on screen, which is
    // why the body text (Crimson Pro 400) could export as serif while the
    // subtitle — a weight already used elsewhere in the UI — looked fine.
    //
    // So we force-load every weight/style the card uses, passing the card's
    // actual text so the matching unicode-range subsets are fetched too.
    await this._ensureFontsLoaded(card);

    // Wait for image to load if present
    const img = card.querySelector('.parchment-card-image img');
    if (img && img.src) {
      await new Promise((resolve) => {
        if (img.complete) { resolve(); return; }
        img.onload = resolve;
        img.onerror = resolve;
      });
    }

    try {
      const canvas = await html2canvas(card, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#e3ded3',
        width: 900,
      });

      // Convert to JPG and download
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const filename = (node.node_title || node.node_id || 'node')
        .replace(/[^a-z0-9]+/gi, '-').toLowerCase();

      const link = document.createElement('a');
      link.download = `${filename}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Image export failed:', err);
      alert('Failed to export image. Check the console for details.');
    } finally {
      card.remove();
    }
  },

  // Force-load every web-font face the card renders with, scoped to the card's
  // actual text so the correct Google Fonts unicode-range subsets are fetched.
  // Best-effort with a timeout so export never hangs if a font request stalls.
  async _ensureFontsLoaded(card) {
    if (!document.fonts || !document.fonts.load) return;

    const text = card.textContent || '';
    // (weight/style, family) combinations used by the parchment card.
    const specs = [
      `400 22px 'Crimson Pro'`,        // body text
      `italic 400 22px 'Crimson Pro'`, // body text (italic runs)
      `500 22px 'Crimson Pro'`,        // subtitle
      `400 38px 'Stoke'`,              // title
    ];

    const loads = specs.map((spec) =>
      document.fonts.load(spec, text).catch(() => {})
    );
    const timeout = new Promise((resolve) => setTimeout(resolve, 4000));

    try {
      await Promise.race([Promise.all(loads), timeout]);
      await Promise.race([document.fonts.ready, timeout]);
    } catch (e) {
      // Best-effort: render with whatever is available.
    }
  },

  _buildCard(node) {
    const card = document.createElement('div');
    card.className = 'parchment-card';

    let imageHtml = '';
    if (node.image_url) {
      imageHtml = `
        <div class="parchment-card-image">
          <div style="width:900px;height:340px;background:url('${this._esc(node.image_url)}') center/cover no-repeat #1a1a1a;"></div>
        </div>
      `;
    }

    const title = node.node_title || '';
    const subtitle = node.location || '';
    const narrative = node.narrative_text || '';

    card.innerHTML = `
      ${imageHtml}
      <div class="parchment-card-body">
        ${title ? `<div class="parchment-card-title">${this._esc(title)}</div>` : ''}
        ${subtitle ? `<div class="parchment-card-subtitle">${this._esc(subtitle)}</div>` : ''}
        ${narrative ? `<div class="parchment-card-text">${this._formatText(narrative)}</div>` : ''}
      </div>
    `;

    return card;
  },

  _esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
              .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  // Convert plain text (with newlines) to HTML paragraphs.
  // Double newlines become separate <p> blocks; single newlines become <br>.
  _formatText(str) {
    if (!str) return '';
    return str
      .split(/\n\n+/)
      .map(para => `<p>${this._esc(para).replace(/\n/g, '<br>')}</p>`)
      .join('');
  },
};
