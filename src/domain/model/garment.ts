import { GarmentType } from '../enums/garment-type.enum';
import { GarmentCategory } from '../enums/garment-category.enum';
import { GarmentSize } from '../enums/garment-size.enum';

export class Garment {
    id: string;
    name: string;
    type: GarmentType;
    category: GarmentCategory;
    size: GarmentSize;
    color: string;
    modelPath: string;
    imagePath: string;

    constructor(
        id: string,
        name: string,
        type: GarmentType,
        category: GarmentCategory,
        size: GarmentSize,
        color: string,
        modelPath: string,
        imagePath: string
    ) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.category = category;
        this.size = size;
        this.color = color;
        this.modelPath = modelPath;
        this.imagePath = imagePath;
    }
}
