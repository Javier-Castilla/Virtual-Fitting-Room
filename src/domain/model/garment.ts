import { GarmentType } from '../enums/garment-type.enum';
import { GarmentCategory } from '../enums/garment-category.enum';
import {GarmentGender} from "../enums/garment-gender.enum";

export class Garment {
    id: string;
    name: string;
    type: GarmentType;
    category: GarmentCategory;
    modelPath: string;
    imagePath: string;
    gender: GarmentGender;

    constructor(
        id: string,
        name: string,
        type: GarmentType,
        category: GarmentCategory,
        modelPath: string,
        imagePath: string,
        gender: GarmentGender
    ) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.category = category;
        this.modelPath = modelPath;
        this.imagePath = imagePath;
        this.gender = gender;
    }
}
