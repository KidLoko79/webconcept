/**
 * @name Ocean
 * @class Este script genera y anima una superficie de agua similar a un océano.
 * @description Crea una malla de plano dinámicamente y la deforma usando dos ondas sinusoidales superpuestas.
 * Reacciona a la posición del ratón elevando el agua y cambiando su color.
 * @property {number} planeSize - El tamaño (ancho y largo) del plano del océano en unidades del mundo.
 * @property {number} meshResolution - El número de segmentos en cada lado del plano. Mayor resolución significa más detalle pero menor rendimiento.
 * @property {pc.Color} highColor - El color del agua en los picos más altos de las olas.
 * @property {pc.Color} midColor - El color del agua a nivel medio.
 * @property {pc.Color} lowColor - El color del agua en las partes más bajas de las olas.
 * @property {boolean} showPoints - Si es verdadero, renderiza una capa de puntos sobre la superficie del agua.
 * @property {pc.Color} pointColor - El color de los puntos (si showPoints es verdadero).
 * @property {number} pointSize - El tamaño de los puntos (si showPoints es verdadero).
 * @property {number} pointRandomFactor - Variación aleatoria en el tamaño de los puntos.
 * @property {number} mouseRadius - El radio de influencia del cursor del ratón en unidades del mundo.
 * @property {number} mouseIntensity - La fuerza con la que el ratón eleva el agua.
 * @property {number} wave1Amplitude - La amplitud (altura) de la primera ola.
 * @property {number} wave1Size - La longitud de onda (tamaño) de la primera ola. Un valor más alto crea olas más anchas.
 * @property {number} wave1Speed - La velocidad de la primera ola.
 * @property {pc.Vec2} wave1Direction - La dirección (X, Z) de la primera ola.
 * @property {number} wave2Amplitude - La amplitud (altura) de la segunda ola.
 * @property {number} wave2Size - La longitud de onda (tamaño) de la segunda ola.
 * @property {number} wave2Speed - La velocidad de la segunda ola.
 * @property {pc.Vec2} wave2Direction - La dirección (X, Z) de la segunda ola.
 * @property {'add'|'multiply'|'average'} waveOperation - Cómo se combinan las dos olas ('add', 'multiply', 'average').
 */
var Ocean = pc.createScript('ocean');

// --- Atributos del Script (expuestos en el editor de PlayCanvas) ---

// --- Configuración General ---
Ocean.attributes.add('planeSize', { type: 'number', default: 50, title: 'Tamaño del Plano', description: 'Ancho y largo del plano del océano.' });
Ocean.attributes.add('meshResolution', { type: 'number', default: 80, title: 'Resolución de la Malla', description: 'Número de segmentos. Más alto = más detalle.' });

// --- Colores del Océano ---
Ocean.attributes.add('highColor', { type: 'rgb', default: [0, 0.8, 1], title: 'Color de Zonas Altas' });
Ocean.attributes.add('midColor', { type: 'rgb', default: [0.1, 0.4, 0.9], title: 'Color de Zonas Medias' });
Ocean.attributes.add('lowColor', { type: 'rgb', default: [0, 0.1, 0.3], title: 'Color de Zonas Bajas' });

// --- Configuración de Puntos ---
Ocean.attributes.add('showPoints', { type: 'boolean', default: false, title: 'Mostrar Puntos', description: 'Renderiza puntos en los vértices de la malla.' });
Ocean.attributes.add('pointColor', { type: 'rgb', default: [1, 1, 1], title: 'Color de los Puntos' });
Ocean.attributes.add('pointSize', { type: 'number', default: 1.5, title: 'Tamaño de los Puntos' });
Ocean.attributes.add('pointRandomFactor', { type: 'number', default: 0.5, title: 'Factor Aleatorio Puntos', description: 'Variación aleatoria en el tamaño de los puntos.' });

// --- Interacción del Ratón ---
Ocean.attributes.add('mouseRadius', { type: 'number', default: 8, title: 'Radio de Influencia (Ratón)' });
Ocean.attributes.add('mouseIntensity', { type: 'number', default: 4, title: 'Intensidad de Influencia (Ratón)' });

// --- Generador de Olas 1 ---
Ocean.attributes.add('wave1Amplitude', { type: 'number', default: 1, title: 'Ola 1: Amplitud' });
Ocean.attributes.add('wave1Size', { type: 'number', default: 10, title: 'Ola 1: Tamaño (Longitud)' });
Ocean.attributes.add('wave1Speed', { type: 'number', default: 0.5, title: 'Ola 1: Velocidad' });
Ocean.attributes.add('wave1Direction', { type: 'vec2', default: [1, 0.3], title: 'Ola 1: Dirección (X, Z)' });

// --- Generador de Olas 2 ---
Ocean.attributes.add('wave2Amplitude', { type: 'number', default: 0.7, title: 'Ola 2: Amplitud' });
Ocean.attributes.add('wave2Size', { type: 'number', default: 4, title: 'Ola 2: Tamaño (Longitud)' });
Ocean.attributes.add('wave2Speed', { type: 'number', default: 1.2, title: 'Ola 2: Velocidad' });
Ocean.attributes.add('wave2Direction', { type: 'vec2', default: [-0.2, 1], title: 'Ola 2: Dirección (X, Z)' });

// --- Combinación de Olas ---
Ocean.attributes.add('waveOperation', {
    type: 'string',
    default: 'add',
    title: 'Operación de Olas',
    enum: [
        { 'Sumar': 'add' },
        { 'Multiplicar': 'multiply' },
        { 'Promedio': 'average' }
    ],
    description: 'Cómo combinar las dos olas.'
});


// --- Método Initialize (se ejecuta una vez al cargar el script) ---
Ocean.prototype.initialize = function () {
    this.oceanEntity = new pc.Entity('OceanSurface');
    
    // 1. Crear plano base
    const baseMesh = pc.createPlane(this.app.graphicsDevice, {
        halfExtents: new pc.Vec2(this.planeSize / 2, this.planeSize / 2),
        widthSegments: this.meshResolution,
        lengthSegments: this.meshResolution
    });
    
    // 2. Extraer datos del vértice
    const baseVertexBuffer = baseMesh.vertexBuffer;
    const numVertices = baseVertexBuffer.numVertices;
    
    // 3. Guardar posiciones iniciales
    this.initialPositions = [];
    const baseIterator = new pc.VertexIterator(baseVertexBuffer);
    for (let i = 0; i < numVertices; i++) {
        const position = baseIterator.element[pc.SEMANTIC_POSITION];
        this.initialPositions.push(new pc.Vec3(position[0], position[1], position[2]));
        baseIterator.next();
    }
    baseIterator.end();

    // 4. Crear nuevo formato de vértice
    const vertexFormat = new pc.VertexFormat(this.app.graphicsDevice, [
        { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 },
        { semantic: pc.SEMANTIC_NORMAL, components: 3, type: pc.TYPE_FLOAT32 },
        { semantic: pc.SEMANTIC_COLOR, components: 4, type: pc.TYPE_UINT8, normalize: true }
    ]);
    
    // 5. Crear VertexBuffer dinámico
    const vertexBuffer = new pc.VertexBuffer(this.app.graphicsDevice, vertexFormat, numVertices, pc.BUFFER_DYNAMIC);
    
    // 6. Rellenar el buffer
    const newIterator = new pc.VertexIterator(vertexBuffer);
    const baseDataIterator = new pc.VertexIterator(baseVertexBuffer);

    for (let i = 0; i < numVertices; i++) {
        const pos = baseDataIterator.element[pc.SEMANTIC_POSITION];
        newIterator.element[pc.SEMANTIC_POSITION].set(pos[0], pos[1], pos[2]);

        const normal = baseDataIterator.element[pc.SEMANTIC_NORMAL];
        newIterator.element[pc.SEMANTIC_NORMAL].set(normal[0], normal[1], normal[2]);
        
        newIterator.element[pc.SEMANTIC_COLOR].set(255, 255, 255, 255);
        
        newIterator.next();
        baseDataIterator.next();
    }
    newIterator.end();
    baseDataIterator.end();

    // 7. Crear la malla final
    const mesh = new pc.Mesh();
    mesh.vertexBuffer = vertexBuffer;
    mesh.indexBuffer[0] = baseMesh.indexBuffer[0];
    mesh.primitive[0].type = pc.PRIMITIVE_TRIANGLES;
    mesh.primitive[0].base = 0;
    mesh.primitive[0].count = baseMesh.primitive[0].count;
    mesh.primitive[0].indexed = true;

    // --- Creación del material del océano ---
    const material = new pc.StandardMaterial();
    material.vertexColors = true;
    material.diffuse = new pc.Color(1, 1, 1);
    material.useMetalness = false;
    material.shininess = 60;
    material.update();

    // FORMA COMPATIBLE CON PLAYCANVAS 2.7.4:
    // Primero añadir el componente render sin configuración
    this.oceanEntity.addComponent('render');
    
    // Luego configurar la malla
    this.oceanEntity.render.meshInstances = [
        new pc.MeshInstance(mesh, material)
    ];
    this.oceanEntity.render.type = pc.RENDERSTYLE_SOLID;

    this.entity.addChild(this.oceanEntity);

    // Normalizar direcciones de las olas
    this.wave1Direction = new pc.Vec2(this.wave1Direction.x, this.wave1Direction.y).normalize();
    this.wave2Direction = new pc.Vec2(this.wave2Direction.x, this.wave2Direction.y).normalize();

    // --- Creación de la malla de PUNTOS (opcional) ---
    if (this.showPoints) {
        this.pointsEntity = new pc.Entity('OceanPoints');
        const pointsMesh = this.createPointsMesh(mesh);
        
        const pointsMaterial = new pc.StandardMaterial();
        pointsMaterial.diffuse = new pc.Color(0,0,0); // Negro para que el emissive sea el color principal
        pointsMaterial.emissive = this.pointColor; // El color real de los puntos
        pointsMaterial.cull = pc.CULLFACE_NONE; // No descartar ninguna cara
        pointsMaterial.update();

        const meshInstance = new pc.MeshInstance(pointsMesh, pointsMaterial);
        meshInstance.primitive[0].type = pc.PRIMITIVE_POINTS; // Renderizar como puntos
        meshInstance.primitive[0].count = pointsMesh.vertexBuffer.numVertices;
        
        this.pointsEntity.addComponent('render', {
            type: 'mesh',
            meshInstances: [meshInstance]
        });
        this.entity.addChild(this.pointsEntity);
    }


    // --- Configuración de la interacción del ratón ---
    this.cameraEntity = this.app.root.findComponent('camera').entity;
    this.mousePosition = new pc.Vec2();
    this.worldMousePosition = new pc.Vec3();
    if (this.app.mouse) {
        this.app.mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
    }
    // Para dispositivos táctiles
     if (this.app.touch) {
        this.app.touch.on(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
    }


    // --- Variables de estado ---
    this.time = 0;

    // Normalizar direcciones de las olas para cálculos consistentes
    this.wave1Direction.normalize();
    this.wave2Direction.normalize();

    // Cachear algunas variables para no crearlas cada frame
    this.tempVec = new pc.Vec3();
    this.tempColor = new pc.Color();
    this.ray = new pc.Ray();
    this.plane = new pc.Plane(this.entity.up, -this.entity.getPosition().y);
};

// --- Método Update (se ejecuta en cada frame) ---
Ocean.prototype.update = function (dt) {
    this.time += dt;

    // Actualizar posición del ratón
    this.updateWorldMousePosition();

    const oceanMeshInstance = this.oceanEntity.render.meshInstances[0];
    const oceanMesh = oceanMeshInstance.mesh;
    const vertexBuffer = oceanMesh.vertexBuffer;
    const iterator = new pc.VertexIterator(vertexBuffer);

    // Variables de la ola
    const freq1 = (2 * Math.PI) / this.wave1Size;
    const speed1 = this.wave1Speed;
    const amp1 = this.wave1Amplitude;

    const freq2 = (2 * Math.PI) / this.wave2Size;
    const speed2 = this.wave2Speed;
    const amp2 = this.wave2Amplitude;
    
    const totalAmplitude = amp1 + amp2 + this.mouseIntensity;

    for (let i = 0; i < this.initialPositions.length; i++) {
        const initialPos = this.initialPositions[i];
        
        // Cálculo de las olas
        const dot1 = this.wave1Direction.x * initialPos.x + this.wave1Direction.y * initialPos.z;
        const wave1_y = Math.sin(dot1 * freq1 + this.time * speed1) * amp1;

        const dot2 = this.wave2Direction.x * initialPos.x + this.wave2Direction.y * initialPos.z;
        const wave2_y = Math.sin(dot2 * freq2 + this.time * speed2) * amp2;

        let combined_y = 0;
        switch(this.waveOperation) {
            case 'add': combined_y = wave1_y + wave2_y; break;
            case 'multiply': combined_y = wave1_y * wave2_y; break;
            case 'average': combined_y = (wave1_y + wave2_y) / 2; break;
        }

        // Influencia del ratón
        const distToMouse = Math.sqrt(
            Math.pow(initialPos.x - this.worldMousePosition.x, 2) +
            Math.pow(initialPos.z - this.worldMousePosition.z, 2)
        );

        const mouseFactor = 1.0 - pc.math.clamp(distToMouse / this.mouseRadius, 0, 1);
        const smoothMouseFactor = mouseFactor * mouseFactor * (3 - 2 * mouseFactor);
        const mouse_y = smoothMouseFactor * this.mouseIntensity;

        const final_y = combined_y + mouse_y;
        
        // Actualizar posición
        iterator.element[pc.SEMANTIC_POSITION].set(initialPos.x, final_y, initialPos.z);

        // Actualizar color
        const normalizedHeight = pc.math.clamp((final_y + totalAmplitude) / (totalAmplitude * 2), 0, 1);
        if (normalizedHeight < 0.5) {
            this.tempColor.lerp(this.lowColor, this.midColor, normalizedHeight * 2);
        } else {
            this.tempColor.lerp(this.midColor, this.highColor, (normalizedHeight - 0.5) * 2);
        }
        
        const colorElem = iterator.element[pc.SEMANTIC_COLOR];
        colorElem[0] = this.tempColor.r * 255;
        colorElem[1] = this.tempColor.g * 255;
        colorElem[2] = this.tempColor.b * 255;
        colorElem[3] = 255;

        iterator.next();
    }
    iterator.end();
    
    // Actualizar malla de puntos si existe
    if (this.showPoints && this.pointsEntity) {
        const pointsMeshInstance = this.pointsEntity.render.meshInstances[0];
        const pointsMesh = pointsMeshInstance.mesh;
        
        // Crear un nuevo buffer con las posiciones actualizadas
        const pointsIterator = new pc.VertexIterator(pointsMesh.vertexBuffer);
        const oceanIterator = new pc.VertexIterator(oceanMesh.vertexBuffer);
        
        while (oceanIterator.hasNext()) {
            const pos = oceanIterator.element[pc.SEMANTIC_POSITION];
            pointsIterator.element[pc.SEMANTIC_POSITION].set(pos[0], pos[1], pos[2]);
            
            oceanIterator.next();
            pointsIterator.next();
        }
        oceanIterator.end();
        pointsIterator.end();
    }
};

// --- Funciones de Ayuda ---

/**
 * @function
 * @name Ocean#createPointsMesh
 * @description Crea una malla para ser renderizada como puntos, basada en los vértices de otra malla.
 * @param {pc.Mesh} baseMesh - La malla de la que copiar los vértices.
 * @returns {pc.Mesh} La nueva malla lista para ser usada como puntos.
 */
Ocean.prototype.createPointsMesh = function (baseMesh) {
    const graphicsDevice = this.app.graphicsDevice;
    
    const baseVertexBuffer = baseMesh.vertexBuffer;
    const numVertices = baseVertexBuffer.numVertices;

    // Crear un nuevo formato de vértice sólo con posición y tamaño del punto
    const vertexFormat = new pc.VertexFormat(graphicsDevice, [
        { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 },
        { semantic: pc.SEMANTIC_PSIZE, components: 1, type: pc.TYPE_FLOAT32 } // Para el tamaño del punto
    ]);

    const vertexBuffer = new pc.VertexBuffer(graphicsDevice, vertexFormat, numVertices, pc.BUFFER_DYNAMIC);
    
    const data = new Float32Array(vertexBuffer.lock());
    const baseIterator = new pc.VertexIterator(baseVertexBuffer);

    let offset = 0;
    for (let i = 0; i < numVertices; i++) {
        const pos = baseIterator.element.position;
        // Copiar posición
        data[offset++] = pos[0];
        data[offset++] = pos[1];
        data[offset++] = pos[2];
        // Asignar tamaño de punto
        data[offset++] = this.pointSize + (Math.random() - 0.5) * this.pointSize * this.pointRandomFactor;
        
        baseIterator.next();
    }
    vertexBuffer.unlock();

    const mesh = new pc.Mesh(graphicsDevice);
    mesh.vertexBuffer = vertexBuffer;
    mesh.primitive[0].type = pc.PRIMITIVE_POINTS;
    mesh.primitive[0].base = 0;
    mesh.primitive[0].count = numVertices;
    mesh.primitive[0].indexed = false;

    return mesh;
};

/**
 * @function
 * @name Ocean#updateWorldMousePosition
 * @description Calcula la intersección del rayo del ratón con el plano del océano.
 */
Ocean.prototype.updateWorldMousePosition = function () {
    if (!this.cameraEntity) return;

    this.cameraEntity.camera.screenToWorld(this.mousePosition.x, this.mousePosition.y, this.cameraEntity.camera.nearClip, this.ray.origin);
    this.cameraEntity.camera.screenToWorld(this.mousePosition.x, this.mousePosition.y, this.cameraEntity.camera.farClip, this.tempVec);
    this.ray.direction.sub2(this.tempVec, this.ray.origin).normalize();

    // Reconstruir el plano basado en la posición actual de la entidad
    this.plane.normal.copy(this.entity.up);
    this.plane.constant = -this.entity.getPosition().y;

    const intersection = this.plane.intersectsRay(this.ray, this.tempVec);
    if (intersection) {
        // Transformar la intersección al espacio local de la entidad del océano
        this.worldMousePosition.copy(this.tempVec);
        this.worldMousePosition.sub(this.entity.getPosition());
    }
};

/**
 * @function
 * @name Ocean#onMouseMove
 * @description Actualiza las coordenadas del ratón cuando se mueve.
 * @param {pc.MouseEvent} event - El evento del ratón.
 */
Ocean.prototype.onMouseMove = function (event) {
    this.mousePosition.set(event.x, event.y);
};

/**
 * @function
 * @name Ocean#onTouchMove
 * @description Actualiza las coordenadas del ratón desde un evento táctil.
 * @param {pc.TouchEvent} event - El evento táctil.
 */
Ocean.prototype.onTouchMove = function (event) {
    if (event.touches.length > 0) {
        this.mousePosition.set(event.touches[0].x, event.touches[0].y);
    }
};
