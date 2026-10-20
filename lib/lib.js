/**
 *  Save canvas tag as image
 */
document.addEventListener('keyup', (event) => {
  switch (event.key) {
    case 's': {
      const createImage = async () => {
        const canvas = document.getElementById('artCanvas');
        if (!canvas) {
          return;
        }
        const image = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = image;
        link.download = `monos_${new Date().getTime()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      createImage();
      break;
    }
  }
});