import { GarmentType } from '../enums/garment-type.enum';
import { GarmentCategory } from '../enums/garment-category.enum';

export class Garment {
  id: string;
  name: string;
  type: GarmentType;
  category: GarmentCategory;
  modelPath: string;
  imagePath: string;

  constructor(
    id: string,
    name: string,
    type: GarmentType,
    category: GarmentCategory,
    modelPath: string,
    imagePath: string
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.category = category;
    this.modelPath = modelPath;
    this.imagePath = imagePath;
  }
}
