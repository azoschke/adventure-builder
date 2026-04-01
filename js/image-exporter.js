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
        ${narrative ? `<div class="parchment-card-text">${this._esc(narrative)}</div>` : ''}
      </div>
    `;

    return card;
  },

  _esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
              .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
};
