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

        if (img.complete && img.naturalWidth !== 0) {
          return resolve();
        }

        img.onload = done;
        img.onerror = done;

        // fallback so it never hangs
        setTimeout(done, 3000);
      });
    }

    try {
      const canvas = await html2canvas(card, {
        scale: 2,
        useCORS: true,
        allowTaint: false, // safer
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
   * Smart image URL handler
   * - Uses direct URLs when safe (Carrd, CDN, etc.)
   * - Proxies problematic sources (Google Drive)
   */
  _fixImageUrl(url) {
    if (!url) return '';

    let fixed = url.trim();

    // --- Detect Google Drive ---
    if (fixed.includes('drive.google.com')) {
      const match = fixed.match(/\/d\/([^/]+)/) || fixed.match(/[?&]id=([^&]+)/);

      if (match) {
        const fileId = match[1];

        const driveUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

        // Remove protocol for proxy
        const clean = driveUrl.replace(/^https?:\/\//, '');

        // Route through proxy (required for canvas)
        return `https://images.weserv.nl/?url=${encodeURIComponent(clean)}&w=900`;
      }
    }

    // --- All other URLs (Carrd, CDN, etc.) ---
    // Use directly (faster, no proxy needed)
    return fixed;
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
