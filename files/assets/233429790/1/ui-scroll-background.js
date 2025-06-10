// ui-scroll-background.js
var UiScrollBackground = pc.createScript('uiScrollBackground');

// Inyectar Tween.js desde CDN  ──────────────────────────────────────────
var tweenScript = document.createElement('script');
tweenScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/tween.js/20.0.0/tween.umd.js';
document.head.appendChild(tweenScript);

// Esperamos a que Tween.js esté disponible para crear los alias
tweenScript.addEventListener('load', () => {
  // Alias sencillos plano → función real
  TWEEN.Easing['linear']         = k => k;                         // sin curva
  TWEEN.Easing['Quadratic.Out']  = TWEEN.Easing.Quadratic.Out;
  TWEEN.Easing['Quadratic.In']   = TWEEN.Easing.Quadratic.In;
  TWEEN.Easing['Quadratic.InOut']= TWEEN.Easing.Quadratic.InOut;
  TWEEN.Easing['Elastic.Out']    = TWEEN.Easing.Elastic.Out;
	
  // (añade más si los necesitas: Cubic, Quartic, Elastic, etc.)
  console.log('Tween.js listo y alias de easings creados ✓');
});


// Inyectar Lenis.js desde CDN ───────────────────────────────────────────
var lenisScript = document.createElement('script');
lenisScript.src =
  'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@latest/bundled/lenis.min.js';

window._lenisLoaded = false;                 // bandera global
lenisScript.addEventListener('load', () => {  // se pone a true al cargarse
  window._lenisLoaded = true;
  //debug
   console.log('Lenis ha emitido load ✓');
});

document.head.appendChild(lenisScript);



UiScrollBackground.prototype.initialize = function () {
    // —————————————————————————————————————————————————————————————————————————
    // 1) INYECTAR CSS GLOBALES + ESTILOS DE SECCIONES, CONTENIDO Y BOTONES
    // —————————————————————————————————————————————————————————————————————————
    var styleTag = document.createElement('style');
    styleTag.innerHTML = `
        /* ─── 1.1) Evitar scroll en el <body> y asegurar que el canvas queda fijo ─── */
        html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            overflow: hidden !important;   /* El body NO hace scroll */
            background-color: transparent !important;
        }

        /* ─── 1.2) El contenedor del canvas (“#application”) debe estar fijo de fondo ─── */
        #application {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 0 !important;
            pointer-events: none !important;
            background-color: transparent !important;
        }

        /* ─── 1.3) Contenedor principal de UI con scroll interno ─── */

        #lenis-wrapper {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        overflow: hidden !important;     /* el wrapper “esconde” el scroll */
        z-index: 1 !important;
        }

        #uiScrollContainer {
        position: relative !important;
        width: 100vw !important;
        /* quita height y overflow, el contenido crecerá libremente */
}


        /* ─── 1.4) Sección “vacía”: permite ver el canvas limpio ─── */
        .empty-section {
            height: 110vh !important;  /* Un 110% de altura de pantalla */
            /* No necesita contenido; queda transparente para ver el 3D */
        }

        /* ─── 1.4.1) Sección “vacía small”: permite ver el canvas limpio ─── */
        .empty-section-s {
            height: 30vh !important;  /* Un 30% de altura de pantalla */
            /* No necesita contenido; queda transparente para ver el 3D */
        }

        /* ─── 1.5) Secciones con contenido: altura de 100vh ─── */
        .scroll-section {
            height: 100vh !important;   /* Ocupa toda la “pantalla” visible */
            position: relative !important;
            background: rgba(255, 255, 255, 0.0) !important; /* Fondo transparente */
            box-sizing: border-box !important;
            border-bottom: 0 solid #ccc !important;
            display: flex !important;
            justify-content: flex-end !important;   /* Contenido alineado a la derecha */
            align-items: center !important;
        }

        /* ─── 1.6) Contenedor del “contenido” dentro de cada sección ─── */
        .section-content {
        width: 40vw;
        max-width: 400px;
        margin-right: 5vw;
        padding: 20px;
        background: rgba(255, 255, 255, 0.80);    
        border-radius: 20px;
        border: 4px solid #C73C6A; 
        }

        .section-content h2 {
            margin: 0 0 10px;
            font-size: 1.8rem;
            color: #1a1a1a;
        }

        .section-content p {
            margin: 0 0 15px;
            font-size: 1rem;
            line-height: 1.4;
            color: #333;
        }

        /* ─── 1.7) Estilos para botones dentro de las secciones ─── */
        .section-button {
            display: inline-block;
            margin-right: 10px;
            padding: 8px 16px;
            font-size: 0.9rem;
            color: #fff;
            background-color: #007ACC;
            border: none;
            border-radius: 20px;
            cursor: pointer;
            transition: background-color 0.25s ease, transform 0.15s ease;
        }

        .section-button:hover {
            background-color: #005A9E;
        }

        .section-button:active {
            background-color: #004470;
            transform: scale(0.96);
        }

            /* ─── ESTILO PARA SECCIONES PINNED ─── */
    .scroll-section.pinned {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        z-index: 2 !important;
    }

           /* Estilo para los clones fijados */
            .pinned-clone {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            z-index: 999 !important;
            }

    

    `;

    document.head.appendChild(styleTag);

    // —————————————————————————————————————————————————————————————————————————
    // 2) ASEGURAR QUE LA CÁMARA NO TIENE FONDO SÓLIDO (canvas transparente) 
    // —————————————————————————————————————————————————————————————————————————
    var cameraEntity = this.app.root.findByName('Camera');
    if (cameraEntity && cameraEntity.camera) {
        cameraEntity.camera.clearColor = new pc.Color(0, 0, 0, 0);
        if (this.app.graphicsDevice && this.app.graphicsDevice.canvas) {
            var c = this.app.graphicsDevice.canvas;
            c.style.backgroundColor = 'transparent';
            c.style.position = 'fixed';
            c.style.top = '0';
            c.style.left = '0';
            c.style.width = '100vw';
            c.style.height = '100vh';
            c.style.zIndex = '0';
            c.style.pointerEvents = 'none';
        }
    } else {
        console.warn("UiScrollBackground: No he encontrado una entidad llamada 'Camera'.");
    }


    // Creamos el wrapper (envoltorio) que Lenis controlará
    var lenisWrapper = document.createElement('div');
    lenisWrapper.id = 'lenis-wrapper';
    document.body.appendChild(lenisWrapper);

// Ahora el contenedor de secciones va dentro de ese wrapper
var uiContainer = document.createElement('div');
uiContainer.id = 'uiScrollContainer';
lenisWrapper.appendChild(uiContainer);


// —————————————————————————————————————————————————————————
// 4) Arrancar Lenis (funciona tanto si el script está cacheado como
//    si se descarga ahora). Solo hay UN punto de arranque.
// —————————————————————————————————————————————————————————
function startLenis () {
    //debug
    console.log('🚀 startLenis() ejecutado');

    if (window._lenisStarted) return;          // evita duplicarlo
    window._lenisStarted = true;

    const lenis = new Lenis({
        wrapper : lenisWrapper,   // div que envuelve todo
        content : uiContainer,    // tu contenedor de secciones
        smooth  : true,
        lerp    : 0.1
    });

const raf = (t) => {
    lenis.raf(t);

    let scroll = lenis.scroll;
    let limit = lenis.limit;

    if (limit > 0) {
        window.scrollT = scroll / limit;
        
    } else {
        window.scrollT = 0;
    }

    window.scrollDir = (scroll >= (window._lastScroll || 0)) ? 1 : -1;
    window._lastScroll = scroll;

    requestAnimationFrame(raf);
};

requestAnimationFrame(raf);   // ← ESTA LÍNEA FALTABA

}
//debug
console.log("¿Lenis cargado?", !!window.Lenis);

//Iniciar LENIS
if (window._lenisLoaded || window.Lenis) {
    // Lenis ya está listo (por caché o porque la bandera es true)
    startLenis();
} else {
    // Aún no se ha descargado: arrancará cuando termine
    lenisScript.addEventListener('load', startLenis);
}



  // —————————————————————————————————————————————————————————————————————————
    // 3) CREAR EL CONTENEDOR DE UI Y SUS SECCIONES FIJAS
    // —————————————————————————————————————————————————————————————————————————

    // IMPOTRANTE
    // Cuando queramos usar negritas, saltos de linea etc, usaremos innerHTML en vez de textContent

    // 3.1) Sección 0: ESPACIO VACÍO (para ver canvas 3D limpio al iniciar)

    // var empty0 = document.createElement('div');
    // empty0.className = 'empty-section-s';
    // uiContainer.appendChild(empty0);

    // 3.2) Sección 1: Explicación general del proyecto
    var sec1 = document.createElement('div');
    sec1.className = 'scroll-section';
    sec1.id = 'sec1';
    // Dentro de sec1, añadimos el contenedor de contenido
    var cont1 = document.createElement('div');
    cont1.className = 'section-content';

    var h2_1 = document.createElement('h2');
    h2_1.textContent = 'Sección 1: ¿Qué es este proyecto?';
    cont1.appendChild(h2_1);

    var p1_1 = document.createElement('p');
    p1_1.textContent = 'Este proyecto es una prueba de concepto y posibilidades que combina una escena 3D en PlayCanvas con un contenido HTML/CSS superpuesto. ' +
                     'La idea principal es mostrar cómo podemos sincronizar animaciones 3D con secciones de texto, imágenes y botones que se despliegan ' +
                     'mediante scroll en el navegador, manteniendo la escena 3D en segundo plano.';
    cont1.appendChild(p1_1);

    //AÑADIR UNA IMAGEN; la he subido a Imgur porque necesita URL pública
    var imgTest1 = document.createElement('img');
    imgTest1.src = 'https://i.imgur.com/9uvgYql.png';
    imgTest1.style.width = '100%';
    imgTest1.style.marginBottom = '20px';
    imgTest1.style.borderRadius = '12px';
    cont1.appendChild(imgTest1);


    // Botones de ejemplo para futuras interacciones
    var btn1a = document.createElement('button');
    btn1a.className = 'section-button';
    btn1a.textContent = 'Más detalles';
    // btn1a puede tener su listener luego en otro script
    cont1.appendChild(btn1a);

    var btn1b = document.createElement('button');
    btn1b.className = 'section-button';
    btn1b.textContent = 'Demo 3D';
    cont1.appendChild(btn1b);

    sec1.appendChild(cont1);
    uiContainer.appendChild(sec1);

    // 3.3) Sección intermedia VACÍA (espacio 110% para ver 3D limpio)
    var empty1 = document.createElement('div');
    empty1.className = 'empty-section';
    uiContainer.appendChild(empty1);

    // 3.4) Sección 2: Cómo inyectamos HTML dinámicamente
    var sec2 = document.createElement('div');
    sec2.className = 'scroll-section';
    sec2.id = 'sec2';
    var cont2 = document.createElement('div');
    cont2.className = 'section-content';

    var h2_2 = document.createElement('h2');
    h2_2.textContent = 'Sección 2: Inyección dinámica de HTML';
    cont2.appendChild(h2_2);

    var p2_1 = document.createElement('p');
    p2_1.textContent = 'En este punto estamos generando cada sección mediante JavaScript, invocando ' +
                     'document.createElement(...) para crear nodos <div>, <h2>, <p> y <button>. ' +
                     'Gracias a esto podemos mantener el HTML “vivo” dentro del mismo script y hacer cambios en caliente sin tener ' +
                     'que editar un index.html externo.';
    cont2.appendChild(p2_1);

    var p2_2 = document.createElement('p');
    p2_2.textContent = 'El contenedor principal (#uiScrollContainer) está posicionado absoluto y ocupa toda la pantalla, con ' +
                     'overflow-y: scroll. Cada sección se despliega a pantalla completa (100vh), y dentro colocamos un bloque semi-transparente ' +
                     'con fondo blanco y sombras para destacar el texto.';
    cont2.appendChild(p2_2);

    var btn2a = document.createElement('button');
    btn2a.className = 'section-button';
    btn2a.textContent = 'Ver código';
    cont2.appendChild(btn2a);

    var btn2b = document.createElement('button');
    btn2b.className = 'section-button';
    btn2b.textContent = 'Editar estilo';
    cont2.appendChild(btn2b);

    sec2.appendChild(cont2);
    uiContainer.appendChild(sec2);

    // 3.5) Otra sección intermedia VACÍA (110% de altura)
    var empty2 = document.createElement('div');
    empty2.className = 'empty-section';
    uiContainer.appendChild(empty2);

    // 3.6) Sección 3: Sincronización con animaciones 3D
    var sec3 = document.createElement('div');
    sec3.className = 'scroll-section';
    sec3.id = 'sec3';
    var cont3 = document.createElement('div');
    cont3.className = 'section-content';

    var h2_3 = document.createElement('h2');
    h2_3.textContent = 'Sección 3: Sincronización con la escena 3D';
    cont3.appendChild(h2_3);

    var p3_1 = document.createElement('p');
    p3_1.textContent = 'En esta sección explicamos cómo, al hacer scroll, capturamos el evento scroll del contenedor y ' +
                     'calculamos un valor normalizado (t entre 0 y 1). Con ese t avanzado podemos adelantar o retroceder ' +
                     'la animación de un objeto en PlayCanvas—por ejemplo, un cubo con un componente Animation.';
    cont3.appendChild(p3_1);

    var p3_2 = document.createElement('p');
    p3_2.textContent = 'Así conseguimos que el usuario, al desplazar el scroll, vea la animación 3D moverse de forma pausada ' +
                     'y controlada, sin necesidad de botones extra. También podemos disparar eventos al llegar a determinados puntos del scroll.';
    cont3.appendChild(p3_2);

    var btn3a = document.createElement('button');
    btn3a.className = 'section-button';
    btn3a.textContent = 'Reiniciar animación';
    cont3.appendChild(btn3a);

    var btn3b = document.createElement('button');
    btn3b.className = 'section-button';
    btn3b.textContent = 'Saltar a final';
    cont3.appendChild(btn3b);

    sec3.appendChild(cont3);
    uiContainer.appendChild(sec3);

    // AÑADIMOS MÁS SECCIONES

    // 3.6) Otra sección intermedia VACÍA (110% de altura)
    var empty2 = document.createElement('div');
    empty2.className = 'empty-section';
    uiContainer.appendChild(empty2);

    // 3.7) Sección 4: 
    var sec4 = document.createElement('div');
    sec4.className = 'scroll-section';
    sec4.id = 'sec4';
    var cont4 = document.createElement('div');
    cont4.className = 'section-content';

    var h2_4 = document.createElement('h2');
    h2_4.textContent = 'Sección 4: Comunicación bidireccional';
    cont4.appendChild(h2_4);

    var p4_1 = document.createElement('p');
    p4_1.textContent = `Una de las ventajas clave de este prototipo es que podemos intercambiar información
        tanto del HTML al canvas 3D como del canvas al HTML de manera sencilla.  
        Por un lado, desde el documento HTML podemos disparar funciones en PlayCanvas
        (por ejemplo, pulsar un botón que haga que un objeto empiece a girar, cambie su color
        o altere la cámara)`;
    cont4.appendChild(p4_1);

    var p4_2 = document.createElement('p');
    p4_2.textContent = `Por otro lado, la escena 3D también puede “hablar” con el DOM: cuando una animación
        termina, un evento interno de PlayCanvas puede actualizar texto, mostrar notificaciones
        o incluso crear nuevos elementos HTML sobre la marcha.`;
    cont4.appendChild(p4_2);

        var p4_3 = document.createElement('p');
    p4_3.innerHTML = `Este canal de comunicación se construye mediante:
  <ul>
    <li><strong>Event listeners</strong> en los botones/html que llaman a métodos expuestos en los Script Components de PlayCanvas.</li>
    <li><strong>Fire/On events</strong> dentro de PlayCanvas para notificar al documento de que algo ha ocurrido (animación finalizada, colisión detectada, etc.).</li>
    <li><strong>Lectura/Escritura del DOM</strong> en cualquier Script Component de PlayCanvas usando <code>document.getElementById()</code> o <code>querySelector()</code>.</li>
  </ul>
</p>`;
    cont4.appendChild(p4_3);

    var btn4a = document.createElement('button');
    btn4a.className = 'section-button';
    btn4a.textContent = 'Reiniciar animación';
    cont4.appendChild(btn3a);

    var btn4b = document.createElement('button');
    btn4b.className = 'section-button';
    btn4b.textContent = 'Saltar a final';
    cont4.appendChild(btn3b);

    sec4.appendChild(cont4);
    uiContainer.appendChild(sec4);

    // 3.7) Si quieres más secciones, simplemente repite el patrón: empty-section / scroll-section

    // Finalmente, añadimos el contenedor completo al <body>
    // document.body.appendChild(uiContainer);  //Eliminado al integrar Lenis

    // —————————————————————————————————————————————————————————————————————————
    // 4) ESCUCHAR EL SCROLL DEL CONTENEDOR PARA SINCRONIZAR ANIMACIONES
    // —————————————————————————————————————————————————————————————————————————
    var self = this;
    uiContainer.addEventListener('scroll', function () {
        var scrollTop = uiContainer.scrollTop;
        var maxScroll = uiContainer.scrollHeight - uiContainer.clientHeight;
        var t = scrollTop / maxScroll; // valor normalizado entre 0 y 1

        // Ejemplo de sincronización con un cubo “Box” que tenga componente Animation:
        var animEntity = self.app.root.findByName('Box');
        if (animEntity && animEntity.animation) {
            var clipName = animEntity.animation.assets[0].name;
            var duration = animEntity.animation.duration;
            animEntity.animation.play(clipName, 0);
            animEntity.animation.time = t * duration;
            animEntity.animation.speed = 0;
        }
    });

    // —————————————————————————————————————————————————————————————————————————
    // 5) EJEMPLO: VINCULAR CLICK DE BOTONES HTML A ACCIONES EN SCENA CANVAS
    // —————————————————————————————————————————————————————————————————————————
    // Ejemplo: al pulsar “Reiniciar animación” (btn3a), reiniciamos la animación del cubo
    btn3a.addEventListener('click', function () {
        var box = self.app.root.findByName('Box');
        if (box && box.animation) {
            var clip = box.animation.assets[0].name;
            box.animation.play(clip, 0);
            box.animation.speed = 1;    // velocidad normal para que corra desde el inicio
        }
    });

    // Ejemplo: al pulsar “Saltar a final” (btn3b), llevamos la animación al final
    btn3b.addEventListener('click', function () {
        var box = self.app.root.findByName('Box');
        if (box && box.animation) {
            var clip = box.animation.assets[0].name;
            box.animation.play(clip, 0);
            box.animation.time = box.animation.duration; // coloca al final
            box.animation.speed = 0;
        }
    });

    // Si necesitas más listeners para otros botones, añádelos aquí de forma similar...
};
