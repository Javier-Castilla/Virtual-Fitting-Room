import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { ModelLoaderService } from './model-loader';
import { ThreejsService } from './threejs';
import { Outfit } from '../../domain/model/outfit';
import { Garment } from '../../domain/model/garment';

type LoadedGarment = {
  root: THREE.Group;
  inner: THREE.Object3D;
  baseWidth: number;
  referenceShoulderWidth: number;
};

@Injectable({ providedIn: 'root' })
export class GarmentManagerService {
  private currentOutfit: Outfit | null = null;
  private loaded: Map<string, LoadedGarment> = new Map();
  private smoothing = 0.35;
  private zPlane = 0;
  private garmentWidthFactor = 1.15;

  constructor(
    private modelLoader: ModelLoaderService,
    private threeService: ThreejsService
  ) {}

  /**
   * Carga un modelo 3D de prenda y lo añade a la escena
   */
  async loadGarmentModel(garment: Garment): Promise<void> {
    console.log('📦 Cargando modelo:', garment.modelPath);

    // Si ya existe, eliminarlo primero
    if (this.loaded.has(garment.id)) {
      this.removeGarment(garment.id);
    }

    const inner = await this.modelLoader.loadModel(garment.modelPath);
    inner.name = garment.id;
    inner.updateMatrixWorld(true);

    // Calcular dimensiones y centrar el modelo
    const bbox = new THREE.Box3().setFromObject(inner);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());

    inner.position.sub(center);
    inner.rotation.set(0, 0, 0);

    // Crear grupo root para transformaciones
    const root = new THREE.Group();
    root.name = `${garment.id}__root`;
    root.add(inner);

    const baseWidth = Math.max(size.x, 1e-6);

    this.loaded.set(garment.id, {
      root,
      inner,
      baseWidth,
      referenceShoulderWidth: 0
    });

    this.threeService.scene.add(root);
    console.log('✅ Modelo cargado y añadido a la escena:', garment.id);
  }

  /**
   * Actualiza la posición y escala de una prenda basándose en los landmarks de pose
   */
  updateGarmentPosition(
    garmentId: string,
    poseLandmarks2d: any[],
    poseLandmarks3d?: any[]
  ): void {
    const entry = this.loaded.get(garmentId);
    if (!entry) return;

    if (!poseLandmarks2d || poseLandmarks2d.length < 25) return;

    // Landmarks clave del cuerpo
    const ls2d = poseLandmarks2d[11]; // Left shoulder
    const rs2d = poseLandmarks2d[12]; // Right shoulder
    const lh2d = poseLandmarks2d[23]; // Left hip
    const rh2d = poseLandmarks2d[24]; // Right hip

    if (!ls2d || !rs2d || !lh2d || !rh2d) return;

    // Calcular centro del torso
    const centerX = (ls2d.x + rs2d.x) / 2;
    const centerY = (ls2d.y + rs2d.y + lh2d.y + rh2d.y) / 4;

    // Calcular ancho de hombros normalizado
    const shoulderWidthN = Math.abs(rs2d.x - ls2d.x);
    if (shoulderWidthN < 0.02) return;

    // Actualizar ancho de referencia
    if (entry.referenceShoulderWidth === 0 || shoulderWidthN > entry.referenceShoulderWidth) {
      entry.referenceShoulderWidth = shoulderWidthN;
    }

    const effectiveWidth = Math.max(shoulderWidthN, entry.referenceShoulderWidth * 0.6);

    // Calcular ángulo de inclinación de hombros (roll)
    const dx = rs2d.x - ls2d.x;
    const dy = rs2d.y - ls2d.y;
    let shoulderAngleZ = Math.atan2(dy, dx);
    shoulderAngleZ = this.wrapToHalfPi(shoulderAngleZ);

    // Calcular rotación del torso (yaw) usando landmarks 3D
    let torsoRotationY = 0;
    if (poseLandmarks3d && poseLandmarks3d.length >= 25) {
      const ls3d = poseLandmarks3d[11];
      const rs3d = poseLandmarks3d[12];
      const lh3d = poseLandmarks3d[23];
      const rh3d = poseLandmarks3d[24];

      if (ls3d && rs3d && lh3d && rh3d) {
        // Vector de hombros
        const shoulderVec = new THREE.Vector3(
          rs3d.x - ls3d.x,
          rs3d.y - ls3d.y,
          rs3d.z - ls3d.z
        ).normalize();

        // Vector de columna vertebral
        const spineVec = new THREE.Vector3(
          (ls3d.x + rs3d.x) / 2 - (lh3d.x + rh3d.x) / 2,
          (ls3d.y + rs3d.y) / 2 - (lh3d.y + rh3d.y) / 2,
          (ls3d.z + rs3d.z) / 2 - (lh3d.z + rh3d.z) / 2
        ).normalize();

        // Vector forward (perpendicular al plano del torso)
        const forward = new THREE.Vector3()
          .crossVectors(shoulderVec, spineVec)
          .normalize();

        torsoRotationY = Math.atan2(forward.x, forward.z);
      }
    }

    // Convertir coordenadas normalizadas a coordenadas de mundo
    const cam = this.threeService.camera;
    const dist = Math.max(cam.position.z - this.zPlane, 0.25);
    const vFov = THREE.MathUtils.degToRad(cam.fov);
    const planeHeight = 2 * dist * Math.tan(vFov / 2);
    const planeWidth = planeHeight * cam.aspect;

    const x = (centerX - 0.5) * planeWidth;
    const y = (0.5 - centerY) * planeHeight;

    // Calcular escala basada en el ancho de hombros
    const targetWidth = Math.max(effectiveWidth * planeWidth * this.garmentWidthFactor, 1e-6);
    let s = targetWidth / entry.baseWidth;
    s = THREE.MathUtils.clamp(s, 0.02, 20);

    // Aplicar transformaciones con suavizado
    const targetPos = new THREE.Vector3(x, y, this.zPlane);
    const targetScale = new THREE.Vector3(s, s, s);

    entry.root.position.lerp(targetPos, this.smoothing);
    entry.root.scale.lerp(targetScale, this.smoothing);

    // Aplicar rotaciones con suavizado
    const currentRotY = entry.root.rotation.y;
    const currentRotZ = entry.root.rotation.z;

    entry.root.rotation.set(
      0,
      THREE.MathUtils.lerp(currentRotY, torsoRotationY, this.smoothing),
      THREE.MathUtils.lerp(currentRotZ, shoulderAngleZ, this.smoothing)
    );
  }

  /**
   * Normaliza ángulos al rango [-π/2, π/2]
   */
  private wrapToHalfPi(a: number): number {
    if (a > Math.PI / 2) return a - Math.PI;
    if (a < -Math.PI / 2) return a + Math.PI;
    return a;
  }

  /**
   * Elimina una prenda de la escena
   */
  removeGarment(garmentId: string): void {
    const entry = this.loaded.get(garmentId);
    if (!entry) return;

    this.threeService.scene.remove(entry.root);
    this.loaded.delete(garmentId);
    console.log('🗑️ Prenda eliminada:', garmentId);
  }

  /**
   * Elimina todas las prendas cargadas
   */
  clearAllGarments(): void {
    this.loaded.forEach((entry, garmentId) => {
      this.threeService.scene.remove(entry.root);
    });
    this.loaded.clear();
    console.log('🗑️ Todas las prendas eliminadas');
  }

  /**
   * Establece el outfit actual
   */
  setOutfit(outfit: Outfit): void {
    this.currentOutfit = outfit;
    console.log('👔 Outfit establecido:', outfit.name);
  }

  /**
   * Obtiene el outfit actual
   */
  getCurrentOutfit(): Outfit | null {
    return this.currentOutfit;
  }

  /**
   * Verifica si una prenda está cargada
   */
  isGarmentLoaded(garmentId: string): boolean {
    return this.loaded.has(garmentId);
  }

  /**
   * Obtiene información de una prenda cargada
   */
  getLoadedGarment(garmentId: string): LoadedGarment | undefined {
    return this.loaded.get(garmentId);
  }

  /**
   * Obtiene la lista de IDs de prendas cargadas
   */
  getLoadedGarmentIds(): string[] {
    return Array.from(this.loaded.keys());
  }

  /**
   * Actualiza el factor de suavizado para las animaciones
   */
  setSmoothingFactor(value: number): void {
    this.smoothing = THREE.MathUtils.clamp(value, 0, 1);
  }

  /**
   * Actualiza el factor de escala de prendas
   */
  setGarmentWidthFactor(value: number): void {
    this.garmentWidthFactor = Math.max(value, 0.1);
  }

  /**
   * Actualiza el plano Z donde se posicionan las prendas
   */
  setZPlane(value: number): void {
    this.zPlane = value;
  }
}
