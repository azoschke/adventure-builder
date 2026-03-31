// image-exporter.js — Export node content as a styled JPG image

const ImageExporter = {
  /**
   * Export a node as a parchment-styled JPG image.
   */
  async exportNodeAsImage(nodeId) {
    const node = App.state.nodes[nodeId];
    if (!node) return;

    const card = this._buildCard(node);
    document.body.appendChild(card);

    // Wait for image to fully load (robust)
    const img = card.querySelector('.parchment-card-image img');
    if (img && img.src) {
      await new Promise((resolve) => {
        const done = () => resolve();

        if (img.complete && img.naturalWidth !== 0) return resolve();

        img.onload = done;
        img.onerror = done;

        // fallback timeout
        setTimeout(done, 3000);
      });
    }

    try {
      const canvas = await html2canvas(card, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#e3ded3',
        width: 900,
      });

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

      const filename = (node.node_title || node.node_id || 'node')
        .replace(/[^a-z0-9]+/gi, '-')
        .toLowerCase();

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

  /**
   * Build the card DOM
   */
  _buildCard(node) {
    const card = document.createElement('div');
    card.className = 'parchment-card';

    let imageHtml = '';
    if (node.image_url) {
      const safeUrl = this._fixImageUrl(node.image_url);

      imageHtml = `
        <div class="parchment-card-image">
          <img src="${safeUrl}" alt="">
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

  /**
   * Proxy ALL images to bypass CORS for html2canvas
   */
  _fixImageUrl(url) {
    if (!url) return '';

    let fixed = url.trim();

    // Convert Google Drive links to direct format
    if (fixed.includes('drive.google.com')) {
      const match = fixed.match(/\/d\/([^/]+)/) || fixed.match(/[?&]id=([^&]+)/);
      if (match) {
        fixed = `https://drive.google.com/uc?export=view&id=${match[1]}`;
      }
    }

    // Remove protocol for proxy
    const clean = fixed.replace(/^https?:\/\//, '');

    // Proxy ALL images through a CORS-friendly service
    return `https://images.weserv.nl/?url=${encodeURIComponent(clean)}&w=900`;
  },

  /**
   * Escape HTML
   */
  _esc(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};
