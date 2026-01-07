import { Garment } from '../../domain/model/garment';
import { GarmentType } from '../../domain/enums/garment-type.enum';
import { GarmentCategory } from '../../domain/enums/garment-category.enum';
import { GarmentSize } from '../../domain/enums/garment-size.enum';

export const GARMENTS_CATALOG: Garment[] = [
  // CAMISAS
  new Garment(
    'shirt_1',
    'Camisa Puntos',
    GarmentType.SHIRT,
    GarmentCategory.UPPER_BODY,
    GarmentSize.M,
    '#FFFFFF',
    '/models/jacket.glb',
    '/assets/clothes_images/FEM/camisas/camisa-1.jpg'
  ),
  new Garment(
    'shirt_2',
    'Camisa Rayas',
    GarmentType.SHIRT,
    GarmentCategory.UPPER_BODY,
    GarmentSize.M,
    '#4169E1',
    '/models/dress.glb',
    '/assets/clothes_images/FEM/camisas/camisa-2.jpg'
  ),
  new Garment(
    'shirt_3',
    'Camisa Azul',
    GarmentType.SHIRT,
    GarmentCategory.UPPER_BODY,
    GarmentSize.M,
    '#0000FF',
    '/models/vestidoBlusaConEsqueleto.glb',
    '/assets/clothes_images/FEM/camisas/camisa-3.jpg'
  ),

  // CHAQUETAS
  new Garment(
    'jacket_1',
    'Chaqueta Azul Marino',
    GarmentType.JACKET,
    GarmentCategory.UPPER_BODY,
    GarmentSize.M,
    '#000080',
    '/models/blazer.glb',
    '/assets/clothes_images/FEM/chaquetas/chaqueta-1.jpg'
  ),

  // PANTALONES
  new Garment(
    'pants_1',
    'Pantalón Negro',
    GarmentType.PANTS,
    GarmentCategory.LOWER_BODY,
    GarmentSize.M,
    '#000000',
    '/models/dress.glb',
    '/assets/clothes_images/FEM/pantalones/pantalon-1.jpg'
  ),

  // VESTIDOS
  new Garment(
    'dress_1',
    'Vestido Rojo',
    GarmentType.DRESS,
    GarmentCategory.FULL_BODY,
    GarmentSize.M,
    '#FF0000',
    '/models/jacket.glb',
    '/assets/clothes_images/FEM/vestidos/vestido-1.jpg'
  )
];
