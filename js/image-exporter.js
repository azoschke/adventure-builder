// image-exporter.js — Export node content as a styled JPG image

const ImageExporter = {
  /**
   * Export a node as a parchment-styled JPG image.
   */
  async exportNodeAsImage(nodeId) {
    const node = App.state.nodes[nodeId];
    if (!node) return;

    const card = await this._buildCard(node); // note: async now
    document.body.appendChild(card);

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
   * Build the card DOM with Base64 images.
   */
  async _buildCard(node) {
    const card = document.createElement('div');
    card.className = 'parchment-card';

    let imageHtml = '';
    if (node.image_url) {
      const base64Url = await this._fetchImageAsBase64(node.image_url);

      if (base64Url) {
        imageHtml = `
          <div class="parchment-card-image">
            <img src="${base64Url}" alt="">
          </div>
        `;
      }
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
   * Fetch an image from any URL and convert to Base64
   */
  async _fetchImageAsBase64(url) {
    try {
      let fixed = url.trim();

      // Convert Google Drive links to direct view
      if (fixed.includes('drive.google.com')) {
        const match = fixed.match(/\/d\/([^/]+)/) || fixed.match(/[?&]id=([^&]+)/);
        if (match) {
          fixed = `https://drive.google.com/uc?export=view&id=${match[1]}`;
        }
      }

      const response = await fetch(fixed, { mode: 'cors' });
      const blob = await response.blob();

      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn('Failed to fetch image as Base64:', url, err);
      return null;
    }
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
