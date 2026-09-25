import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export default function LiaterHeroAnimation() {
  const mountRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isDisposed = false;
    const width = container.clientWidth || 520;
    const height = container.clientHeight || 460;

    // ─── 1. ESCENA, CÁMARA Y RENDERER ─────────────────────────────────────────
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // ─── 2. ENTORNO PBR Y REFLEXIONES DE ESTUDIO ──────────────────────────────
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    const envTexture = pmremGenerator.fromScene(roomEnv).texture;
    scene.environment = envTexture;

    // ─── 3. ILUMINACIÓN CINEMATOGRÁFICA ───────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 1.8));

    // Luz principal solar cálida
    const keyLight = new THREE.DirectionalLight(0xfff7e8, 3.8);
    keyLight.position.set(-3.5, 5.0, 5.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    // Luz de contorno azul cian para destellos de borde metálico
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 2.2);
    rimLight.position.set(4.5, -2.5, -3.5);
    scene.add(rimLight);

    // Luz puntual dorada de relleno
    const fillLight = new THREE.PointLight(0xfca311, 2.2, 12, 1.2);
    fillLight.position.set(3.0, 2.0, 4.0);
    scene.add(fillLight);

    // Luz cenital suave
    const topLight = new THREE.DirectionalLight(0xffffff, 1.2);
    topLight.position.set(0, 6.0, 1.5);
    scene.add(topLight);

    // ─── 4. GRUPO PRINCIPAL INTERACTIVO ───────────────────────────────────────
    const logoRoot = new THREE.Group();
    // Ángulo inicial tres cuartos elegante (similar a la vista de referencia)
    logoRoot.rotation.y = -0.52;
    logoRoot.rotation.x = 0.08;
    scene.add(logoRoot);

    // ─── 5. MATERIALES FÍSICOS (PBR) RESPETANDO LOS COLORES ORIGINALES DEL MODELO ───
    // Oro metálico para el medallón y las letras "E" y "R"
    const goldMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xf5b112),
      emissive: new THREE.Color(0x3d2400),
      emissiveIntensity: 0.16,
      metalness: 0.88,
      roughness: 0.22,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      reflectivity: 0.95,
      side: THREE.DoubleSide,
    });

    // Blanco brillante lacado para las letras "L", "I", "A", "T" y detalles blancos originales
    const whiteMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xffffff),
      roughness: 0.14,
      metalness: 0.05,
      clearcoat: 0.88,
      clearcoatRoughness: 0.08,
      reflectivity: 0.9,
      side: THREE.DoubleSide,
    });

    // Negro profundo satinado para el símbolo en relieve central (M000 y M312920)
    const blackMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x0a0a0a),
      roughness: 0.22,
      metalness: 0.45,
      clearcoat: 0.75,
      clearcoatRoughness: 0.12,
      side: THREE.DoubleSide,
    });

    // ─── 6. CARGA DEL MODELO 3D GLB ───────────────────────────────────────────
    const loader = new GLTFLoader();
    const modelUrl = `${import.meta.env.BASE_URL}models/LIATER_logo_3D.glb`;

    loader.load(
      modelUrl,
      (gltf) => {
        if (isDisposed) return;

        const model = gltf.scene;

        // Asignar materiales PBR respetando estrictamente los colores originales del modelo 3D
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            const matName = child.material?.name || '';
            const origColorHex = child.material?.color?.getHexString()?.toLowerCase() || '';

            // Si es blanco (#ffffff o M255255255) -> Mantener BLANCO puro
            if (origColorHex === 'ffffff' || matName.includes('255255255')) {
              child.material = whiteMat;
            }
            // Si es dorado (#f5b112 o M24517718) -> Oro metálico
            else if (origColorHex === 'f5b112' || matName.includes('24517718')) {
              child.material = goldMat;
            }
            // Si es negro o grafito (#000000, M000, M312920) -> Negro satinado
            else {
              child.material = blackMat;
            }
          }
        });

        // Centrado geométrico y escalado proporcional automático
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const modelPivot = new THREE.Group();
        // Desplazar el modelo para que su centro geométrico coincida exactamente con el origen (0, 0, 0)
        model.position.set(-center.x, -center.y, -center.z);
        modelPivot.add(model);

        // Escalar para que tenga una presencia óptima y nítida en el hero
        const targetHeight = 4.05;
        const scaleFactor = targetHeight / (size.y || 1);
        modelPivot.scale.setScalar(scaleFactor);

        logoRoot.add(modelPivot);
        setLoading(false);
      },
      undefined,
      (err) => {
        console.error('Error cargando el modelo LIATER_logo_3D.glb:', err);
        setLoading(false);
      }
    );

    // ─── 7. INTERACCIÓN CON EL MOUSE Y TÁCTIL ──────────────────────────────────
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let targetRotY = -0.52;
    let targetRotX = 0.08;
    let mouseParallax = { x: 0, y: 0 };

    const handlePointerDown = (clientX, clientY) => {
      isDragging = true;
      previousMousePosition = { x: clientX, y: clientY };
    };

    const handlePointerMove = (clientX, clientY) => {
      const rect = container.getBoundingClientRect();
      const nx = (clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const ny = (clientY - rect.top - rect.height / 2) / (rect.height / 2);
      mouseParallax.x = nx * 0.32;
      mouseParallax.y = -ny * 0.18;

      if (isDragging) {
        const deltaX = clientX - previousMousePosition.x;
        const deltaY = clientY - previousMousePosition.y;
        targetRotY += deltaX * 0.012;
        targetRotX += deltaY * 0.012;
        previousMousePosition = { x: clientX, y: clientY };
      }
    };

    const handlePointerUp = () => {
      isDragging = false;
    };

    const onMouseDown = (e) => handlePointerDown(e.clientX, e.clientY);
    const onMouseMove = (e) => handlePointerMove(e.clientX, e.clientY);
    const onMouseUp = () => handlePointerUp();

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchMove = (e) => {
      if (e.touches.length === 1) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => handlePointerUp();

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // ─── 8. LOOP DE ANIMACIÓN ────────────────────────────────────────────────
    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Giro suave cuando el usuario no está arrastrando
      if (!isDragging) {
        targetRotY += 0.0065;
      }

      // Suavizado cinético (Lerp)
      logoRoot.rotation.y += (targetRotY + mouseParallax.x - logoRoot.rotation.y) * 0.08;
      logoRoot.rotation.x += (targetRotX + mouseParallax.y - logoRoot.rotation.x) * 0.08;

      // Flotación armónica
      logoRoot.position.y = Math.sin(elapsed * 1.5) * 0.08;

      renderer.render(scene, camera);
    };

    animate();

    // ─── LIMPIEZA ─────────────────────────────────────────────────────────────
    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onResize);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);

      scene.traverse((obj) => {
        if (obj.isMesh) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        }
      });

      pmremGenerator.dispose();
      envTexture.dispose();
      roomEnv.dispose();
      goldMat.dispose();
      whiteMat.dispose();
      blackMat.dispose();

      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '520px',
        height: '460px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        userSelect: 'none',
        background: 'transparent',
      }}
    >
      {loading && (
        <div
          style={{
            position: 'absolute',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(252, 163, 17, 0.25) 0%, transparent 70%)',
            filter: 'blur(20px)',
            animation: 'pulse 1.8s infinite ease-in-out',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
