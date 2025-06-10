var CreateUi = pc.createScript('createUi');

CreateUi.prototype.initialize = function () {
    // Creamos un div principal
    var uiContainer = document.createElement('div');
    uiContainer.id = 'uiContainer';
    uiContainer.style.position = 'relative';
    uiContainer.style.top = '0';
    uiContainer.style.left = '0';
    uiContainer.style.width = '100%';
    uiContainer.style.zIndex = '10'; // por encima del canvas
    uiContainer.style.pointerEvents = 'none'; // permite clicks en el canvas
    uiContainer.style.minHeight = '500vh'; // ← da altura para que haya scroll

    // Añadir contenido de prueba
    for (let i = 0; i < 5; i++) {
        const section = document.createElement('div');
        section.className = 'scroll-section';
        section.textContent = 'Sección ' + (i + 1);
        section.style.height = '100vh';
        section.style.display = 'flex';
        section.style.justifyContent = 'center';
        section.style.alignItems = 'center';
        section.style.fontSize = '3rem';
        section.style.background = i % 2 === 0 ? '#ddd' : '#bbb';
        section.style.pointerEvents = 'auto';
        uiContainer.appendChild(section);
    }

    // Estilos adicionales opcionales
    const style = document.createElement('style');
    style.innerHTML = `
        body { margin: 0; overflow-x: hidden; }
        html { scroll-behavior: smooth; }
        #application {
    position: fixed !important;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 0 !important;
    pointer-events: none; /* permite hacer scroll sin bloquearlo */
    html, body {
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
}

}

    `;
    document.head.appendChild(style);

    // Añadir al DOM
    document.body.appendChild(uiContainer);
    this.app.graphicsDevice.canvas.style.backgroundColor = 'transparent';

};
