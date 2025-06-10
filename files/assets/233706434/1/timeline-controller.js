// timeline-controller.js

var TimelineController = pc.createScript('timelineController');

// 🔗 Enlaza el JSON de la línea de tiempo desde el Inspector
TimelineController.attributes.add('timelineAsset', {
    type: 'asset',
    assetType: 'json',
    title: 'Timeline JSON'
});

// ────────────────────────── INITIALIZE ──────────────────────────
TimelineController.prototype.initialize = function () {
    // 1) Inicializamos el array de secciones vacío
    this.timeline = [];

    // 2) Obtenemos la URL pública de tu asset JSON
    var url = this.timelineAsset.getFileUrl();
    console.log("🔗 Cargando timeline desde:", url);

    // 3) Lo cargamos con fetch para leer el array completo
    fetch(url)
        .then(function(resp) { return resp.json(); })
        .then(function(data) {
            this.timeline = data;
            console.log(
                "▶️ Loaded timeline sections:",
                this.timeline.map(function(s) { return s.label; })
            );
        }.bind(this))
        .catch(function(err) {
            console.error("❌ Error al cargar timeline.json:", err);
        });

    // 4) Variables auxiliares
    this.oncePlayed = new Set();

    // 5) Auxiliar para gestionar el pin sin clones ni placeholders previos
    this._pinData  = {};    // guardará por id: { placeholder, pinned }

    // 6) Umbral para limitar logs de scrollT (si lo usas)
    this._lastDbgT = -1;
};





// Bucle de actualización UPDATE
TimelineController.prototype.update = function (dt) {
    if (!this.timeline || this.timeline.length === 0) return;
    
    // Obtenemos el valor de scrollT global proporcionado por Lenis
    var scrollT = window.scrollT || 0;

    // --- GESTIÓN DEL PIN ---
    // Tu lógica de PIN/UNPIN está bien y no necesita cambios. La dejamos como está.
    this.timeline.forEach(function(section) {
        section.actions.forEach(function(a) {
            if (!a.pinHtmlId) return;
            var id = a.pinHtmlId;
            var inRange = scrollT >= section.scroll[0] && scrollT <= section.scroll[1];
            var data = this._pinData[id] || {};
            var el = document.getElementById(id);
            if (!el) return;
            if (inRange && !data.pinned) {
                var rect = el.getBoundingClientRect();
                var placeholder = document.createElement('div');
                placeholder.style.width  = rect.width + 'px';
                placeholder.style.height = rect.height + 'px';
                el.parentNode.insertBefore(placeholder, el);
                document.body.appendChild(el);
                el.style.position = 'fixed';
                el.style.top = rect.top + 'px';
                el.style.left = rect.left + 'px';
                this._pinData[id] = { placeholder: placeholder, pinned: true };
            } else if (!inRange && data.pinned) {
                var placeholder = data.placeholder;
                placeholder.parentNode.insertBefore(el, placeholder);
                placeholder.parentNode.removeChild(placeholder);
                el.style.position = '';
                el.style.top = '';
                el.style.left = '';
                delete this._pinData[id];
            }
        }.bind(this));
    }.bind(this));

    // --- APLICAR ACCIONES DE ANIMACIÓN 3D ---
    this.timeline.forEach(function(section) {
        var start = section.scroll[0];
        var end = section.scroll[1];
        
        // Calculamos el progreso normalizado (ratio) dentro del tramo actual
        var ratio = (scrollT - start) / (end - start);
        
        // Aseguramos que el ratio esté siempre entre 0 y 1 (clamp)
        // Esto es CLAVE para la precisión en los bordes.
        ratio = pc.math.clamp(ratio, 0, 1);
        
        // Si el scroll está fuera del rango de la sección, nos aseguramos
        // de que los objetos estén en su posición inicial o final.
        if (scrollT < start) ratio = 0;
        if (scrollT > end) ratio = 1;

        section.actions.forEach(function(action) {
            // Saltamos las acciones de pin que ya hemos procesado
            if (action.pinHtmlId) return;

            this._apply(action, ratio); // Pasamos el ratio CLAMPED
        }.bind(this));
    }.bind(this));
};

// Función interna para aplicar cada acción (MODIFICADA)
TimelineController.prototype._apply = function (a, r) {
    /* 1) Movimiento de entidad 3D ------------------------------------ */
    if (a.tag && a.prop) {
        var entList = this.app.root.findByTag(a.tag);

        // Obtenemos la función de Easing CORRECTAMENTE
        var easingFn = function(k) { return k; }; // Por defecto es lineal
        if (a.ease) {
            var easePath = a.ease.split('.'); // "TWEEN.Easing.Elastic.Out" -> ["TWEEN", "Easing", "Elastic", "Out"]
            var fn = window;
            try {
                easePath.forEach(function(p) { fn = fn[p]; });
                if (typeof fn === 'function') {
                    easingFn = fn;
                }
            } catch (e) {
                console.warn('Easing no encontrado:', a.ease);
            }
        }
        
        // Aplicamos la curva de Easing al ratio (r)
        var easedRatio = easingFn(r);
        
        // Calculamos el valor final de forma ABSOLUTA
        var value = a.from + (a.to - a.from) * easedRatio;

        var parts = a.prop.split(':'); // "localPosition:x"
        var field = parts[0];
        var axis = parts[1];

        entList.forEach(function (e) {
            if (field === 'localPosition') {
                var v = e.getLocalPosition().clone();
                v[axis] = value;
                e.setLocalPosition(v);
            } else if (field === 'localRotation') {
                // Para rotación, es mejor trabajar con Euler y Quaternions
                var euler = e.getLocalEulerAngles().clone();
                euler[axis] = value;
                e.setLocalEulerAngles(euler);
            } else {
                console.warn("Propiedad no soportada:", field);
            }
        });
    }

    /* 2) Disparo de animaciones (sin cambios, tu lógica es correcta) ---- */
    if (a.tag && a.trigger && a.anim) {
        // ... tu código de trigger 'once' y 'reverse' está bien
    }
};


// Función interna para aplicar cada acción
TimelineController.prototype._apply = function (a, r) {
    /* 1) Movimiento de entidad 3D ------------------------------------ */
    if (a.tag && a.prop) {
        var entList = this.app.root.findByTag(a.tag);

        // Easing function
        var easingFn = function(k) { return k; };
        if (typeof window.TWEEN !== 'undefined' && a.ease && window.TWEEN.Easing && window.TWEEN.Easing[a.ease]) {
            easingFn = window.TWEEN.Easing[a.ease];
        }
        var eased = easingFn(r);
        var value = a.from + (a.to - a.from) * eased;

        var parts = a.prop.split(':'); // "localPosition:x"
        var field = parts[0];
        var axis = parts[1];

        entList.forEach(function (e) {
            if (field === 'localPosition') {
                var v = e.getLocalPosition().clone();
                v[axis] = value;
                e.setLocalPosition(v);
            } else if (field === 'localRotation') {
                var q = e.getLocalRotation().clone();
                q[axis] = value;
                e.setLocalRotation(q);
            } else {
                console.warn("Propiedad no soportada:", field);
            }
        });
    }

    /* 2) Disparo de animaciones -------------------------------------- */
    if (a.tag && a.trigger && a.anim) {
        var entList = this.app.root.findByTag(a.tag);
        entList.forEach(function (e) {
            var animCmp = e.animation;
            if (!animCmp) return;

            if (a.trigger === 'once') {
                if (this.oncePlayed.has(e.getGuid())) return;
                animCmp.play(a.anim, 0);
                this.oncePlayed.add(e.getGuid());
            } else if (a.trigger === 'reverse') {
                animCmp.play(a.anim, 0);
                animCmp.speed = 0;
                animCmp.time  = r * animCmp.duration;
            }
        }.bind(this));
    }
};
